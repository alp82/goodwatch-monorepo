import { drain, fetchWithTimeout } from "./fetch-timeout.ts"
// The bot's application emoji IDs (gw_score_1 to gw_score_10), read once with the bot token and cached for 24 hours in
// Valkey and in process. Cards fall back to plain text for any name missing here, so a failed read never breaks a card.
import type { EmojiIds } from "./cards.ts"
import { SCORE_EMOJI_NAMES } from "./score-emoji.ts"

export const EMOJI_TTL_SECONDS = 24 * 3600
/** After a failed read, or while emojis are still missing, wait this long before asking Discord again. */
const FAILURE_TTL_SECONDS = 300

interface Store {
	get(key: string): Promise<string | null>
	set(key: string, value: string, ttlSeconds: number): Promise<void>
}
export interface EmojiOptions {
	appId?: string
	botToken?: string
	fetch?: typeof fetch
	store?: Store | null
	now?: () => number
}

let memo: { appId: string; ids: EmojiIds; until: number } | null = null
let inflight: Promise<EmojiIds> | null = null

export function resetEmojiCache() {
	memo = null
	inflight = null
}

async function valkey(): Promise<Store | null> {
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) return null
	return {
		get: (key) => withRedisDeadline(redis.get(key)),
		set: async (key, value, ttl) => {
			await withRedisDeadline(redis.set(key, value, "EX", ttl))
		},
	}
}

export async function listApplicationEmojis(
	appId: string,
	botToken: string,
	send: typeof fetch = fetch,
): Promise<{ id: string; name: string }[]> {
	const data = await fetchWithTimeout(
		send,
		`https://discord.com/api/v10/applications/${encodeURIComponent(appId)}/emojis`,
		{ headers: { Authorization: `Bot ${botToken}` } },
		5_000,
		async (response) => {
			if (!response.ok) {
				await drain(response)
				throw new Error(`Discord REST status ${response.status}`)
			}
			return (await response.json()) as {
				items?: { id?: unknown; name?: unknown }[]
			}
		},
	)
	return (data.items ?? []).flatMap((e) =>
		typeof e.id === "string" && typeof e.name === "string"
			? [{ id: e.id, name: e.name }]
			: [],
	)
}

/** Name to ID for the bot's application emojis. Returns {} without credentials or when Discord is unreachable. */
export async function applicationEmojiIds(
	options: EmojiOptions = {},
): Promise<EmojiIds> {
	const appId = options.appId ?? process.env.DISCORD_APP_ID
	const botToken = options.botToken ?? process.env.DISCORD_BOT_TOKEN
	const now = options.now ?? Date.now
	if (!appId || !botToken) return {}
	if (memo && memo.appId === appId && memo.until > now()) return memo.ids
	inflight ??= (async () => {
		// The entry carries its own expiry, so a process that reads it keeps it no longer than Valkey does.
		const key = `discord:emojis:v2:${appId}`
		const store =
			options.store === undefined
				? await valkey().catch(() => null)
				: options.store
		const ttlFor = (ids: EmojiIds) =>
			// Until every score emoji is uploaded, check again soon so a fresh upload shows up within minutes.
			SCORE_EMOJI_NAMES.every((name) => ids[name])
				? EMOJI_TTL_SECONDS
				: FAILURE_TTL_SECONDS
		const remember = (ids: EmojiIds, until: number) => {
			memo = { appId, ids, until }
			return ids
		}
		try {
			const cached = await store?.get(key).catch(() => null)
			if (cached) {
				const entry = JSON.parse(cached) as {
					ids?: unknown
					expires_at?: unknown
				}
				if (
					entry.ids &&
					typeof entry.ids === "object" &&
					typeof entry.expires_at === "number" &&
					entry.expires_at > now()
				) {
					const ids = entry.ids as EmojiIds
					return remember(
						ids,
						Math.min(entry.expires_at, now() + ttlFor(ids) * 1000),
					)
				}
			}
		} catch {
			/* A corrupt entry is replaced below. */
		}
		try {
			const ids = Object.fromEntries(
				(await listApplicationEmojis(appId, botToken, options.fetch))
					.filter((e) => e.name.startsWith("gw_"))
					.map((e) => [e.name, e.id]),
			)
			const ttl = ttlFor(ids)
			const until = now() + ttl * 1000
			await store
				?.set(key, JSON.stringify({ ids, expires_at: until }), ttl)
				.catch(() => {})
			return remember(ids, until)
		} catch {
			return remember({}, now() + FAILURE_TTL_SECONDS * 1000)
		}
	})().finally(() => {
		inflight = null
	})
	return inflight
}

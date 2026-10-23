import { randomUUID } from "node:crypto"

export class LinkingUnavailable extends Error {
	constructor() {
		super("Linking isn't available yet. Please try again later.")
	}
}
export type LinkRow = {
	discord_user_id: string
	user_id: string
	discord_username: string | null
}
export type UnlinkTarget = { byDiscordUserId: string } | { byUserId: string }
interface Store {
	query: (sql: string, args: string[]) => Promise<LinkRow[]>
	execute: (sql: string, args: (string | number)[]) => Promise<unknown>
	invalidate: (discordUserId: string) => Promise<unknown>
	exclusive: <T>(work: () => Promise<T>) => Promise<T>
	warn: () => void
}
const TABLE = "doc.user_discord_link"
let warned = false
function missing(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		/RelationUnknown|TableUnknown|relation .*user_discord_link.* unknown/i.test(
			String(error.message),
		)
	)
}
/** All link writers share a Valkey lease. Refreshes make non-key uniqueness reads see the preceding writer. */
export function createLinkStore(deps: Store) {
	const guard = async <T>(work: () => Promise<T>, fallback?: T): Promise<T> => {
		try {
			return await work()
		} catch (error) {
			if (!missing(error)) throw error
			if (!warned) {
				warned = true
				deps.warn()
			}
			if (fallback !== undefined) return fallback
			throw new LinkingUnavailable()
		}
	}
	const rows = (where: string, args: string[]) =>
		deps.query(
			`SELECT discord_user_id, user_id, discord_username FROM ${TABLE} WHERE ${where} AND deleted_at IS NULL`,
			args,
		)
	const refresh = () => deps.execute(`REFRESH TABLE ${TABLE}`, [])
	return {
		// Keep the primary key in this predicate: bot reads must not depend on index refreshes.
		getLinkedUserId: (id: string) =>
			guard(
				async () =>
					(await rows("discord_user_id = ?", [id]))[0]?.user_id ?? null,
				null,
			),
		getUserLink: (id: string) =>
			guard(async () => (await rows("user_id = ?", [id]))[0] ?? null, null),
		available: () =>
			guard(async () => {
				await rows("discord_user_id = ?", ["0"])
				return true
			}, false),
		linkAccounts: (discordId: string, userId: string, username: string) =>
			guard(() =>
				deps.exclusive(async () => {
					await refresh()
					const previous = await rows("(user_id = ? OR discord_user_id = ?)", [
						userId,
						discordId,
					])
					const affected = [
						...new Set([discordId, ...previous.map((r) => r.discord_user_id)]),
					]
					try {
						await deps.execute(
							`UPDATE ${TABLE} SET deleted_at = ? WHERE (user_id = ? OR discord_user_id = ?) AND deleted_at IS NULL`,
							[Date.now(), userId, discordId],
						)
						await deps.execute(
							`INSERT INTO ${TABLE} (discord_user_id, user_id, discord_username, linked_at, deleted_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT (discord_user_id) DO UPDATE SET user_id = excluded.user_id, discord_username = excluded.discord_username, linked_at = excluded.linked_at, deleted_at = NULL`,
							[discordId, userId, username, Date.now()],
						)
					} finally {
						try {
							await refresh()
						} finally {
							await Promise.all(affected.map(deps.invalidate))
						}
					}
				}),
			),
		unlink: (target: UnlinkTarget) =>
			guard(
				() =>
					deps.exclusive(async () => {
						await refresh()
						const field =
							"byDiscordUserId" in target ? "discord_user_id" : "user_id"
						const id =
							"byDiscordUserId" in target
								? target.byDiscordUserId
								: target.byUserId
						const previous = await rows(`${field} = ?`, [id])
						try {
							await deps.execute(
								`UPDATE ${TABLE} SET deleted_at = ? WHERE ${field} = ? AND deleted_at IS NULL`,
								[Date.now(), id],
							)
						} finally {
							try {
								await refresh()
							} finally {
								await Promise.all(
									previous.map((r) => deps.invalidate(r.discord_user_id)),
								)
							}
						}
					}),
				undefined,
			),
	}
}

const CACHE = { name: "discord-link-v1", ttlMinutes: 1, staleMinutes: 0 }
async function runtime() {
	const [crate, cache] = await Promise.all([
		import("../../utils/crate.ts"),
		import("../../utils/cache.ts"),
	])
	cache.declareResettableCache(CACHE)
	const store = createLinkStore({
		query: (sql, args) => crate.query<LinkRow>(sql, args),
		execute: (sql, args) => crate.execute(sql, args),
		invalidate: async (discordUserId) => {
			if (
				!(await cache.resetCacheConfirmed({
					name: CACHE.name,
					params: { discordUserId },
				}))
			)
				throw new Error("Could not refresh the Discord link. Please try again.")
		},
		warn: () =>
			console.warn("Discord linking: user_discord_link is not installed yet"),
		exclusive: async (work) => {
			const redis = cache.getRedisCluster()
			const key = "discord:link:writer:v1"
			const token = randomUUID()
			if (!redis)
				throw new Error("Linking is temporarily unavailable. Please try again.")
			if ((await redis.set(key, token, "PX", 120_000, "NX")) !== "OK")
				throw new Error("Linking is busy. Please try again.")
			try {
				return await work()
			} finally {
				await redis.eval(
					"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
					1,
					key,
					token,
				)
			}
		},
	})
	return { store, cache }
}
export async function getLinkedUserId(
	discordUserId: string,
): Promise<string | null> {
	const { store, cache } = await runtime()
	const result = await cache.cached({
		...CACHE,
		params: { discordUserId },
		target: async () => ({
			userId: await store.getLinkedUserId(discordUserId),
		}),
	})
	return result.userId
}
export async function getUserLink(userId: string) {
	return (await runtime()).store.getUserLink(userId)
}
export async function linkingAvailable() {
	return (await runtime()).store.available()
}
export async function linkAccounts(
	discordUserId: string,
	userId: string,
	username: string,
) {
	return (await runtime()).store.linkAccounts(discordUserId, userId, username)
}
export async function unlink(target: UnlinkTarget) {
	try {
		const { store } = await runtime()
		if (await store.available()) await store.unlink(target)
	} catch (error) {
		if (!(error instanceof LinkingUnavailable)) throw error
	}
}

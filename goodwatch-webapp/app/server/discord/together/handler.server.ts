import { randomBytes } from "node:crypto"
import type { Interaction } from "../router.server.ts"
import { defer, within } from "../respond.server.ts"
import { textCard, type EmojiIds } from "../cards.ts"
import { discordRest } from "../rest.server.ts"
import { parseTogetherId } from "../custom-id.ts"
import {
	publicCard,
	votingCard,
	installCard,
	publicSignature,
} from "./cards.ts"
import {
	nextTitle,
	growDeck,
	shouldGrow,
	isExhausted,
	topThree,
} from "./rules.ts"
import {
	EXPIRED,
	GUILD_LIMIT,
	sessionKey,
	sessionStore,
	type Session,
	type SessionStore,
	type SessionMeta,
} from "./store.server.ts"
import { deckCandidates, togetherTitle } from "./deck.server.ts"
import { createPublicUpdater, publicEditState } from "./throttle.server.ts"
import { resolveViewerPlace } from "../place.server.ts"
export interface TogetherDependencies {
	store: () => Promise<SessionStore>
	place: (interaction: Interaction) => ReturnType<typeof resolveViewerPlace>
	emojis: () => Promise<EmojiIds>
	candidates: typeof deckCandidates
	expireAt: (id: string, createdAt: number) => void
	title: typeof togetherTitle
	evicted: (interaction: Interaction, id: string) => Promise<void>
	post: (
		app: string,
		token: string,
		body: unknown,
	) => Promise<{ id: string; channel_id: string }>
	original: (
		app: string,
		token: string,
	) => Promise<{ id: string; channel_id: string }>
	edit: (app: string, token: string, body: unknown) => Promise<void>
	published: (id: string, signature: string) => Promise<void>
	changed: (id: string) => Promise<void>
}
async function publicUpdate(id: string) {
	const state = await publicEditState()
	const store = await sessionStore()
	const updater = createPublicUpdater(state, async (sessionId) => {
		const session = await store.load(sessionId)
		if (session && session.meta.status !== "open") {
			clearTimeout(expiryTimers.get(sessionId))
			expiryTimers.delete(sessionId)
		}
		if (!session?.meta.messageId || !session.meta.channelId) return null
		const signature = publicSignature(session)
		return {
			signature,
			edit: async () => {
				const ids =
					session.meta.status === "open"
						? [
								...session.summary.matches.slice(0, 25),
								...(isExhausted(session, session.meta.deckDone)
									? topThree(session).map((t) => t.titleId)
									: []),
								...session.summary.possibleMatches
									.slice(0, 5)
									.map((p) => p.titleId),
						  ]
						: []
				const titles = await Promise.all(
					[...new Set(ids)].map(
						(titleId) =>
							session.meta.titles?.[titleId] ??
							togetherTitle(titleId, session.meta.place).catch(() => ({
								id: titleId,
								name: "Title unavailable",
								year: null,
							})),
					),
				)
				if (titles.length)
					await store.remember(sessionId, titles).catch(() => {})
				await discordRest({
					botToken: process.env.DISCORD_BOT_TOKEN,
				}).editMessage(
					session.meta.channelId!,
					session.meta.messageId!,
					publicCard(
						session,
						titles,
						await (await import("../emoji.server.ts"))
							.applicationEmojiIds()
							.catch(() => ({})),
					),
				)
			},
		}
	})
	await updater.changed(id)
}
async function expireEvicted(interaction: Interaction, id: string) {
	if (
		!interaction.channel_id ||
		!interaction.message?.id ||
		(interaction.message.flags ?? 0) & 64
	)
		return
	const { getRedisCluster, withRedisDeadline } = await import(
		"../../../utils/cache"
	)
	const redis = getRedisCluster()
	if (!redis) return
	const key = `${sessionKey(id)}:evicted`
	if (!(await withRedisDeadline(redis.set(key, "1", "EX", 86400, "NX")))) return
	try {
		await discordRest({ botToken: process.env.DISCORD_BOT_TOKEN }).editMessage(
			interaction.channel_id,
			interaction.message.id,
			{
				...textCard(EXPIRED),
				flags: 1 << 15,
			},
		)
	} catch (error) {
		await withRedisDeadline(redis.del(key))
		throw error
	}
}
const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()
function scheduleExpiry(id: string, createdAt: number) {
	if (expiryTimers.has(id)) return
	const timer = setTimeout(() => {
		expiryTimers.delete(id)
		void publicUpdate(id).catch(() =>
			console.error("DISCORD together expiry update failed"),
		)
	}, Math.max(0, createdAt + 86400_000 - Date.now()))
	timer.unref?.()
	expiryTimers.set(id, timer)
}
const defaults: TogetherDependencies = {
	expireAt: scheduleExpiry,
	evicted: expireEvicted,
	store: sessionStore,
	place: (interaction) =>
		resolveViewerPlace(interaction, {
			getGuild: async (id) =>
				(await import("../guild.server.ts")).getGuildSettings(id),
		}),
	emojis: async () =>
		(await import("../emoji.server.ts")).applicationEmojiIds(),
	candidates: deckCandidates,
	title: togetherTitle,
	original: (...args) => discordRest().getOriginalMessage(...args),
	post: (...args) => discordRest().editOriginalMessage(...args),
	edit: (...args) => discordRest().editOriginal(...args),
	changed: publicUpdate,
	published: async (id, signature) =>
		(await publicEditState()).saved(id, signature),
}
export function togetherInstalled(interaction: Interaction) {
	return (
		!!interaction.guild_id &&
		interaction.authorizing_integration_owners?.["0"] ===
			interaction.guild_id &&
		!!interaction.app_permissions
	)
}
export async function handleTogether(
	interaction: Interaction,
	user: string,
	finish: (outcome: string) => void,
	overrides: Partial<TogetherDependencies> = {},
) {
	const deps = { ...defaults, ...overrides }
	const action = parseTogetherId(interaction.data?.custom_id ?? "")
	const starting =
		interaction.type === 2 && interaction.data?.name === "together"
	if (starting && !togetherInstalled(interaction)) {
		finish("not_installed")
		return {
			type: 4,
			data: installCard(
				process.env.DISCORD_APP_ID ?? interaction.application_id ?? "",
			),
		}
	}
	if (
		!interaction.application_id ||
		!interaction.token ||
		(!starting && !action)
	) {
		finish("invalid")
		return { type: 4, data: textCard("Invalid interaction.") }
	}
	// Reserve before the public deferral so a limit error can still be ephemeral.
	// A short reservation cleans itself up if this worker stops before creation.
	const startingId = starting ? randomBytes(12).toString("hex") : undefined
	if (startingId) {
		const reserved = await within(
			(async () => {
				const store = await deps.store()
				return Number(
					await store.reserve(
						interaction.guild_id!,
						startingId,
						Date.now() + 30_000,
					),
				)
			})(),
			600,
			-1,
		)
		if (reserved !== 1) {
			finish(reserved === 0 ? "session_limit" : "storage_timeout")
			return {
				type: 4,
				data: textCard(
					reserved === 0
						? GUILD_LIMIT
						: "Together storage is unavailable. Try again shortly.",
				),
			}
		}
	}
	const app = interaction.application_id,
		token = interaction.token
	let createdId: string | undefined
	let initialSignature: string | undefined
	const grow = async (store: SessionStore, session: Session) => {
		if (
			session.meta.status === "open" &&
			!session.meta.deckDone &&
			shouldGrow(session)
		) {
			const candidates = await deps.candidates(session.meta)
			return await store.grow(
				session.meta.id,
				session.deck.length,
				candidates.slice(0, 30),
				candidates.length <= 30,
			)
		}
		return session
	}
	return defer(
		async () => {
			try {
				const store = await deps.store()
				if (starting) {
					const options = Object.fromEntries(
						(interaction.data?.options ?? []).map((o) => [o.name, o.value]),
					)
					const place = await deps.place(interaction)
					const meta: SessionMeta = {
						id: startingId!,
						guildId: interaction.guild_id!,
						starterId: user,
						starterName: displayName(interaction),
						createdAt: Date.now(),
						applicationId: app,
						interactionToken: token,
						type:
							options.type === "movie" || options.type === "show"
								? options.type
								: "any",
						mood: typeof options.mood === "string" ? options.mood : undefined,
						place: { ...place, services: place.services ?? [] },
						deck: [],
						status: "open",
					}
					const candidates = await deps.candidates(meta)
					meta.deck = growDeck([], candidates)
					meta.deckDone = candidates.length <= 30
					const session = await store.create(meta)
					if (!session) return textCard(EXPIRED)
					createdId = meta.id
					deps.expireAt(meta.id, meta.createdAt)
					initialSignature = publicSignature(session)
					return publicCard(session)
				}
				if (!action) return textCard("Invalid action.")
				const existing = await store.load(action.session)
				if (!existing) {
					await deps
						.evicted(interaction, action.session)
						.catch(() => console.error("DISCORD together expiry update failed"))
					return textCard(EXPIRED)
				}
				if (interaction.guild_id !== existing.meta.guildId)
					return textCard("This session belongs to another server.")
				if (existing.meta.status !== "open") {
					void deps
						.changed(action.session)
						.catch(() => console.error("DISCORD together public update failed"))
					return textCard(closedMessage(existing))
				}
				deps.expireAt(action.session, existing.meta.createdAt)
				if (
					["end", "remove", "choose"].includes(action.action) &&
					user !== existing.meta.starterId
				)
					return textCard("Only the starter can do that.")
				if (
					!existing.meta.messageId &&
					existing.meta.applicationId &&
					existing.meta.interactionToken &&
					Date.now() - existing.meta.createdAt < 15 * 60 * 1000
				) {
					try {
						const message = await deps.original(
							existing.meta.applicationId,
							existing.meta.interactionToken,
						)
						await store.bind(action.session, message.channel_id, message.id)
					} catch {
						console.error("DISCORD together binding recovery failed")
					}
				}
				let session = await store.act(
					action.session,
					action.action === "yep" || action.action === "nope"
						? {
								kind: "vote",
								user,
								titleId: action.titleId!,
								vote: action.action,
						  }
						: action.action === "undo"
						? { kind: "undo", user, titleId: action.titleId ?? "" }
						: action.action === "remove"
						? {
								kind: "remove",
								user,
								target: interaction.data?.values?.[0] ?? "",
						  }
						: action.action === "pick" || action.action === "choose"
						? {
								kind: action.action,
								user,
								titleId: interaction.data?.values?.[0] ?? "",
						  }
						: { kind: action.action, user },
					displayName(interaction),
				)
				if (!session) return textCard(EXPIRED)
				if (session.meta.status === "decided" && session.transitioned) {
					const id = session.meta.decidedTitleId!
					let title,
						failed = false
					try {
						title = await deps.title(id, session.meta.place)
						failed =
							!title.availability || title.availability.state === "unknown"
						if (
							failed &&
							title.name === "Title unavailable" &&
							session.meta.decisionTitle
						)
							title = session.meta.decisionTitle
					} catch {
						title = session.meta.decisionTitle ?? {
							id,
							name: "Title unavailable",
							year: null,
						}
						failed = true
					}
					try {
						session =
							(await store.details(action.session, title, failed)) ?? session
					} catch {
						console.error("DISCORD together decision details failed")
					}
				}
				// Voting state is already committed; a catalog failure must not lose a vote or hide its public update.
				try {
					session = await grow(store, session)
				} catch {
					/* Retry growth on the next press. */
				}
				if (!session) return textCard(EXPIRED)
				void deps
					.changed(action.session)
					.catch(() => console.error("DISCORD together public update failed"))
				if (session.meta.status !== "open")
					return textCard(closedMessage(session))
				if (action.action === "pick")
					return textCard(
						"Pick saved. Decides when everyone picks the same match.",
					)
				if (action.action === "remove") return textCard("Participant removed.")
				if (action.action === "leave")
					return textCard("You left this session. Join again any time.")
				const id = nextTitle(session, user)
				const title = id ? await deps.title(id, session.meta.place) : undefined
				if (title) await store.remember(action.session, [title]).catch(() => {})
				return votingCard(
					session,
					user,
					title,
					await deps.emojis().catch(() => ({})),
				)
			} catch (error) {
				if (startingId && !createdId) {
					await (await deps.store())
						.release(interaction.guild_id!, startingId)
						.catch(() => {})
				}
				if (error instanceof Error) {
					const known = [
						"This session is full",
						GUILD_LIMIT,
						"Join to pick",
						"Choose a current match",
						"Only the starter can do that",
						"The deck is not exhausted",
						"Choose one of the top three titles",
					]
					const reason = known.find((m) => error.message.includes(m))
					if (reason) return textCard(reason)
				}
				if (
					error instanceof Error &&
					error.message.includes("This session is closed")
				) {
					const session = action
						? await (await deps.store()).load(action.session)
						: null
					if (action)
						void deps
							.changed(action.session)
							.catch(() =>
								console.error("DISCORD together public update failed"),
							)
					return textCard(session ? closedMessage(session) : EXPIRED)
				}
				throw error
			}
		},
		async (body) => {
			if (createdId) {
				const message = await deps.post(app, token, body)
				try {
					await (
						await deps.store()
					).bind(createdId, message.channel_id, message.id)
					await deps.published(createdId, initialSignature!)
					await deps.changed(createdId)
				} catch {
					console.error("DISCORD together publication bookkeeping failed")
				}
			} else await deps.edit(app, token, body)
		},
		finish,
		{
			type:
				starting ||
				["join", "pick", "end", "remove", "choose"].includes(
					action?.action ?? "",
				)
					? 5
					: 6,
			ephemeral: !starting,
		},
	)
}

function displayName(interaction: Interaction) {
	const user = interaction.member?.user ?? interaction.user
	return (
		interaction.member?.nick ??
		user?.global_name ??
		user?.username ??
		"Participant"
	).slice(0, 80)
}

function closedMessage(session: Session) {
	return session.meta.status === "expired"
		? EXPIRED
		: session.meta.status === "decided"
		? "Decided. See the title in the channel."
		: "Ended by the starter."
}

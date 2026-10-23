import { randomBytes } from "node:crypto"
import type { Interaction } from "../router.server.ts"
import { defer } from "../respond.server.ts"
import { textCard, type EmojiIds } from "../cards.ts"
import { discordRest } from "../rest.server.ts"
import { parseTogetherId } from "../custom-id.ts"
import { publicCard, votingCard, installCard } from "./cards.ts"
import { nextTitle, growDeck, shouldGrow, summarySignature } from "./rules.ts"
import {
	EXPIRED,
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
	title: typeof togetherTitle
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
		if (!session?.meta.messageId || !session.meta.channelId) return null
		const signature = summarySignature(session.summary)
		return {
			signature,
			edit: async () => {
				const ids = [
					...session.summary.matches.slice(0, 5),
					...session.summary.possibleMatches.slice(0, 5).map((p) => p.titleId),
				]
				const titles = await Promise.all(
					ids.map((titleId) => togetherTitle(titleId, session.meta.place)),
				)
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
const defaults: TogetherDependencies = {
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
export function handleTogether(
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
	const app = interaction.application_id,
		token = interaction.token
	let createdId: string | undefined
	let initialSignature: string | undefined
	const grow = async (store: SessionStore, session: Session) => {
		if (!session.meta.deckDone && shouldGrow(session)) {
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
						id: randomBytes(12).toString("hex"),
						guildId: interaction.guild_id!,
						starterId: user,
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
					initialSignature = summarySignature(session.summary)
					return publicCard(session)
				}
				if (!action) return textCard("Invalid action.")
				const existing = await store.load(action.session)
				if (!existing) return textCard(EXPIRED)
				if (interaction.guild_id !== existing.meta.guildId)
					return textCard("This session belongs to another server.")
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
							: { kind: action.action, user },
				)
				if (!session) return textCard(EXPIRED)
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
				if (action.action === "leave")
					return textCard("You left this session. Join again any time.")
				const id = nextTitle(session, user)
				return votingCard(
					session,
					user,
					id ? await deps.title(id, session.meta.place) : undefined,
					await deps.emojis().catch(() => ({})),
				)
			} catch (error) {
				if (error instanceof Error && error.message === "This session is full")
					return textCard("This session is full")
				if (
					error instanceof Error &&
					error.message.includes("This session is closed")
				)
					return textCard("This session is closed.")
				throw error
			}
		},
		async (body) => {
			if (createdId) {
				const message = await deps.post(app, token, body)
				try {
					await (await deps.store()).bind(
						createdId,
						message.channel_id,
						message.id,
					)
					await deps.published(createdId, initialSignature!)
					await deps.changed(createdId)
				} catch {
					console.error("DISCORD together publication bookkeeping failed")
				}
			} else await deps.edit(app, token, body)
		},
		finish,
		{
			type: starting || action?.action === "join" ? 5 : 6,
			ephemeral: !starting,
		},
	)
}

import {
	themeChoices,
	styleChoices,
	releasedChoices,
} from "./filter-options.ts"
import { CARD_COUNTRIES } from "./cards.ts"
import { readingLine } from "./search-reading.ts"
import type { ReadingChip } from "../combined-search/reading-retrieval.server.ts"
import { guestWatchPick } from "./watch-picks.server.ts"
import {
	anotherId,
	parseAnotherId,
	watchOptions,
	type WatchOptions,
} from "./watch-id.ts"
import { watchCard, nextCard, type NextEpisode } from "./watch-cards.ts"
import {
	linkPrompt,
	memberNote,
	ratePicker,
	writeConfirmation,
} from "./member-cards.ts"
import { discordWrite } from "./writes.server.ts"
import {
	isProfileCardChoice,
	profileReply,
	type MemberProfile,
} from "./profile-cards.ts"
import { parseUndoId } from "./custom-id.ts"
import {
	handleTogether,
	type TogetherDependencies,
} from "./together/handler.server.ts"
import { appOrigin } from "./oauth.server.ts"
import {
	cachedTitleRead,
	valkeyTitleStore,
	type CacheStore,
} from "./title-cache.server.ts"
import { commands } from "./commands.ts"
import {
	retryEntry,
	saveRetry,
	loadRetry,
	retryCustomId,
	isRetryId,
	parseRetryId,
	valkeyRetryStore,
	type RetryStore,
} from "./retry.server.ts"
import { FALLBACK_COUNTRY } from "../cache-identity.server.ts"
import {
	type GuestTitle,
	type GuestPerson,
	type MemberMarks,
	message,
	EPHEMERAL,
	textCard,
	errorCard,
	ERROR_TEXT,
	displayText,
	titleCard,
	streamLinks,
	titleListCard,
	listHeading,
	personCard,
	hotCard,
	HOT_PAGE_SIZE,
	type HotTitle,
	type HotPost,
	linkPromptCard,
	slowDownCard,
	countryName,
	discordText,
	type EmojiIds,
	type Component,
	type LinkedIdentity,
	linkedCard,
} from "./cards.ts"
import {
	isTitleId,
	formatCustomId,
	parseCustomId,
	parseListId,
	parseListRef,
	parseTogetherId,
	listCustomId,
	type ListRef,
} from "./custom-id.ts"
import { resolveViewerPlace, type PlaceDependencies } from "./place.server.ts"
import { guildSettingsAvailable, type GuildSettings } from "./guild.server.ts"
import { setup, setupAutocomplete, canManageGuild } from "./setup.server.ts"
import { defer, within, LOADING_MIN_MS } from "./respond.server.ts"
import { loadingLine, loadingMessage, pressedName } from "./loading.ts"
import { discordRest } from "./rest.server.ts"
import type { DiscoverState } from "./discover-state.server.ts"
import type { SearchResult } from "./search.server.ts"
import type { readGuestTool } from "../mcp/guest.server.ts"
import type { RateVerdict } from "../rate-limit.server.ts"
import type { TalkedItem, TalkedRow } from "../../domain/talked-about-now.ts"
function discoverArgs(
	args: Parameters<typeof readGuestTool>[3],
	member: boolean,
): Parameters<typeof readGuestTool>[3] {
	const order = args.order ?? (member ? "for_you" : undefined)
	return {
		...args,
		order,
		...(member ? { exclude_seen: true } : {}),
		for_you: member && (order === "for_you" || order === "match"),
	}
}
export interface Interaction {
	type: number
	id?: string
	application_id?: string
	token?: string
	locale?: string
	context?: number
	guild_id?: string
	authorizing_integration_owners?: Record<string, string>
	app_permissions?: string
	channel_id?: string
	message?: { flags?: number; id?: string; components?: Component[] }
	user?: { id: string; username?: string; global_name?: string }
	member?: {
		nick?: string
		roles?: string[]
		user?: { id: string; username?: string; global_name?: string }
		permissions?: string
	}
	data?: {
		name?: string
		custom_id?: string
		components?: {
			type: number
			component?: { custom_id?: string; values?: string[] }
			components?: { custom_id?: string; values?: string[] }[]
		}[]
		values?: string[]
		options?: { name: string; value?: string | number; focused?: boolean }[]
	}
}
export interface Dependencies extends PlaceDependencies {
	write?: typeof discordWrite
	storeLinkMessage?: (app: string, token: string) => Promise<string>
	memberHandle?: (userId: string) => Promise<LinkedIdentity | null>
	/** The member's profile handle (null without one) and who sees which part, for /profile. */
	memberProfile?: (userId: string) => Promise<MemberProfile>
	together?: Partial<TogetherDependencies>
	linkedUser: (discordId: string) => Promise<string | null>
	unlink: (target: { byDiscordUserId: string }) => Promise<void>
	memberRead: (
		userId: string,
		name:
			| "get_title"
			| "get_settings"
			| "discover_titles"
			| "get_tonight"
			| "get_my_shows"
			| "get_show_progress",
		args: Parameters<typeof readGuestTool>[3],
	) => Promise<Record<string, unknown>>

	saveGuild?: (settings: GuildSettings) => Promise<boolean>
	guildAvailable?: () => boolean
	countries?: () => Promise<{ code: string; name: string }[]>
	read: typeof readGuestTool
	take: (user: string) => Promise<RateVerdict>
	edit: (
		app: string,
		token: string,
		body: unknown,
		signal?: AbortSignal,
	) => Promise<void>
	log: (line: string) => void
	guestPick?: typeof guestWatchPick
	hot?: () => Promise<HotTitle[]>
	/** Free-text /search, using the website engine and the Discord user's uncached allowance. */
	searchTitles?: (
		query: string,
		discordUser: string,
		onReading?: (reading: ReadingChip[]) => void,
	) => Promise<SearchResult>
	/** Posters and scores by title ID, for lists whose read leaves them out. */
	displays?: (ids: string[]) => Promise<Map<string, Partial<GuestTitle>>>
	saveState?: (state: DiscoverState, forceStore?: boolean) => Promise<string>
	loadState?: (key: string) => Promise<DiscoverState | null>
	emojis?: () => Promise<EmojiIds>
	/** Where built title card reads are kept for a few minutes; null without Valkey. */
	titleStore?: () => Promise<CacheStore | null>
	/** Where Try again keeps the original interaction for 15 minutes. */
	retryStore?: () => Promise<RetryStore>
}
const defaults: Required<Omit<Dependencies, "resolveMemberPlace">> = {
	guestPick: guestWatchPick,
	write: discordWrite,
	storeLinkMessage: async (app, token) =>
		(await import("./link-message.server.ts")).storeLinkMessage(app, token),
	memberHandle: async (id) =>
		(await import("./link-message.server.ts")).memberHandle(id),
	memberProfile: async (id) => {
		const [{ getProfileByUserId }, { getUserSettings }, { parseVisibility }] =
			await Promise.all([
				import("../share-lists/view.server.ts"),
				import("../user-settings.server.ts"),
				import("../../domain/profile.ts"),
			])
		// Uncached, so a handle claimed a moment ago counts.
		const [profile, settings] = await Promise.all([
			getProfileByUserId(id),
			getUserSettings({ userId: id }),
		])
		let visibility: unknown
		try {
			visibility = JSON.parse(settings.profile_visibility ?? "")
		} catch {
			visibility = undefined
		}
		return {
			handle: profile?.handle ?? null,
			visibility: parseVisibility(visibility),
		}
	},
	together: {},
	linkedUser: async (id) =>
		(await import("./link.server.ts")).getLinkedUserId(id),
	unlink: async (target) => (await import("./link.server.ts")).unlink(target),
	memberRead: async (userId, name, args) => {
		const data = await (await import("../mcp/data.server.ts")).readMemberTool(
			userId,
			appOrigin(),
			name,
			args,
		)
		return name === "get_title"
			? (await import("../mcp/title-results.server.ts")).enrichTitleResults(
					userId,
					data,
					{ posters: true },
				)
			: data
	},
	getGuild: async (id) =>
		(await import("./guild.server.ts")).getGuildSettings(id),
	saveGuild: async (settings) =>
		(await import("./guild.server.ts")).saveGuildSettings(settings),
	guildAvailable: guildSettingsAvailable,
	countries: async () =>
		(await import("../countries.server.ts")).getCountries({}),
	read: async (...args) =>
		(await import("../mcp/guest.server.ts")).readGuestTool(...args),
	take: async (user) =>
		(await import("./limits.server.ts")).takeDiscordLimit(user),
	edit: (...args) => discordRest().editOriginal(...args),
	log: (line) => console.info(line),
	hot: async () =>
		hotTitles(
			await (
				await import("../talked-about-now/start-row.server.ts")
			).getHotOnSocials(),
		),
	searchTitles: async (query, user, onReading) =>
		(await import("./search.server.ts")).searchTitles(query, user, {
			onReading,
		}),
	displays: async (ids) =>
		(await import("./search.server.ts")).titleDisplays(ids),
	saveState: async (state, forceStore) =>
		(await import("./discover-state.server.ts")).saveDiscoverState(
			state,
			forceStore,
		),
	loadState: async (key) =>
		(await import("./discover-state.server.ts")).loadDiscoverState(key),
	emojis: async () => (await import("./emoji.server.ts")).applicationEmojiIds(),
	titleStore: valkeyTitleStore,
	retryStore: valkeyRetryStore,
}
/** Titles on /hot: four pages of three. */
export const HOT_TITLES = 12

const tmdbImage = (path: string | null | undefined, size: string) =>
	path
		? /^https?:\/\//.test(path)
			? path
			: `https://image.tmdb.org/t/p/${size}${path}`
		: null

const PLATFORMS: Record<string, string> = {
	youtube: "YouTube",
	bluesky: "Bluesky",
	mastodon: "Mastodon",
}

/** A social item as a /hot post: the platform's name (an article's publication), and an absolute image URL. */
export function hotPost(item: TalkedItem): HotPost {
	const image = item.image
		? /^https?:\/\//.test(item.image)
			? item.image
			: `https://goodwatch.app${item.image.startsWith("/") ? "" : "/"}${
					item.image
				}`
		: item.video
			? `https://i.ytimg.com/vi/${item.video}/hqdefault.jpg`
			: null
	return {
		url: item.url,
		author: item.author,
		platform:
			item.source === "rss"
				? item.publisher || "the web"
				: (PLATFORMS[item.source] ?? item.source),
		kind:
			item.source === "youtube"
				? "video"
				: item.source === "rss"
					? "article"
					: "post",
		text: item.text,
		image,
		at: item.at,
	}
}

/** The Hot on socials row as /hot titles: the first twelve, with posters, backdrops, rank, move, and their posts. */
export function hotTitles(row: Pick<TalkedRow, "titles"> | null): HotTitle[] {
	return (row?.titles ?? []).slice(0, HOT_TITLES).map((t) => ({
		id: `${t.mediaType}:${t.tmdbId}`,
		name: t.title,
		year: t.year,
		poster_url: tmdbImage(t.poster, "w342"),
		backdrop_url: tmdbImage(t.backdrop, "w780"),
		rank: t.rank,
		move: t.move,
		reason: t.reason,
		posts: (t.items ?? []).map(hotPost),
	}))
}
const moodNames = new Map(
	(
		commands
			.find((c) => c.name === "discover")
			?.options.find((o) => o.name === "mood") as
			| { choices?: { name: string; value: string }[] }
			| undefined
	)?.choices?.map((c) => [c.value, c.name]) ?? [],
)
const sortNames: Record<string, string> = {
	for_you: "For you",
	popularity: "Popular",
	newest: "Newest",
	score: "Top scored",
	match: "Best match",
}
/** "Feel-good movies", "Comedy shows", "Movies and shows". */
export function discoverHeading(args: DiscoverState["args"]) {
	const kind =
		args.type === "movie"
			? "movies"
			: args.type === "show"
				? "shows"
				: "movies and shows"
	const lead = args.moods?.[0]
		? (moodNames.get(args.moods[0]) ?? null)
		: (args.genres?.[0] ?? null)
	const heading = lead ? `${lead} ${kind}` : kind
	const labels = (
		choices: { value: string; name: string }[],
		values?: string[],
	) =>
		values
			?.map((value) => choices.find((c) => c.value === value)?.name)
			.filter(Boolean) ?? []
	const details = [
		...labels(themeChoices, args.themes),
		...labels(styleChoices, args.styles),
		...(args.released && args.released !== "any"
			? labels(releasedChoices, [args.released])
			: []),
		...(args.minimum_score ? [`GoodWatch ${args.minimum_score}+`] : []),
		...(args.anime === "only"
			? ["Only anime"]
			: args.anime === "none"
				? ["No anime"]
				: []),
		...(args.max_runtime !== undefined
			? [`Under ${args.max_runtime + 1} min`]
			: []),
		...(args.min_runtime !== undefined
			? [`${args.min_runtime} min or more`]
			: []),
	]
	return (
		heading[0].toUpperCase() +
		heading.slice(1) +
		(details.length ? ` · ${details.join(" · ")}` : "")
	)
}
export async function routeInteraction(
	interaction: Interaction,
	overrides: Partial<Dependencies> = {},
	/** Set when a Try again press re-runs the original interaction: no second rate-limit take, and the answer
	 * replaces the error card in place. */
	internal: { retrying?: boolean } = {},
): Promise<{ type: number; data?: unknown }> {
    if (interaction.type === 3 && interaction.data?.custom_id?.startsWith("feedback:")) {
        const { feedbackStaff } = await import("../feedback/corrections.ts")
        const user = interaction.member?.user?.id ?? interaction.user?.id
        if (!feedbackStaff(user,interaction.member?.roles)) return {type:4,data:{content:"Staff only.",flags:64}}
        return defer(async () => {
            const { reviewInteraction } = await import("../feedback/review.server.ts")
            const { correctionStore } = await import("../feedback/correction-runtime.server.ts")
            const result = await reviewInteraction(interaction,{decide: correctionStore.decide})
            return result.type === 7 ? textCard("Correction updated.") : textCard((result.data as {content:string}).content)
        }, body => (overrides.edit ?? defaults.edit)(interaction.application_id!,interaction.token!,body), () => {}, {ephemeral:true})
    }
	const deps = { ...defaults, ...overrides }
	const start = Date.now()
	let logged = false
	let memberId: string | null = null
	const customId =
		typeof interaction.data?.custom_id === "string"
			? interaction.data.custom_id
			: ""
	const another = parseAnotherId(customId)
	const parsed = parseCustomId(customId),
		list = parseListId(customId),
		undo = parseUndoId(customId),
		together = parseTogetherId(customId)
	const finish = (outcome: string) => {
		if (logged) return
		logged = true
		deps.log(
			`DISCORD interaction: ${JSON.stringify({
				kind: interaction.type,
				...(interaction.type === 3
					? {
							action:
								parsed?.action ??
								list?.action ??
								together?.action ??
								(another ? "another" : undo ? "undo" : "unknown"),
						}
					: {
							command: commands.some((c) => c.name === interaction.data?.name)
								? interaction.data?.name
								: "unknown",
						}),
				context:
					interaction.context === 2
						? "private"
						: interaction.context === 0 || interaction.guild_id
							? "guild"
							: "dm",
				viewer: memberId ? "member" : "guest",
				duration_ms: Date.now() - start,
				outcome,
			})}`,
		)
	}
	/** The type 7 answer for a press that updates its own message, or null when the message carries nothing to show. */
	const loading = (line: string) =>
		loadingMessage(interaction.message?.components, line)
	const pressed = (fallback = "") =>
		pressedName(
			interaction.message?.components ?? [],
			customId,
			interaction.data?.values,
			fallback,
		)
	const reply = (data: unknown, outcome = "ok", type = 4) => {
		finish(outcome)
		return { type, data }
	}
	/** Keeps this interaction for Try again; the button's custom ID, or null when it can't be kept in time. */
	const keepRetry = async () => {
		const entry = retryEntry(interaction)
		if (!entry) return null
		return within(
			deps
				.retryStore()
				.then((store) => saveRetry(entry, store))
				.then(retryCustomId),
			500,
			null,
		).catch(() => null)
	}
	/** defer with Try again on its error cards; a retry answers on the error card itself. */
	const deferred = (
		work: Parameters<typeof defer>[0],
		edit: Parameters<typeof defer>[1],
		done: Parameters<typeof defer>[2],
		options: NonNullable<Parameters<typeof defer>[3]> = {},
	) =>
		defer(
			work,
			edit,
			done,
			internal.retrying
				? {
						type: 7,
						loading: loading("Trying again…") ?? undefined,
						retry: keepRetry,
					}
				: { ...options, retry: keepRetry },
		)
	let viewer: Awaited<ReturnType<typeof resolveViewerPlace>> = {
		country: FALLBACK_COUNTRY,
	}
	let country = viewer.country
	const place = async () => {
		const discordId = interaction.member?.user?.id ?? interaction.user?.id
		const share = parsed?.action === "share" || list?.action.endsWith("-share")
		const member = await within(
			(async () => {
				const id = discordId ? await deps.linkedUser(discordId) : null
				const settings =
					id && !share ? await deps.memberRead(id, "get_settings", {}) : null
				return {
					id,
					place:
						settings && typeof settings.country === "string"
							? {
									country: settings.country,
									services: settings.service_ids as number[] | undefined,
								}
							: null,
				}
			})(),
			300,
			null,
		).catch(() => null)
		return {
			memberId: member?.id ?? null,
			viewer: await resolveViewerPlace(interaction, {
				...deps,
				resolveMemberPlace:
					deps.resolveMemberPlace ?? (async () => member?.place ?? null),
			}),
		}
	}
	const usePlace = (resolved: Awaited<ReturnType<typeof place>>) => {
		viewer = resolved.viewer
		country = viewer.country
		memberId = resolved.memberId
	}
	const allServices = () => !viewer.services?.length
	const servicesNote = () =>
		allServices() ? `Using every service in ${countryName(country)}` : undefined
	const emojis = () =>
		within(deps.emojis(), 300, {}).catch((): EmojiIds => ({}))
	const read = (
		name: Parameters<typeof readGuestTool>[2],
		args: Parameters<typeof readGuestTool>[3],
	) => deps.read(viewer, "https://goodwatch.app", name, args)
	const card = async (
		id: string,
		share = false,
		back?: ListRef,
		selectedCountry?: string,
	) => {
		// Read the displayed country without member fields; the member read fills the private block.
		const personal = !share ? memberId : null
		const guestPlace = selectedCountry
			? { country: selectedCountry, services: [] }
			: viewer
		const [mine, result] = await Promise.all([
			personal
				? deps
						.memberRead(personal, "get_title", { title_id: id })
						.catch(() => null)
				: null,
			within(deps.titleStore(), 200, null)
				.catch(() => null)
				.then((store) =>
					cachedTitleRead(
						id,
						guestPlace,
						() =>
							deps.read(guestPlace, "https://goodwatch.app", "get_title", {
								title_id: id,
							}),
						store,
					),
				),
		])
		if (!result.title)
			return textCard("No matching title found. Try /search again.")
		const memberTitle = mine?.title ? (mine.title as GuestTitle) : undefined
		const searchState =
			back?.kind === "search"
				? await deps.loadState(back.key).catch(() => null)
				: null
		const reasons = searchState?.search?.titles.find(
			(t) => t.id === id,
		)?.reasons
		// A private country switch changes availability only, preserving the pick's Another button,
		// episode, member match and list navigation exactly as displayed.
		if (
			parsed?.action === "country" &&
			selectedCountry &&
			interaction.message?.components &&
			(interaction.message.flags ?? 0) & EPHEMERAL
		) {
			const replacement = streamLinks(
				result.title as GuestTitle,
				guestPlace.country,
				{
					emojis: await emojis(),
					back,
				},
			)
			const update = (components: Component[]): Component[] => {
				const menu = components.findIndex(
					(c) =>
						c.type === 1 && c.components?.some((x) => x.custom_id === customId),
				)
				let updated = components
				if (menu >= 0) {
					let start = menu
					while (
						start > 0 &&
						components[start - 1].type === 1 &&
						components[start - 1].components?.every(
							(c) => c.type === 2 && c.style === 5,
						)
					)
						start--
					if (
						start > 0 &&
						/^(Not on a subscription service|Open the title on GoodWatch for links)/.test(
							String(components[start - 1].content ?? ""),
						)
					)
						start--
					updated = [
						...components.slice(0, start),
						...replacement,
						...components.slice(menu + 1),
					]
				}
				return updated.map((c) => ({
					...c,
					...(c.components ? { components: update(c.components) } : {}),
					...(c.custom_id ===
						formatCustomId("share", id, back, parsed.country) ||
					(typeof c.custom_id === "string" &&
						c.custom_id.startsWith(`gw1:share:${id}`))
						? { custom_id: formatCustomId("share", id, back, selectedCountry) }
						: {}),
				}))
			}
			return message(update(interaction.message.components))
		}
		return titleCard(
			{ ...(result.title as GuestTitle), reasons },
			guestPlace.country,
			{
				share,
				member: memberTitle ? ((mine?.member ?? {}) as MemberMarks) : undefined,
				memberTitle,
				emojis: await emojis(),
				back,
			},
		)
	}
	/** Fills in posters and scores the read left out; the list stays as it is when that read fails. */
	const withDisplays = async <T extends GuestTitle>(titles: T[]) => {
		const found = await within(
			deps.displays(titles.map((t) => t.id)),
			1500,
			null,
		).catch(() => null)
		return found
			? titles.map((t) => {
					const d = found.get(t.id)
					return d
						? {
								...t,
								poster_url: t.poster_url ?? d.poster_url,
								runtime_minutes: t.runtime_minutes ?? d.runtime_minutes,
								goodwatch_score: t.goodwatch_score ?? d.goodwatch_score,
							}
						: t
				})
			: titles
	}
	const watch = async (options: WatchOptions) => {
		let id: string | null
		let episode: { code: string; name: string | null } | null = null
		if (memberId) {
			const result = await deps.memberRead(memberId, "get_tonight", {
				...(options.type !== "any" ? { type: options.type } : {}),
				moods: options.mood ? [options.mood] : [],
				exclude_title_ids: options.recent,
			})
			const pick = result.pick as {
				title: GuestTitle
				episode?: { code: string; name: string | null } | null
			} | null
			id = pick?.title?.id ?? null
			episode = pick?.episode ?? null
		} else id = await deps.guestPick(viewer, options)
		if (!id || !isTitleId(id) || options.recent.includes(id))
			return textCard(
				"No more picks with these filters. Try /watch with another mood or type.",
			)
		const mine = memberId
			? await deps
					.memberRead(memberId, "get_title", { title_id: id })
					.catch(() => null)
			: null
		const result = mine?.title
			? mine
			: await read("get_title", { title_id: id })
		if (!result.title)
			return textCard("Could not load this pick. Try /watch again.")
		return watchCard(result.title as GuestTitle, country, {
			another: anotherId(options, id),
			origin: appOrigin(),
			emojis: await emojis(),
			episode,
			...(mine?.title ? { member: (mine.member ?? {}) as MemberMarks } : {}),
		})
	}
	const next = async () => {
		if (!memberId)
			return linkPromptCard(
				new URL("/discord/link", appOrigin()).href,
				"Link your account to see your next episodes with /next.",
			)
		const result = await deps.memberRead(memberId, "get_my_shows", {
			limit: 8,
		})
		const rows = (result.items ?? []) as (GuestTitle & {
			group?: string
			next_episode?: NextEpisode | null
		})[]
		const episodes = rows
			.filter(
				(row) =>
					["continue", "pick_up"].includes(row.group ?? "") && row.next_episode,
			)
			.slice(0, 8)
		const cards = episodes.map((row) => ({
			title: row,
			episode: row.next_episode!,
		}))
		return nextCard(cards, country, allServices())
	}

	const similar = async (id: string, share = false) => {
		const result = await read("get_similar_titles", {
			title_id: id,
			limit: 10,
		})
		const source = (result.source as { name?: string } | undefined)?.name
		return titleListCard(
			source ? `Similar to ${source}` : "Similar titles",
			(result.items ?? []) as GuestTitle[],
			{
				share,
				shareId: listCustomId("similar-share", id),
				subtitle: servicesNote(),
				emojis: await emojis(),
				ref: { kind: "similar", titleId: id },
			},
		)
	}
	const person = async (id: number, share = false) => {
		const result = await read("get_person", { person_id: id, limit: 10 })
		if (!result.person) return textCard("No matching person found.")
		const found = result.person as GuestPerson
		const [knownFor, ids] = await Promise.all([
			withDisplays(found.known_for ?? []),
			emojis(),
		])
		return personCard({ ...found, known_for: knownFor }, share, {
			note: allServices()
				? `Using every service in ${countryName(country)}`
				: undefined,
			emojis: ids,
		})
	}
	const hot = async (page = 0, share = false) => {
		const [titles, ids] = await Promise.all([deps.hot(), emojis()])
		return hotCard(await withDisplays(titles), { page, share, emojis: ids })
	}
	const searchList = async (
		key: string,
		page: number,
		share = false,
		initial?: DiscoverState,
	) => {
		const state = initial ?? (await deps.loadState(key))
		if (!state?.query || !state.search)
			return textCard("This search expired. Search again with /search.")
		const byId = new Map(state.search.titles.map((t) => [t.id, t]))
		const titles = state.search.ids.flatMap((id) => byId.get(id) ?? [])
		if (!titles.length)
			return textCard(
				`No titles match ${state.query}. Try another search.${readingLine(state.search.reading) ? `\n${readingLine(state.search.reading)}` : ""}${
					state.search.note ? `\n${state.search.note}` : ""
				}`,
			)
		return titleListCard(
			`Results for ${state.query}`,
			await withDisplays(titles.slice(page * 10, page * 10 + 10)),
			{
				share,
				stateKey: key,
				pageAction: "search",
				subtitle: [readingLine(state.search.reading), state.search.note]
					.filter(Boolean)
					.join("\n"),
				page,
				next: titles.length > (page + 1) * 10,
				total: titles.length,
				shareId: listCustomId("search-share", `${key}:${page}`),
				emojis: await emojis(),
				ref: { kind: "search", key, page },
			},
		)
	}
	/** The list a Back button returns to. */
	const backTo = (ref: ListRef) =>
		ref.kind === "discover"
			? discover(ref.key, ref.page)
			: ref.kind === "search"
				? searchList(ref.key, ref.page)
				: ref.kind === "similar"
					? similar(ref.titleId)
					: ref.kind === "person"
						? person(ref.personId)
						: ref.kind === "next"
							? next()
							: hot(ref.page)
	const discover = async (key: string, page: number, share = false) => {
		const state = await deps.loadState(key)
		if (!state)
			return textCard("This discovery expired. Start again with /discover.")
		const args = {
			...state.args,
			...(!state.args.providers?.length && viewer.services?.length
				? { providers: viewer.services }
				: {}),
			cursor: `offset:${page * 10}`,
			limit: 10,
		}
		const effectiveArgs = discoverArgs(args, !!memberId && !share)
		const result =
			memberId && !share
				? await deps.memberRead(memberId, "discover_titles", effectiveArgs)
				: await deps.read(
						viewer,
						"https://goodwatch.app",
						"discover_titles",
						effectiveArgs,
					)
		const sort = effectiveArgs.order
			? sortNames[effectiveArgs.order]
			: undefined
		return titleListCard(
			discoverHeading(state.args),
			(result.items ?? []) as GuestTitle[],
			{
				share,
				stateKey: key,
				page,
				next: !!result.next_cursor,
				total: typeof result.total === "number" ? result.total : undefined,
				shareId: listCustomId("discover-share", `${key}:${page}`),
				subtitle: [
					sort,
					!state.args.providers?.length && allServices()
						? `every service in ${countryName(country)}`
						: `streaming in ${countryName(country)}`,
				]
					.filter(Boolean)
					.join(" · "),
				emojis: await emojis(),
				ref: { kind: "discover", key, page },
			},
		)
	}
	const options = Object.fromEntries(
		(interaction.data?.options ?? []).map((o) => [
			o.name,
			String(o.value ?? ""),
		]),
	)
	const resolveTitle = async (input?: string) => {
		const value = (input ?? "").trim().slice(0, 120)
		if (!value) return undefined
		if (isTitleId(value)) return value
		const result = await read("search_titles", { query: value, limit: 25 })
		const items = (result.items ?? []) as GuestTitle[]
		return (
			items.find((t) => t.name.toLowerCase() === value.trim().toLowerCase()) ??
			items[0]
		)?.id
	}
	try {
		if (interaction.type === 1) {
			finish("ok")
			return { type: 1 }
		}
		const user = interaction.member?.user?.id ?? interaction.user?.id
		if (!user)
			return reply(textCard("This interaction has no user."), "invalid")
		const verdict = internal.retrying
			? null
			: await within<RateVerdict | null>(deps.take(user), 300, null)
		if (verdict === null && !internal.retrying) finish("limit_timeout")
		if (verdict && !verdict.allowed) {
			if (interaction.type === 4) return reply({ choices: [] }, "limited", 8)
			return reply(slowDownCard(verdict.retryAfterSeconds), "limited")
		}
		if (interaction.type === 3 && isRetryId(customId)) {
			const key = parseRetryId(customId)
			const entry = key
				? await within(
						deps.retryStore().then((store) => loadRetry(key, store)),
						800,
						undefined,
					).catch(() => undefined)
				: null
			if (entry === undefined)
				return reply(errorCard(ERROR_TEXT, customId), "retry_unavailable")
			if (!entry)
				return reply(
					textCard("This can't be retried anymore. Run the command again."),
					"retry_expired",
				)
			if (entry.user !== user)
				return reply(
					textCard("Only the person who ran this can try again."),
					"forbidden",
				)
			// The original command or press, as if it arrived now from the presser: their place, their token.
			return routeInteraction(
				{
					...interaction,
					type: entry.type,
					...(entry.id ? { id: entry.id } : {}),
					data: entry.data,
				},
				overrides,
				{ retrying: true },
			)
		}
		if (
			interaction.data?.name === "setup" ||
			(interaction.type === 3 &&
				/^setup:(clear|remove:[1-9]\d*|page:\d+)$/.test(customId))
		) {
			if (!canManageGuild(interaction))
				return interaction.type === 4
					? reply({ choices: [] }, "forbidden", 8)
					: reply(
							textCard(
								"You need Manage Server permission to change server setup.",
							),
							"forbidden",
						)
			if (interaction.type === 4)
				return reply(
					{
						choices: await within(
							setupAutocomplete(interaction, deps),
							2000,
							[],
						).catch(() => []),
					},
					"ok",
					8,
				)
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			return deferred(
				() => setup(interaction, deps),
				(body) =>
					deps.edit(interaction.application_id!, interaction.token!, body),
				finish,
				interaction.type === 3
					? { type: 7, loading: loading("Updating server setup…") }
					: { type: 5 },
			)
		}
		if (
			(interaction.type === 2 && interaction.data?.name === "together") ||
			(interaction.type === 3 && together)
		) {
			return handleTogether(interaction, user, finish, {
				edit: deps.edit,
				place: (starter) =>
					resolveViewerPlace(starter, { getGuild: deps.getGuild }),
				emojis: deps.emojis,
				retry: keepRetry,
				...deps.together,
			})
		}
		if (interaction.type === 4) {
			usePlace(
				await within(place(), 400, { viewer, memberId }).catch(() => ({
					viewer,
					memberId,
				})),
			)
			if (interaction.data?.name === "discover") {
				const focused = interaction.data.options?.find((o) => o.focused)
				if (!focused || !["genre", "service"].includes(focused.name))
					return reply({ choices: [] }, "unsupported", 8)
				const query = String(focused.value ?? "")
					.trim()
					.slice(0, 120)
					.toLowerCase()
				const filters = await within<Record<string, unknown>>(
					read("get_discover_filters", {}),
					1800,
					{},
				).catch((): Record<string, unknown> => ({}))
				const entries =
					focused.name === "genre"
						? ((filters.genres ?? []) as string[]).map((id) => ({
								name: id,
								value: id,
							}))
						: ((filters.providers ?? []) as { id: number; name: string }[]).map(
								(p) => ({ name: p.name, value: String(p.id) }),
							)
				return reply(
					{
						choices: entries
							.filter(
								(c) => query.length < 2 || c.name.toLowerCase().includes(query),
							)
							.slice(0, 25)
							.map((c) => ({ ...c, name: discordText(c.name).slice(0, 100) })),
					},
					"ok",
					8,
				)
			}
			const isPerson = interaction.data?.name === "person"
			if (
				!["search", "similar", "person", "rate", "seen"].includes(
					interaction.data?.name ?? "",
				)
			)
				return reply({ choices: [] }, "unsupported", 8)
			const query = String(
				interaction.data?.options?.find(
					(o) =>
						(isPerson
							? o.name === "name"
							: interaction.data?.name === "search"
								? ["query", "title"].includes(o.name)
								: o.name === "title") && o.focused,
				)?.value ?? "",
			)
				.trim()
				.slice(0, 120)
			if (query.length < 2) return reply({ choices: [] }, "ok", 8)
			const result = await within(
				read(isPerson ? "search_people" : "search_titles", {
					query,
					limit: 25,
				}),
				1800,
				{ items: [] },
			).catch(() => ({ items: [] }))
			const items = (result.items ?? []) as (GuestTitle & GuestPerson)[]
			return reply(
				{
					choices: items.slice(0, 25).map((t) => ({
						name: discordText(
							`${t.name}${t.year ? ` (${t.year})` : ""} · ${
								isPerson
									? "Person"
									: t.id.startsWith("movie:")
										? "Movie"
										: "TV show"
							}`,
						).slice(0, 100),
						value: isPerson ? String(t.person_id) : t.id,
					})),
				},
				"ok",
				8,
			)
		}
		const memberAction =
			parsed && ["want", "seen", "rate", "rate-submit"].includes(parsed.action)
				? parsed
				: null
		const writeCommand =
			interaction.type === 2 &&
			["rate", "seen"].includes(interaction.data?.name ?? "")
		if (
			writeCommand ||
			(interaction.type === 3 && (memberAction || undo)) ||
			(interaction.type === 5 && memberAction?.action === "rate-submit")
		) {
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			// Rate answers at once with the score menu: in place on a private card, as a new private message on a public one.
			if (interaction.type === 3 && memberAction?.action === "rate") {
				const linked = await within<string | null | undefined>(
					deps.linkedUser(user),
					400,
					undefined,
				)
				if (linked === undefined)
					return reply(
						textCard("Could not load your account. Please press Rate again."),
					)
				memberId = linked
				if (linked) {
					const result = await within(
						deps.memberRead(linked, "get_title", {
							title_id: memberAction.titleId,
						}),
						1500,
						null,
					)
					if (result?.title) {
						const onPublic =
							interaction.message != null &&
							!((interaction.message.flags ?? 0) & EPHEMERAL)
						const picker = ratePicker(
							result.title as GuestTitle,
							(result.member as MemberMarks)?.score,
							memberAction.back,
							await emojis(),
						)
						// An update keeps the message private already; Discord rejects the private flag on it.
						return onPublic
							? reply(picker)
							: reply({ ...picker, flags: picker.flags & ~EPHEMERAL }, "ok", 7)
					}
					return reply(
						errorCard(
							"Could not load this title. Please try again.",
							await keepRetry(),
						),
					)
				}
			}
			const publicMessage =
				interaction.message != null &&
				!((interaction.message.flags ?? 0) & EPHEMERAL)
			// The list the title was opened from: every result of a press on its card keeps Back to it.
			const back = memberAction?.back ?? undo?.back
			return deferred(
				async () => {
					// Do not treat a slow link lookup as a guest for writes or undo.
					memberId = await deps.linkedUser(user)
					if (!memberId)
						return undo
							? textCard("Only the person who made this change can undo it.")
							: linkPrompt(appOrigin())
					if (
						!interaction.id ||
						interaction.id.length > 65 ||
						!/^[A-Za-z0-9_-]+$/.test(interaction.id)
					)
						return textCard("Invalid interaction ID.")
					if (undo) {
						const result = await deps.write(
							memberId,
							appOrigin(),
							"undo_watch",
							{ action_id: interaction.id, batch_id: undo.batchId },
						)
						const summary = result.summary as Record<string, number> | undefined
						if (
							!["applied", "unchanged"].includes(String(result.outcome)) ||
							(summary &&
								(summary.partly_undone ||
									summary.changed_since ||
									summary.not_undoable ||
									summary.error))
						)
							return memberNote(
								String(result.message ?? "Could not undo this change."),
								back,
							)
						// Refresh state when the catalog read is available, retaining the undo acknowledgement.
						try {
							usePlace(await place())
							const refreshed = await card(undo.titleId, false, back)
							return message([
								{ type: 10, content: "Undone." },
								...refreshed.components,
							])
						} catch {
							/* The receipt remains undone if the refresh fails. */
						}
						return memberNote("Undone.", back)
					}
					const action = (
						memberAction?.action === "rate-submit"
							? "rate"
							: (memberAction?.action ?? interaction.data?.name)
					) as "rate" | "seen" | "want"
					const id =
						memberAction?.titleId ?? (await resolveTitle(options.title))
					if (!id)
						return textCard("No matching title found. Try another title.")
					const result = await deps.memberRead(memberId, "get_title", {
						title_id: id,
					})
					if (!result.title) return memberNote("No matching title found.", back)
					const title = result.title as GuestTitle
					const marks = result.member as MemberMarks | undefined
					const selected = interaction.data?.components
						?.flatMap((c) =>
							c.component ? [c.component] : (c.components ?? []),
						)
						.find((c) => c.custom_id === "score")?.values
					const picked =
						interaction.type === 3 ? interaction.data?.values : selected
					const score =
						memberAction?.action === "rate-submit"
							? Number(picked?.length === 1 ? picked[0] : NaN)
							: Number(options.score)
					if (
						action === "rate" &&
						(!Number.isInteger(score) || score < 1 || score > 10)
					)
						return memberNote("Choose a score from 1 to 10.", back)
					if (
						action === "seen" &&
						!writeCommand &&
						id.startsWith("movie:") &&
						(marks?.status === "seen" ||
							(marks?.watch_count ?? 0) > 0 ||
							marks?.score != null)
					)
						return memberNote(
							"Already seen. Use Undo on the earlier confirmation, or /seen to log a rewatch.",
							back,
						)
					const wanted = writeCommand || !marks?.want_to_see
					// Discord gives no timezone, so "today" is the UTC date.
					const item = {
						title_id: id,
						...(action === "rate"
							? { score }
							: action === "seen"
								? { date: new Date().toISOString().slice(0, 10) }
								: { want_to_see: wanted }),
					}
					const written = await deps.write(
						memberId,
						appOrigin(),
						action === "rate"
							? "rate_title"
							: action === "seen"
								? "log_watch"
								: "set_want_to_see",
						{ action_id: interaction.id, items: [item] },
					)
					const items = written.items as
						| {
								status?: string
								message?: string
								changes?: {
									score?: [unknown, number]
									want_to_see?: [unknown, boolean]
								}
						  }[]
						| undefined
					if (written.outcome !== "applied")
						return memberNote(
							String(
								items?.[0]?.message ?? written.message ?? "No change was made.",
							),
							back,
						)
					return writeConfirmation(
						title,
						String(written.batch_id),
						action,
						items?.[0]?.changes?.score?.[1] ?? score,
						items?.[0]?.changes?.want_to_see?.[1] ?? wanted,
						back,
					)
				},
				(body) =>
					deps.edit(interaction.application_id!, interaction.token!, body),
				finish,
				interaction.type === 3 && !publicMessage
					? {
							type: 7,
							loading: loading(
								undo
									? "Undoing…"
									: memberAction?.action === "want"
										? "Updating your Wishlist…"
										: memberAction?.action === "seen"
											? "Logging your watch…"
											: "Saving…",
							),
						}
					: { type: 5 },
			)
		}

		// /profile and its Share to channel: always the presser's own profile, never another Discord user's, so the bot
		// never tells a channel which Discord user is which GoodWatch member.
		const profileShare = list?.action === "profile-share" ? list.value : null
		if (
			(interaction.type === 2 && interaction.data?.name === "profile") ||
			(interaction.type === 3 && profileShare)
		) {
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			const choice = profileShare ?? (options.card || "profile")
			if (!isProfileCardChoice(choice))
				return reply(textCard("Choose a card from /profile."), "invalid")
			const linkReason =
				"Link your account to share your profile with /profile."
			const linkUrl = new URL("/discord/link", appOrigin()).href
			if (profileShare) {
				// The shared copy is a new public message, so it answers at once; the visibility check runs again because
				// the member may have hidden the part since the preview. A refusal stays private.
				const loaded = await within(
					(async () => {
						const id = await deps.linkedUser(user)
						return { id, profile: id ? await deps.memberProfile(id) : null }
					})(),
					2000,
					null,
				).catch(() => null)
				if (!loaded)
					return reply(
						textCard(
							"Could not load your profile. Please press Share to channel again.",
						),
						"timeout",
					)
				memberId = loaded.id
				if (!loaded.id || !loaded.profile)
					return reply(linkPromptCard(linkUrl, linkReason), "unlinked")
				const body = profileReply(loaded.profile, choice, {
					share: true,
					origin: appOrigin(),
				})
				return reply(body, body.flags & EPHEMERAL ? "refused" : "ok")
			}
			return deferred(
				async () => {
					// Do not treat a slow link lookup as a guest: a member would get the link prompt.
					memberId = await deps.linkedUser(user)
					if (!memberId) return linkPromptCard(linkUrl, linkReason)
					return profileReply(await deps.memberProfile(memberId), choice, {
						origin: appOrigin(),
					})
				},
				(body) =>
					deps.edit(interaction.application_id!, interaction.token!, body),
				finish,
				{ type: 5 },
			)
		}
		if (
			(interaction.type === 2 &&
				["link", "unlink"].includes(interaction.data?.name ?? "")) ||
			(interaction.type === 3 &&
				["gw:unlink:ask", "gw:unlink:yes", "gw:unlink:keep"].includes(
					interaction.data?.custom_id ?? "",
				))
		) {
			const { application_id: applicationId, token } = interaction
			if (!applicationId || !token)
				return reply(textCard("Invalid interaction."), "invalid")
			return deferred(
				async () => {
					memberId = await within(deps.linkedUser(user), 300, null).catch(
						() => null,
					)
					const action = interaction.data?.custom_id
					if (action === "gw:unlink:yes") {
						await deps.unlink({ byDiscordUserId: user })
						return textCard("Your Discord account is unlinked from GoodWatch.")
					}
					if (action === "gw:unlink:keep")
						return textCard("Your GoodWatch account stays linked.")
					if (!memberId) {
						const url = new URL("/discord/link", appOrigin())
						try {
							url.searchParams.set(
								"n",
								await deps.storeLinkMessage(applicationId, token),
							)
						} catch (error) {
							const nonce =
								error instanceof Error &&
								"nonce" in error &&
								typeof error.nonce === "string" &&
								/^[A-Za-z0-9_-]{24}$/.test(error.nonce)
									? error.nonce
									: "unavailable"
							deps.log(`discord link message storage failed nonce=${nonce}`)
						}
						return linkPromptCard(url.href)
					}
					const confirming =
						interaction.data?.name === "unlink" || action === "gw:unlink:ask"
					if (!confirming)
						return linkedCard(
							await deps.memberHandle(memberId).catch(() => null),
						)
					return message([
						{ type: 10, content: "Unlink your GoodWatch account?" },
						{
							type: 1,
							components: [
								{
									type: 2,
									style: 4,
									label: "Unlink",
									custom_id: "gw:unlink:yes",
								},
								{
									type: 2,
									style: 2,
									label: "Keep",
									custom_id: "gw:unlink:keep",
								},
							],
						},
					])
				},
				(body) => deps.edit(applicationId, token, body),
				finish,
				{
					type:
						interaction.type === 3 &&
						(!interaction.message ||
							(interaction.message.flags ?? 0) & EPHEMERAL)
							? 6
							: 5,
				},
			)
		}
		if (
			interaction.type === 2 &&
			commands.some((c) => c.name === interaction.data?.name)
		) {
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			const progressAbort = new AbortController()
			let finalBody: unknown
			let finalRequested = false
			let pendingProgress = Promise.resolve()
			const progressStarted = Date.now()
			return deferred(
				async () => {
					usePlace(await place())
					switch (interaction.data?.name) {
						case "search": {
							// A chosen suggestion is a title ID and opens its card; free text answers with the results.
							const value = (options.query ?? options.title ?? "")
								.trim()
								.slice(0, 120)
							if (!value)
								return textCard("No matching title found. Try another title.")
							if (isTitleId(value)) return card(value)
							const result = await deps.searchTitles(value, user, (reading) => {
								if (finalRequested) return
								const body = textCard(
									`${listHeading(`Results for ${value}`)}\n${readingLine(
										reading,
									)}\n\nFinding matching movies and shows…`,
								)
								// Serialize progress, then let the final edit drain it before sending results.
								pendingProgress = pendingProgress
									.then(async () => {
										if (internal.retrying) {
											const wait =
												LOADING_MIN_MS - (Date.now() - progressStarted)
											if (wait > 0)
												await new Promise((resolve) =>
													setTimeout(resolve, wait),
												)
										}
										if (progressAbort.signal.aborted) return
										return deps.edit(
											interaction.application_id!,
											interaction.token!,
											body,
											progressAbort.signal,
										)
									})
									.then(() => {
										// Restore results if progress outlives the bounded wait and ignores abort.
										if (finalBody)
											return deps.edit(
												interaction.application_id!,
												interaction.token!,
												finalBody,
											)
									})
									.catch(() => {})
							})
							const titles = result.titles.slice(0, 100)
							const state = {
								args: {},
								query: value,
								search: {
									ids: titles.map((t) => t.id),
									titles,
									note: result.note,
									reading: result.reading,
								},
							}
							const key = await deps.saveState(state)
							return searchList(key, 0, false, state)
						}
						case "watch": {
							const filters = watchOptions(options.type, options.mood)
							return filters
								? watch(filters)
								: textCard("Choose a type and mood from /watch.")
						}
						case "next":
							return next()
						case "similar": {
							const id = await resolveTitle(options.title ?? "")
							return id
								? similar(id)
								: textCard("No matching title found. Try another title.")
						}
						case "person": {
							const name = (options.name ?? "").trim().slice(0, 120)
							if (!name) return textCard("No matching person found.")
							let id = /^[1-9]\d{0,9}$/.test(name) ? Number(name) : 0
							if (!id) {
								const result = await read("search_people", {
									query: name,
									limit: 25,
								})
								const people = (result.items ?? []) as GuestPerson[]
								id =
									(
										people.find(
											(p) => p.name.toLowerCase() === name.toLowerCase(),
										) ?? people[0]
									)?.person_id ?? 0
							}
							return id ? person(id) : textCard("No matching person found.")
						}
						case "hot":
							return hot(0)
						case "discover": {
							const args: Parameters<typeof readGuestTool>[3] = {}
							if (options.type && options.type !== "any")
								args.type = options.type as "movie" | "show"
							if (options.mood)
								args.moods = [
									options.mood as NonNullable<typeof args.moods>[number],
								]
							for (const name of [
								"theme",
								"style",
								"released",
								"score",
								"anime",
								"length",
							]) {
								const value = options[name]
								if (!value) continue
								const option = commands
									.find((c) => c.name === "discover")!
									.options.find((o) => o.name === name) as {
									choices: { value: string }[]
								}
								if (!option.choices.some((choice) => choice.value === value))
									return textCard("Choose filters from /discover.")
							}
							if (options.theme)
								args.themes = [
									options.theme as NonNullable<typeof args.themes>[number],
								]
							if (options.style)
								args.styles = [
									options.style as NonNullable<typeof args.styles>[number],
								]
							if (options.released)
								args.released = options.released as typeof args.released
							if (options.score) args.minimum_score = Number(options.score)
							if (options.anime) args.anime = options.anime as typeof args.anime
							if (options.length === "short") args.max_runtime = 99
							if (options.length === "medium") args.max_runtime = 119
							if (options.length === "long") args.min_runtime = 120
							if (options.genre) args.genres = [options.genre]
							if (options.sort) args.order = options.sort as typeof args.order
							if (options.genre || options.service) {
								const filters = await read("get_discover_filters", {})
								if (filters.status === "data_unavailable")
									return textCard(
										"Discover is starting up. Try again in a minute.",
									)
								if (
									options.genre &&
									!(filters.genres as string[] | undefined)?.includes(
										options.genre,
									)
								)
									return textCard(
										`That genre is unavailable in ${country}. Choose a genre from /discover autocomplete.`,
									)
								if (options.service) {
									const provider = (
										filters.providers as
											| { id: number; name: string }[]
											| undefined
									)?.find((p) => String(p.id) === options.service)
									if (!provider)
										return textCard(
											`That service is unavailable in ${country}. Choose a service from /discover autocomplete.`,
										)
									args.providers = [provider.id]
								}
							}
							const key = await deps.saveState({
								args: discoverArgs(args, !!memberId),
							})
							return discover(key, 0)
						}
						default:
							return textCard("Unsupported command.")
					}
				},
				async (body) => {
					finalRequested = true
					await within(pendingProgress, 1500, undefined).catch(() => {})
					progressAbort.abort()
					finalBody = body
					return deps.edit(
						interaction.application_id!,
						interaction.token!,
						body,
					)
				},
				finish,
			)
		}
		if (interaction.type === 3 && (parsed || list || another)) {
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			/** What this press loads, for the loading line: "Similar", the chosen title, "the next page". */
			const pressLoads = () =>
				another
					? "another pick"
					: parsed?.action === "similar"
						? "Similar"
						: parsed
							? "the title"
							: list?.action === "open"
								? pressed("the title")
								: list?.action === "back"
									? "the list"
									: pressed("the page")
			const share =
				parsed?.action === "share" || list?.action.endsWith("-share")
			const publicMessage =
				interaction.message != null &&
				!((interaction.message.flags ?? 0) & EPHEMERAL)
			return deferred(
				async () => {
					usePlace(await place())
					if (another) return watch(another)
					if (parsed) {
						if (parsed.action === "similar") return similar(parsed.titleId)
						if (parsed.action === "country") {
							const selected = interaction.data?.values?.[0] ?? ""
							const current = interaction.message?.components
							const offered = (components: Component[]): boolean =>
								components.some(
									(c) =>
										(c.custom_id === customId &&
											(c.options as { value: string }[] | undefined)?.some(
												(o) => o.value === selected,
											)) ||
										offered(c.components ?? []),
								)
							return /^[A-Z]{2}$/.test(selected) &&
								(CARD_COUNTRIES.some((code) => code === selected) ||
									offered(current ?? []))
								? card(parsed.titleId, false, parsed.back, selected)
								: textCard("Choose a country from the menu.")
						}
						// "watch" is the old Where to watch button: its card now shows the links itself.
						return card(parsed.titleId, !!share, parsed.back, parsed.country)
					}
					if (list?.action === "open") {
						const id = interaction.data?.values?.[0] ?? ""
						return isTitleId(id)
							? card(id, false, parseListRef(list.value) ?? undefined)
							: textCard("Invalid title selection.")
					}
					if (list?.action === "back") {
						const ref = parseListRef(list.value)
						return ref ? backTo(ref) : textCard("Unsupported action.")
					}
					if (list?.action === "similar-share") return similar(list.value, true)
					if (list?.action === "person-share")
						return person(Number(list.value), true)
					if (list?.action === "hot" || list?.action === "hot-share")
						return hot(
							list.value === "now" ? 0 : Number(list.value),
							list.action === "hot-share",
						)
					if (list?.action === "search" || list?.action === "search-share") {
						const [key, page] = list.value.split(":")
						return searchList(key, Number(page), !!share)
					}
					if (
						list?.action === "discover" ||
						list?.action === "discover-share"
					) {
						const [key, page] = list.value.split(":")
						return discover(key, Number(page), !!share)
					}
					return textCard("Unsupported action.")
				},
				(body) =>
					deps.edit(
						interaction.application_id ?? "",
						interaction.token ?? "",
						body,
					),
				finish,
				share || publicMessage
					? { type: 5, ephemeral: !share && publicMessage }
					: { type: 7, loading: loading(loadingLine(pressLoads())) },
			)
		}
		return reply(
			textCard(
				interaction.type === 5
					? "This form is no longer supported. Try /search."
					: "This interaction is not supported. Try /search.",
			),
			"unsupported",
		)
	} catch {
		if (interaction.type === 4) return reply({ choices: [] }, "error", 8)
		return reply(errorCard(ERROR_TEXT, await keepRetry()), "error")
	}
}

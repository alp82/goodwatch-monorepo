import { randomUUID } from "node:crypto"
import { McpServer } from "@modelcontextprotocol/server"
import * as z from "zod"
import {
	getMember,
	isSeen,
	libraryEntry,
	page,
	progress,
	resolveTitle,
	showState,
	summary,
	titles,
	type Member,
	type ShowStatus,
	type Title,
	type TitleInput,
	type Watch,
} from "./fixtures.server"

export const writeTools = new Set([
	"log_watch",
	"rate_title",
	"set_want_to_see",
	"set_not_interested",
	"set_show_status",
	"undo_watch",
	"set_my_services",
])
const selector = {
	title_id: z
		.string()
		.regex(/^(movie|show):[1-9]\d*$/)
		.optional()
		.describe("Catalog title ID, for example movie:603 or show:1399."),
	title_name: z
		.string()
		.trim()
		.min(1)
		.max(120)
		.optional()
		.describe(
			"Title name or alias. Multiple matches return candidates without writing.",
		),
	year: z
		.number()
		.int()
		.min(1800)
		.max(2100)
		.optional()
		.describe("Optional year to disambiguate a name."),
}
const paging = {
	cursor: z
		.string()
		.regex(/^offset:[0-9]{1,8}$/)
		.optional(),
	limit: z.number().int().min(1).max(20).default(20),
}
const confirmation = {
	confirmation_id: z
		.string()
		.uuid()
		.optional()
		.describe(
			"Identifier of a previously returned confirmation preview for this exact operation.",
		),
}
const selectedTitle = z
	.object(selector)
	.strict()
	.refine(
		(input) => Boolean(input.title_id) !== Boolean(input.title_name),
		"Exactly one of title_id or title_name is required",
	)
const titleSchema = <T extends z.ZodRawShape>(extra: T) =>
	selectedTitle.safeExtend(extra)
type Args = TitleInput & {
	cursor?: string
	limit?: number
	query?: string
	filter?: string
	season?: number
	episode?: number
	date?: string
	action_id?: string
	score?: number | null
	want_to_see?: boolean
	not_interested?: boolean
	status?: ShowStatus
	watch_id?: string
	confirmation_id?: string
	country?: string
	services?: string[]
}
type Data = Record<string, unknown>
const error = (status: string, message: string): Data => ({ status, message })
const available = (member: Member, title: Title) =>
	["DE", "US", "GB"].includes(member.country) &&
	title.services.some((service) => member.services.includes(service))

function read(member: Member, name: string, args: Args, origin: string): Data {
	if (name === "search_titles") {
		const query = (args.query ?? "").trim().toLowerCase()
		const day = new Date().toISOString().slice(0, 10)
		if (member.search.day !== day)
			member.search = { day, chargedQueries: new Set() }
		if (!member.search.chargedQueries.has(query)) {
			if (member.search.chargedQueries.size >= 20)
				return {
					status: "search_quota_exceeded",
					limit: 20,
					period: "UTC day",
					paid: false,
				}
			member.search.chargedQueries.add(query)
		}
		const matches = titles.filter((title) =>
			[title.name, ...title.aliases].some((label) =>
				label.toLowerCase().includes(query),
			),
		)
		return {
			...page(
				matches.map((title) => summary(title, origin)),
				args.cursor,
				args.limit,
			),
			search_budget: {
				remaining: 20 - member.search.chargedQueries.size,
				paid: false,
			},
		}
	}
	if (name === "get_title" || name === "get_show_progress") {
		const resolved = resolveTitle(args, origin)
		if (!resolved.title) return resolved.result!
		const title = resolved.title
		if (name === "get_title")
			return {
				title: {
					...summary(title, origin),
					synopsis: title.synopsis,
					genres: title.genres,
					seasons: [
						...new Set(title.episodes.map((episode) => episode.season)),
					],
					availability: {
						country: member.country,
						services: available(member, title)
							? title.services.filter((service) =>
									member.services.includes(service),
								)
							: [],
						fixture: true,
					},
				},
				member: libraryEntry(member, title, origin),
			}
		if (title.kind !== "show")
			return error("invalid_title_kind", "Show progress requires a show")
		return {
			title: summary(title, origin),
			...progress(member, title),
			watches: page(
				member.watches.filter((watch) => watch.title_id === title.id),
				args.cursor,
				args.limit,
			),
		}
	}
	if (name === "get_my_shows") {
		const shows = titles.filter(
			(title) =>
				title.kind === "show" &&
				showState(member, title.id).status !== "Not started",
		)
		return page(
			shows.map((title) => libraryEntry(member, title, origin)),
			args.cursor,
			args.limit,
		)
	}
	if (name === "get_library") {
		const marked = titles.filter(
			(title) =>
				member.ratings[title.id] !== undefined ||
				member.wishlist.has(title.id) ||
				member.notInterested.has(title.id) ||
				member.watches.some((watch) => watch.title_id === title.id) ||
				showState(member, title.id).status !== "Not started",
		)
		const matches = marked.filter((title) => {
			switch (args.filter) {
				case "want_to_see":
					return member.wishlist.has(title.id)
				case "seen":
					return isSeen(member, title)
				case "not_interested":
					return member.notInterested.has(title.id)
				case "rated":
					return member.ratings[title.id] !== undefined
				default:
					return true
			}
		})
		return {
			...page(
				matches.map((title) => libraryEntry(member, title, origin)),
				args.cursor,
				args.limit,
			),
			settings: { country: member.country, services: member.services },
		}
	}
	if (name === "get_taste") {
		const genres = new Map<string, { sum: number; count: number }>()
		for (const title of titles) {
			const score = member.ratings[title.id]
			if (score === undefined) continue
			for (const genre of title.genres) {
				const value = genres.get(genre) ?? { sum: 0, count: 0 }
				value.sum += score
				value.count++
				genres.set(genre, value)
			}
		}
		return {
			rated_titles: Object.keys(member.ratings).length,
			wishlist_titles: member.wishlist.size,
			genres: [...genres]
				.map(([genre, value]) => ({
					genre,
					mean_score: Math.round((value.sum / value.count) * 10) / 10,
				}))
				.sort((a, b) => b.mean_score - a.mean_score),
			method: "fixture genre averages; no fingerprint model",
		}
	}
	const watching = titles
		.filter(
			(title) =>
				title.kind === "show" &&
				showState(member, title.id).status === "Watching" &&
				progress(member, title).next_episode,
		)
		.sort(
			(a, b) =>
				showState(member, b.id).activity - showState(member, a.id).activity,
		)
	const candidates = [
		...watching,
		...titles.filter(
			(title) => member.wishlist.has(title.id) && title.kind === "movie",
		),
		...titles.filter(
			(title) => member.wishlist.has(title.id) && title.kind === "show",
		),
	]
	const title = candidates.find(
		(item) =>
			!member.notInterested.has(item.id) &&
			showState(member, item.id).status !== "Dropped" &&
			available(member, item),
	)
	return {
		pick: title ? summary(title, origin) : null,
		next_episode:
			title?.kind === "show" ? progress(member, title).next_episode : null,
		reason: title
			? watching.includes(title)
				? "continue_watching"
				: "wishlist"
			: "no_fixture_offer_on_my_services",
		country: member.country,
		services: member.services,
	}
}

function approval(
	member: Member,
	key: string,
	args: Args,
	preview: Data,
): Data | undefined {
	const now = Date.now()
	for (const [id, pending] of member.confirmations)
		if (pending.expires < now) member.confirmations.delete(id)
	if (args.confirmation_id) {
		const pending = member.confirmations.get(args.confirmation_id)
		if (!pending || pending.key !== key || pending.revision !== member.revision)
			return error(
				"confirmation_invalid",
				"The preview expired, changed, belongs to another member, or predates another write",
			)
		member.confirmations.delete(args.confirmation_id)
		return
	}
	if (member.confirmations.size >= 20)
		member.confirmations.delete(member.confirmations.keys().next().value!)
	const id = randomUUID()
	member.confirmations.set(id, {
		key,
		revision: member.revision,
		expires: now + 5 * 60_000,
	})
	return {
		status: "confirmation_required",
		confirmation_id: id,
		preview,
		expires_in_seconds: 300,
	}
}
function addWatch(
	member: Member,
	title: Title,
	args: Args,
	origin: Watch["origin"] = "single",
) {
	const watch: Watch = {
		watch_id: `watch-${++member.sequence}`,
		title_id: title.id,
		season: title.kind === "show" ? args.season! : null,
		episode: title.kind === "show" ? args.episode! : null,
		date: args.date ?? null,
		date_precision: args.date ? "day" : "unknown",
		origin,
		pass: showState(member, title.id).pass,
	}
	member.watches.push(watch)
	return watch
}
function write(member: Member, name: string, args: Args, origin: string): Data {
	if (name === "set_my_services") {
		const services = [...new Set(args.services!)].sort()
		if (
			args.country === member.country &&
			JSON.stringify(services) === JSON.stringify([...member.services].sort())
		)
			return {
				status: "unchanged",
				country: member.country,
				services: member.services,
			}
		const key = JSON.stringify([name, args.country, services])
		if (
			args.country !== member.country ||
			member.services.some((service) => !services.includes(service))
		) {
			const pending = approval(member, key, args, {
				before: { country: member.country, services: member.services },
				after: { country: args.country, services },
			})
			if (pending) return pending
		}
		member.country = args.country!
		member.services = services
		member.revision++
		return {
			status: "updated",
			country: member.country,
			services: member.services,
		}
	}
	const resolved = resolveTitle(args, origin)
	if (!resolved.title) return resolved.result!
	const title = resolved.title
	const state = showState(member, title.id)
	const view = () => libraryEntry(member, title, origin)
	const semantic = {
		...args,
		title_id: title.id,
		title_name: undefined,
		year: undefined,
		confirmation_id: undefined,
	}
	const key = JSON.stringify([
		name,
		Object.fromEntries(
			Object.entries(semantic).sort(([a], [b]) => a.localeCompare(b)),
		),
	])
	if (name === "log_watch") {
		const previous = member.actions.get(args.action_id!)
		if (previous)
			return previous.key === key
				? {
						status: "already_applied",
						watch:
							member.watches.find(
								(watch) => watch.watch_id === previous.watchId,
							) ?? null,
						title: view(),
					}
				: error(
						"action_id_conflict",
						"This operation ID was already used for a different watch",
					)
		if (args.date && args.date > new Date().toISOString().slice(0, 10))
			return error("invalid_watch_date", "A watch date cannot be in the future")
		if (
			title.kind === "show" &&
			!title.episodes.some(
				(episode) =>
					episode.season === args.season && episode.episode === args.episode,
			)
		)
			return {
				status: "invalid_episode",
				seasons: [...new Set(title.episodes.map((episode) => episode.season))],
				total_episodes: title.episodes.length,
			}
		if (
			title.kind === "movie" &&
			(args.season !== undefined || args.episode !== undefined)
		)
			return error("invalid_episode", "Movies have no season or episode")
		// A real movie watch replaces the undated watch owned by a score.
		member.watches = member.watches.filter(
			(watch) => !(watch.title_id === title.id && watch.origin === "score"),
		)
		const watch = addWatch(member, title, args)
		member.actions.set(args.action_id!, { key, watchId: watch.watch_id })
		member.notInterested.delete(title.id)
		member.wishlist.delete(title.id)
		if (title.kind === "show")
			member.shows[title.id] = {
				...state,
				status: progress(member, title).next_episode ? "Watching" : "Seen",
				activity: member.sequence,
			}
		member.revision++
		return {
			status: "logged",
			watch,
			title: view(),
			presentation_version: title.kind === "show" ? "fixture-v1" : null,
		}
	}
	if (name === "rate_title") {
		if ((member.ratings[title.id] ?? null) === args.score)
			return { status: "unchanged", title: view() }
		if (args.score === null) {
			const pending = approval(member, key, args, {
				title: summary(title, origin),
				previous_score: member.ratings[title.id],
				score: null,
			})
			if (pending) return pending
		}
		if (args.score === null) {
			delete member.ratings[title.id]
			member.watches = member.watches.filter(
				(watch) => !(watch.title_id === title.id && watch.origin === "score"),
			)
			if (title.kind === "movie" && !isSeen(member, title))
				member.wishlist.delete(title.id)
		} else {
			member.ratings[title.id] = args.score!
			member.notInterested.delete(title.id)
			if (title.kind === "movie" && !isSeen(member, title)) {
				addWatch(member, title, {}, "score")
				member.wishlist.delete(title.id)
			}
		}
	} else if (name === "set_want_to_see") {
		if (member.wishlist.has(title.id) === args.want_to_see)
			return { status: "unchanged", title: view() }
		if (!args.want_to_see) {
			const pending = approval(member, key, args, {
				title: summary(title, origin),
				want_to_see: false,
			})
			if (pending) return pending
		}
		if (
			args.want_to_see &&
			title.kind === "show" &&
			state.status === "Dropped" &&
			member.watches.some((watch) => watch.title_id === title.id)
		) {
			return error(
				"invalid_transition",
				"A started Dropped show must be resumed before adding Want to See",
			)
		}
		if (args.want_to_see) {
			member.wishlist.add(title.id)
			member.notInterested.delete(title.id)
			if (title.kind === "show" && state.status === "Dropped")
				member.shows[title.id] = {
					...state,
					status: member.watches.some((watch) => watch.title_id === title.id)
						? "Watching"
						: "Not started",
					activity: ++member.sequence,
				}
		} else member.wishlist.delete(title.id)
	} else if (name === "set_not_interested") {
		if (member.notInterested.has(title.id) === args.not_interested)
			return { status: "unchanged", title: view() }
		if (
			args.not_interested &&
			(isSeen(member, title) ||
				member.ratings[title.id] !== undefined ||
				(title.kind === "show" && state.status !== "Not started"))
		)
			return error(
				"invalid_transition",
				"Not interested requires an unseen, unrated title; a started show can be Dropped",
			)
		if (args.not_interested && member.wishlist.has(title.id)) {
			const pending = approval(member, key, args, {
				title: summary(title, origin),
				not_interested: true,
				remove_from_wishlist: true,
			})
			if (pending) return pending
		}
		if (args.not_interested) {
			member.notInterested.add(title.id)
			member.wishlist.delete(title.id)
		} else member.notInterested.delete(title.id)
	} else if (name === "set_show_status") {
		if (title.kind !== "show")
			return error("invalid_title_kind", "Show status requires a show")
		if (state.status === args.status)
			return { status: "unchanged", title: view() }
		if (
			args.status === "Not started" &&
			member.watches.some((watch) => watch.title_id === title.id)
		)
			return error(
				"invalid_transition",
				"Existing watches cannot be reset through a status setter",
			)
		if (
			args.status === "On hold" &&
			(state.status === "Not started" ||
				(state.status === "Seen" && !progress(member, title).next_episode))
		)
			return error(
				"invalid_transition",
				"On hold requires a started show with an episode left",
			)
		if (state.status === "Seen" && args.status === "Watching")
			return error(
				"invalid_transition",
				"A new rewatch pass is outside this fixture spike",
			)
		if (
			args.status === "Dropped" &&
			state.status === "Seen" &&
			!progress(member, title).next_episode
		) {
			return error(
				"invalid_transition",
				"A Seen show needs a new episode before it can be Dropped",
			)
		}
		if (args.status === "Seen" || args.status === "Dropped") {
			const pending = approval(member, key, args, {
				title: summary(title, origin),
				before: state.status,
				after: args.status,
				bulk_watches: args.status === "Seen",
				remove_from_wishlist: member.wishlist.has(title.id),
			})
			if (pending) return pending
		}
		if (args.status === "Seen")
			for (const episode of title.episodes)
				if (
					!member.watches.some(
						(watch) =>
							watch.title_id === title.id &&
							watch.pass === state.pass &&
							watch.season === episode.season &&
							watch.episode === episode.episode,
					)
				)
					addWatch(member, title, episode, "seen")
		member.shows[title.id] = {
			...state,
			status: args.status!,
			activity: ++member.sequence,
		}
		member.notInterested.delete(title.id)
		if (
			args.status === "Dropped" ||
			args.status === "Seen" ||
			state.status === "Seen"
		)
			member.wishlist.delete(title.id)
	} else if (name === "undo_watch") {
		const watch = args.watch_id
			? member.watches.find(
					(watch) =>
						watch.title_id === title.id && watch.watch_id === args.watch_id,
				)
			: [...member.watches]
					.reverse()
					.find(
						(watch) => watch.title_id === title.id && watch.origin === "single",
					)
		if (!watch)
			return error(
				"watch_not_found",
				"No matching member-logged watch exists for this title",
			)
		if (watch.origin !== "single")
			return error(
				"invalid_watch_origin",
				"This tool removes only individually logged watches; a score watch is removed by clearing the score",
			)
		const after = {
			...member,
			watches: member.watches.filter(
				(item) => item.watch_id !== watch.watch_id,
			),
		}
		const pending = approval(
			member,
			JSON.stringify([name, title.id, watch.watch_id]),
			args,
			{
				title: summary(title, origin),
				watch,
				after_next_episode:
					title.kind === "show" ? progress(after, title).next_episode : null,
			},
		)
		if (pending) return pending
		member.watches = member.watches.filter(
			(item) => item.watch_id !== watch.watch_id,
		)
		if (title.kind === "show" && ["Watching", "Seen"].includes(state.status))
			member.shows[title.id] = {
				...state,
				status: member.watches.some(
					(watch) => watch.title_id === title.id && watch.pass === state.pass,
				)
					? "Watching"
					: "Not started",
			}
		if (
			title.kind === "movie" &&
			member.ratings[title.id] !== undefined &&
			!isSeen(member, title)
		)
			addWatch(member, title, {}, "score")
		if (
			!isSeen(member, title) &&
			(title.kind === "movie" || state.status === "Seen")
		)
			member.wishlist.delete(title.id)
		member.revision++
		return { status: "removed", removed_watch: watch, title: view() }
	}
	member.revision++
	return { status: "updated", title: view() }
}

export function createToolServer(
	memberId: string,
	origin: string,
	onCall: (tool: string, status: unknown) => void = () => {},
) {
	const member = getMember(memberId)
	const server = new McpServer({
		name: "goodwatch-tool-set-spike",
		version: "0.0.2",
	})
	function register(
		name: string,
		title: string,
		description: string,
		inputSchema: z.ZodType<Args>,
		destructive = false,
	) {
		const writable = writeTools.has(name)
		server.registerTool(
			name,
			{
				title,
				description,
				inputSchema,
				annotations: {
					readOnlyHint: !writable,
					destructiveHint: destructive,
					idempotentHint: true,
					openWorldHint: false,
				},
			},
			async (args) => {
				const data = writable
					? write(member, name, args, origin)
					: read(member, name, args, origin)
				onCall(name, data.status ?? "read")
				const structuredContent = {
					fixture: true,
					member_id: memberId,
					...data,
				}
				return {
					content: [
						{ type: "text" as const, text: JSON.stringify(structuredContent) },
					],
					structuredContent,
					isError:
						typeof data.status === "string" &&
						[
							"title_not_found",
							"invalid_title_kind",
							"invalid_episode",
							"invalid_transition",
							"invalid_watch_origin",
							"invalid_watch_date",
							"watch_not_found",
							"confirmation_invalid",
							"action_id_conflict",
							"search_quota_exceeded",
						].includes(data.status),
				}
			},
		)
	}
	register(
		"search_titles",
		"Search titles",
		"Search the fictional catalog by name, with pages up to 20 and a simulated per-member search budget.",
		z.object({ query: z.string().trim().max(120), ...paging }),
	)
	register(
		"get_title",
		"Get a title",
		"Read a fictional title's details, fixture offers, and the member's current marks.",
		titleSchema({}),
	)
	register(
		"get_my_shows",
		"Get my shows",
		"Read the member's fictional show states and next episodes.",
		z.object(paging),
	)
	register(
		"get_show_progress",
		"Get show progress",
		"Read a fictional show's current pass, episode progress and paged watch records.",
		titleSchema(paging),
	)
	register(
		"get_tonight",
		"Get tonight's pick",
		"Choose a fictional next episode or Wishlist title on the member's saved services.",
		z.object({}),
	)
	register(
		"get_library",
		"Get my library",
		"Read the member's marked titles, including scores, Wishlist and watch progress.",
		z.object({
			filter: z
				.enum(["all", "want_to_see", "seen", "not_interested", "rated"])
				.default("all"),
			...paging,
		}),
	)
	if (member.flags.REC_MCP_TASTE)
		register(
			"get_taste",
			"Get my taste",
			"Read fixture genre averages from the member's ratings and the Wishlist count.",
			z.object({}),
		)
	register(
		"log_watch",
		"Log a watch",
		"Record one fictional movie or episode watch. An omitted date remains unknown; the operation ID deduplicates retries.",
		titleSchema({
			season: z.number().int().min(1).optional(),
			episode: z.number().int().min(1).optional(),
			date: z.iso.date().optional(),
			action_id: z
				.string()
				.min(1)
				.max(100)
				.describe(
					"Stable ID for this watch operation; another viewing has a different ID.",
				),
		}),
	)
	register(
		"rate_title",
		"Rate a title",
		"Set a fictional title's score from 1 to 10, or clear it with null. Clearing returns a confirmation preview.",
		titleSchema({
			score: z.number().int().min(1).max(10).nullable(),
			...confirmation,
		}),
		true,
	)
	register(
		"set_want_to_see",
		"Set Want to See",
		"Set or remove a fictional title on the member's Wishlist. Removal returns a confirmation preview.",
		titleSchema({ want_to_see: z.boolean(), ...confirmation }),
		true,
	)
	register(
		"set_not_interested",
		"Set Not interested",
		"Set or clear Not interested for an unseen, unrated fictional title. Removing an existing Wishlist entry returns a confirmation preview.",
		titleSchema({ not_interested: z.boolean(), ...confirmation }),
		true,
	)
	register(
		"set_show_status",
		"Set show status",
		"Set a fictional show's stored status. Dropped and bulk Seen return confirmation previews; watch history is retained.",
		titleSchema({
			status: z.enum(["Not started", "Watching", "On hold", "Dropped", "Seen"]),
			...confirmation,
		}),
		true,
	)
	register(
		"undo_watch",
		"Remove a watch",
		"Remove a specific member-logged fictional watch, or the last individually logged watch for a title, after a confirmation preview.",
		titleSchema({ watch_id: z.string().min(1).optional(), ...confirmation }),
		true,
	)
	register(
		"set_my_services",
		"Set my country and services",
		"Replace the member's country and fixture streaming services. Country changes and removed services return a confirmation preview.",
		z.object({
			country: z.string().regex(/^[A-Z]{2}$/),
			services: z
				.array(z.enum(["netflix", "prime_video", "disney_plus"]))
				.max(3),
			...confirmation,
		}),
		true,
	)
	return server
}

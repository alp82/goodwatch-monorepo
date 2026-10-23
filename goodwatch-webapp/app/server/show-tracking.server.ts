import { overlayEpisodeText } from "./episode-text-overlay.server.ts"
// Episode tracking on the show page, on the server (#384): what a member's show page reads, and the actions it
// sends. Both go through tracking.server.ts; this adds what the page needs around them: IMDb's episode ratings
// beside the episodes, whether the show still runs, the stored rows of an action for the browser to take over, and
// what an Undo puts back.
import { z } from "zod"
import { matchEpisodeRatings } from "~/domain/tracking/episode-ratings"
import {
	STATES,
	isDay,
	utcDay,
	showAiredBy,
	groupWatchId,
} from "~/domain/tracking/machine"
import type {
	ActionAnswer,
	PageAction,
	Restore,
	ShowTrackingPage,
} from "~/domain/tracking/show-page"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { getEpisodeGrid } from "~/server/episode-grid.server"
import { getEpisodePresentation } from "~/server/episode-presentation.server"
import { getEpisodeScores } from "~/server/episode-scores.server"
import { updateNotInterested } from "~/server/not-interested.server"
import {
	type TrackedTitle,
	applyTrackingEvent,
	getEpisodeList,
	getShowTracking,
} from "~/server/tracking.server"
import { updateWishList } from "~/server/wishList.server"
import { query } from "~/utils/crate"
import { canonicalTitleId } from "~/utils/title-identity"

// ---------------------------------------------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------------------------------------------

type GridLoader = (showId: number) => Promise<EpisodeGrid | null>

const loadGrid: GridLoader = (showId) =>
	getEpisodeGrid({ showId: String(showId) })

/** TMDB's statuses of a show that has no more episodes to come. */
const OVER = ["Ended", "Canceled"]

async function isRunning(showId: number): Promise<boolean> {
	const [show] = await query<{ status: string | null }>(
		"SELECT status FROM show WHERE tmdb_id = ?",
		[showId],
	)
	return Boolean(show?.status) && !OVER.includes(show.status as string)
}

/**
 * A show's tracking for one member: their state row, their watches, and the episode list with air dates and
 * IMDb's ratings. A show without an episode list has no episodes; the page then offers no episode tracking.
 *
 * The ratings come from the episode grid's data, which is in IMDb's numbering, and are matched to the listed
 * episodes here. When they can't be read the episodes have none: ratings never fail the read.
 */
export async function getShowTrackingPage(
	userId: string,
	showId: number,
	grid: GridLoader = loadGrid,
	language?: string,
): Promise<ShowTrackingPage> {
	const id = canonicalTitleId("show", showId)
	const [tracking, presentation, running, episodeScores] = await Promise.all([
		getShowTracking(userId, id),
		getEpisodePresentation(id),
		isRunning(id),
		// The member's season and episode scores (#759) never fail the read.
		getEpisodeScores(userId, id).catch((error) => {
			console.error("episode scores failed", { showId: id, error })
			return []
		}),
	])
	// A selected presentation carries its entire catalog snapshot, including the page's descriptions.
	const [list, ratings] = await Promise.all([
		presentation
			? Promise.resolve(
					presentation.episodes.map((e) => ({
						tmdb_id: e.id,
						season_number: e.season,
						episode_number: e.number,
						name: e.name,
						air_date: e.airDate ?? null,
						runtime: e.runtime ?? null,
						still_path: e.still ?? null,
						overview: e.overview ?? null,
					})),
				)
			: getEpisodeList(id),
		presentation
			? Promise.resolve(null)
			: grid(id).catch((error) => {
					console.error("episode ratings failed", { showId: id, error })
					return null
				}),
	])
	const seasons = ratings?.seasons ?? []
	const matched = matchEpisodeRatings(
		list.map((row) => ({
			id: row.tmdb_id,
			season: row.season_number,
			number: row.episode_number,
			name: row.name,
		})),
		seasons,
	)
	const presented = new Map(presentation?.episodes.map((e) => [e.id, e]) ?? [])
	const page: ShowTrackingPage = {
		...(presentation
			? {
					presentation: {
						version: presentation.version,
						active: presentation.active,
						note: presentation.note,
					},
				}
			: {}),
		state: tracking.state,
		log: tracking.log,
		episodeScores,
		episodes: list.map((row) => {
			const rated = matched.byEpisode.get(row.tmdb_id)
			const aligned = presented.get(row.tmdb_id)
			return {
				id: row.tmdb_id,
				season: row.season_number,
				number: row.episode_number,
				name: row.name,
				airDate: row.air_date === null ? null : utcDay(row.air_date),
				runtime: row.runtime,
				still: row.still_path,
				overview: row.overview || null,
				...(aligned
					? {
							displaySeason: aligned.displaySeason,
							displayNumber: aligned.displayNumber,
						}
					: {}),
				rating: aligned ? aligned.rating : (rated?.score ?? null),
				ratedBy: aligned
					? aligned.rating === null
						? null
						: ("id" as const)
					: (rated?.how ?? null),
			}
		}),
		running,
		...(list.length
			? {
					ratingCoverage: presentation
						? Object.fromEntries(
								presentation.seasons.map((s) => [
									String(s.number),
									{ rated: s.rated, total: s.total },
								]),
							)
						: Object.fromEntries(
								[
									...new Set(
										list
											.filter((e) => e.season_number > 0)
											.map((e) => e.season_number),
									),
								].map((number) => {
									const own = list.filter((e) => e.season_number === number)
									return [
										String(number),
										{
											rated: own.filter((e) => matched.byEpisode.has(e.tmdb_id))
												.length,
											total: own.length,
										},
									]
								}),
							),
				}
			: {}),
		seasonScores: presentation
			? Object.fromEntries(
					presentation.seasons.flatMap((s) =>
						s.score === null ? [] : [[String(s.number), s.score]],
					),
				)
			: Object.fromEntries(
					[
						...new Set(
							list
								.filter((e) => e.season_number > 0)
								.map((e) => e.season_number),
						),
					].flatMap((number) => {
						const own = list.filter((e) => e.season_number === number)
						const scored = own.map((e) => matched.byEpisode.get(e.tmdb_id))
						if (
							own.some(
								(e) =>
									e.air_date !== null &&
									utcDay(e.air_date) <= utcDay(Date.now()) &&
									!matched.byEpisode.has(e.tmdb_id),
							)
						)
							return []
						const votes = scored.reduce((n, e) => n + (e?.votes ?? 0), 0)
						return votes > 0
							? [
									[
										String(number),
										Math.round(
											(scored.reduce(
												(n, e) => n + (e?.score ?? 0) * (e?.votes ?? 0),
												0,
											) /
												votes) *
												100,
										) / 100,
									],
								]
							: []
					}),
				),
		notes: presentation
			? {}
			: Object.fromEntries(
					[...matched.notes].map(([season, note]) => [String(season), note]),
				),
	}
	return language ? { ...page, episodes: await overlayEpisodeText("episode", id, page.episodes, language) } : page
}

// ---------------------------------------------------------------------------------------------------------
// The actions
// ---------------------------------------------------------------------------------------------------------

const whole = z.number().int().min(0).max(100_000)
const day = z.string().refine(isDay)
// The writer checks an id again and refuses the ones that name watches made elsewhere (`g-`, `score-`, `i-`).
const id = z.string().min(8).max(80)
const when = z.union([
	z.object({ precision: z.literal("moment") }),
	z.object({ precision: z.literal("day"), day }),
	z.object({ precision: z.literal("unknown") }),
])
const loggedWhen = z.union([
	z.object({ precision: z.literal("day"), day }),
	z.object({ precision: z.literal("unknown") }),
])
const today = day.optional()

const eventSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("watch"),
		season: whole,
		number: whole,
		when: when.optional(),
	}),
	z.object({ type: z.literal("unwatch"), season: whole, number: whole }),
	z.object({ type: z.literal("markSeason"), season: whole, today }),
	z.object({ type: z.literal("markRange"), season: whole, from: whole, to: whole, today }),
	z.object({
		type: z.literal("markEpisodes"),
		episodeIds: z.array(z.number().int().positive()).min(1).max(20000),
		displaySeason: z.number().int().min(-1).max(100000),
		presentationVersion: z.string().min(1).max(160),
		today,
	}),
	z.object({
		type: z.literal("unmarkEpisodes"),
		episodeIds: z.array(z.number().int().positive()).min(1).max(20000),
		displaySeason: z.number().int().min(-1).max(100000),
		presentationVersion: z.string().min(1).max(160),
	}),
	z.object({
		type: z.literal("watchUpTo"),
		season: whole,
		number: whole,
		today,
	}),
	z.object({ type: z.literal("unmarkSeason"), season: whole }),
	z.object({ type: z.literal("undoGroup"), group: id }),
	z.object({ type: z.literal("deleteWatch"), watchId: id }),
	z.object({ type: z.literal("pressSeen"), today }),
	z.object({ type: z.literal("undoSeen") }),
	// The Undo of taking a Seen press back: the press as the page held it. The writer checks every part of it.
	z.object({
		type: z.literal("restoreSeen"),
		group: id,
		from: z.enum(STATES),
		pass: z.number().int().min(1).max(100_000),
		changedAt: z.number().int().positive(),
		watches: z
			.array(
				z.object({
					id: z.string().min(3).max(120),
					episodeId: z.number().int().positive().max(2_000_000_000),
					season: whole,
					number: whole,
					watchedAt: z.number().int().nullable(),
					precision: z.enum(["moment", "day", "unknown"]),
					createdAt: z.number().int().positive(),
				}),
			)
			.max(20_000),
	}),
	// The Undo of Unmark season: the season's rows as the page held them. The writer checks every part of it.
	z.object({
		type: z.literal("restoreSeason"),
		from: z.enum(STATES),
		press: z.object({ group: id, from: z.enum(STATES) }).nullable(),
		pass: z.number().int().min(1).max(100_000),
		changedAt: z.number().int().positive(),
		watches: z
			.array(
				z.object({
					id: z.string().min(3).max(120),
					episodeId: z.number().int().positive().max(2_000_000_000).nullable(),
					season: whole,
					number: whole,
					watchedAt: z.number().int().nullable(),
					precision: z.enum(["moment", "day", "unknown"]),
					createdAt: z.number().int().positive(),
					origin: z.enum(["single", "upto", "season", "seen", "import"]),
					group: id.nullable(),
					importId: z.string().min(1).max(80).nullable(),
				}),
			)
			.min(1)
			.max(20_000),
	}),
	z.object({ type: z.literal("hold"), today }),
	z.object({ type: z.literal("drop"), today }),
	z.object({ type: z.literal("resume") }),
	z.object({ type: z.literal("watchAgain") }),
	z.object({ type: z.literal("wantToSee"), on: z.literal(true) }),
	z.object({ type: z.literal("dismissRatePrompt") }),
	z.object({
		type: z.literal("answerSeenQuestion"),
		answer: z.enum(["partway", "just_rating"]),
	}),
	z.object({
		type: z.literal("editWatchDate"),
		watchId: id,
		when: loggedWhen,
	}),
	z.object({ type: z.literal("setGroupDate"), group: id, day }),
])

/** The actions that make watches: the browser names them, so that a request sent twice records once. */
const NAMED = ["watch", "pressSeen", "markSeason", "markRange", "markEpisodes", "watchUpTo"]

const actionSchema = z
	.object({
		id: z.number().int().positive().max(2_000_000_000),
		event: eventSchema,
		actionId: id.optional(),
		restore: z
			.object({
				wantToSeeAddedAt: z.string().datetime().nullable().optional(),
				notInterested: z.boolean().optional(),
			})
			.optional(),
	})
	.refine((body) => !NAMED.includes(body.event.type) || body.actionId)

export interface ShowAction {
	/** The show's TMDB id. */
	id: number
	event: PageAction
	/** The id the browser made: the watch id of a `watch`, the group id of a group action. */
	actionId?: string
	restore?: Restore
}

/** A request body as an action of the show page; null when it is not one. */
export function parseShowAction(body: unknown): ShowAction | null {
	const parsed = actionSchema.safeParse(body)
	return parsed.success ? (parsed.data as ShowAction) : null
}

/**
 * Applies one action of the show page and answers with what the browser takes over in place of its guess: the
 * show's state row, the stored rows the action added or changed, the ids it removed, and what an Undo has to put
 * back.
 *
 * `restore` is that Undo's other half: after the action took the member's only watch away, the show goes back on
 * the Wishlist at the time it was added, or back to Not interested. It is applied only while the show is Not
 * started afterwards, which is the only state that has either.
 */
export async function applyShowTrackingAction(
	userId: string,
	action: ShowAction,
): Promise<ActionAnswer> {
	const title: TrackedTitle = {
		mediaType: "show",
		tmdbId: canonicalTitleId("show", action.id),
	}
	const { event } = action
	if (event.type === "markEpisodes" || event.type === "unmarkEpisodes") {
		const presentation = await getEpisodePresentation(title.tmdbId).catch(
			() => null,
		)
		const utcToday = utcDay(Date.now())
		const limit = utcDay(Date.now() + 86400000)
		const through =
			event.type === "markEpisodes" && isDay(event.today)
				? event.today
				: utcToday
		const members =
			presentation?.episodes.filter(
				(e) => e.season > 0 && e.displaySeason === event.displaySeason,
			) ?? []
		const eligible =
			event.type === "markEpisodes"
				? showAiredBy(
						members.map((e) => ({
							...e,
							airDate: e.airDate == null ? null : utcDay(e.airDate),
						})),
						through,
					)
						.episodes.filter((e) => e.aired)
						.map((e) => e.id)
				: members.map((e) => e.id)
		if (
			!presentation ||
			presentation.version !== event.presentationVersion ||
			through > limit ||
			!eligible.length ||
			new Set(event.episodeIds).size !== event.episodeIds.length ||
			eligible.length !== event.episodeIds.length ||
			eligible.some((id) => !event.episodeIds.includes(id))
		) {
			const stored = await getShowTracking(userId, title.tmdbId)
			const existing = action.actionId
				? stored.log.filter((row) => row.group_id === action.actionId)
				: []
			if (
				event.type === "markEpisodes" &&
				existing.length &&
				existing.every(
					(row) =>
						row.origin === "season" &&
						row.episode_tmdb_id !== null &&
						event.episodeIds.includes(row.episode_tmdb_id),
				)
			) {
				const have = new Set(existing.map((row) => row.episode_tmdb_id))
				return {
					status: "applied",
					refused: null,
					state: stored.state,
					rows: existing,
					deleted: event.episodeIds
						.filter((id) => !have.has(id))
						.map((id) => groupWatchId(action.actionId!, id)),
					cleared: { wantToSeeAddedAt: null, notInterested: false },
				}
			}
			return {
				status: "refused",
				reload: true,
				refused: "The episode list changed. Reloading it; please try again.",
				state: stored.state,
				rows: [],
				deleted: [],
				cleared: { wantToSeeAddedAt: null, notInterested: false },
			}
		}
	}
	const result = await applyTrackingEvent(userId, title, event, action.actionId)
	// The rows as they are stored now. An edit of a date answers without the show's state row, so it is read here.
	const stored = await getShowTracking(userId, title.tmdbId)
	if (result.status !== "applied")
		return {
			status: "refused",
			refused: result.refused,
			state: stored.state,
			rows: [],
			deleted: [],
			cleared: result.cleared,
		}
	const notStarted = (stored.state?.state ?? "not_started") === "not_started"
	if (event.type === "wantToSee" && notStarted)
		await updateWishList({
			user_id: userId,
			tmdb_id: title.tmdbId,
			media_type: "show",
			action: "add",
		})
	if (action.restore && notStarted) await restore(userId, title, action.restore)
	const changed = new Set(result.inserted)
	return {
		status: "applied",
		refused: null,
		state: stored.state,
		rows: stored.log.filter(
			(row) =>
				changed.has(row.watch_id) ||
				(event.type === "editWatchDate" && row.watch_id === event.watchId) ||
				(event.type === "setGroupDate" && row.group_id === event.group),
		),
		deleted: result.deleted,
		cleared: result.cleared,
	}
}

async function restore(userId: string, title: TrackedTitle, what: Restore) {
	const key = {
		user_id: userId,
		tmdb_id: title.tmdbId,
		media_type: title.mediaType,
	} as const
	// Not interested first: putting a title on the Wishlist clears it, and a title was never on both.
	if (what.notInterested && !what.wantToSeeAddedAt)
		await updateNotInterested({ ...key, action: "add" })
	if (what.wantToSeeAddedAt) {
		const addedAt = new Date(what.wantToSeeAddedAt)
		await updateWishList({
			...key,
			action: "add",
			// A time in the future would sort first in Last added forever; it can only come from a tampered request.
			addedAt: addedAt.getTime() <= Date.now() ? addedAt : undefined,
		})
	}
}

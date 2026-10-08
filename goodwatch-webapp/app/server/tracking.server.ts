// Tracking on the server: the one writer for the watch log and the watch state, and their reads
// (docs/implementation/tracking/data-model.md, ADR 0008, ADR 0009).
//
// The interface is `applyTrackingEvent` for every action on a title, `settleMovie` and `settleMovies` for the paths
// that write movies' scores themselves, `deleteTrackingData`, and four reads. Everything else is hidden here and in
// domain/tracking: the state machine, the mapping between its record and the two tables, the order of the writes,
// the check that keeps two actions on one show from overwriting each other, and what a request that is sent twice
// does.
//
// The writer does not write `user_score`, and it only ever deletes from `user_wishlist` and `user_not_interested`.
// Setting a score, adding to the Wishlist and marking Not interested stay with their own writers. The score's
// writers call in here with `rate` after their write (scores.server.ts, the guest transfer) or settle their movies
// (the IMDb import). wishList.server.ts and not-interested.server.ts do not call in yet: the only row of the table
// they would take is Want to See on a Dropped show, and nothing in the interface drops a show yet.
import {
	type ListedEpisode,
	type TrackingEvent,
	type WatchedWhen,
	isDay,
	serverShow,
	utcDay,
} from "~/domain/tracking/machine"
import {
	type GroupRow,
	type LogRow,
	type MediaType,
	type StateRow,
	type TitleKey,
	type TitleState,
	type TitleTotals,
	type WatchStateEntry,
	applyShowEvent,
	movieLogRow,
	movieStateRow,
	scoreWatchId,
	settleMovieRows,
	titleTotals,
	watchStateOf,
	watchedAt,
} from "~/domain/tracking/storage"
import {
	clearNotInterested,
	isMissingNotInterestedTable,
} from "~/server/not-interested-store.server"
import { markTasteChanged } from "~/server/taste/index.server"
import {
	EPISODE_LIST_QUERY,
	EPISODE_LIST_WITHOUT_OVERVIEW_QUERY,
	GROUPED_QUERY,
	MOVIE_LOG_QUERY,
	SHOW_LOG_QUERY,
	STATES_QUERY,
	STATE_ROW_QUERY,
} from "~/server/tracking-sql"
import { resetUserDataCache } from "~/server/userData.server"
import { cached } from "~/utils/cache"
import { type CrateValue, execute, insertRows, query } from "~/utils/crate"
import { canonicalTitleId } from "~/utils/title-identity"

// ---------------------------------------------------------------------------------------------------------
// The interface
// ---------------------------------------------------------------------------------------------------------

export interface TrackedTitle {
	mediaType: MediaType
	tmdbId: number
}

/** A date set in the watch log. It is a day or unknown, never a time. */
export type LoggedWhen = Exclude<WatchedWhen, { precision: "moment" }>

/**
 * What a member does to a title.
 *
 * A show takes every `TrackingEvent` of the state machine, and the two edits of dates. A movie has no machine: it
 * takes `watch` (without season and number), `deleteWatch`, `rate` and `editWatchDate`.
 *
 * `rate` says that the title's score changed. The score itself is written by `updateScores`, before this is called.
 * `wantToSee` and `notInterested` with `on: true` say that the member put the title on that list; the row is added
 * by its own writer after this accepted the event. With `on: false`, and wherever an event takes a title off a
 * list, the row is deleted here.
 */
export type TrackingAction =
	| TrackingEvent
	| { type: "watch"; when?: WatchedWhen }
	/** "Change date" on one watch. Setting a day on the watch a score owns makes it the member's own. */
	| { type: "editWatchDate"; watchId: string; when: LoggedWhen }
	/** "Set a date" on the watches of Mark season, Watched up to here or a Seen press. */
	| { type: "setGroupDate"; group: string; day: string }
	/** "Remove all N watches" in a movie's log: every watch the member logged. The score's watch is not theirs. */
	| { type: "removeWatches" }
	/** Undo of a delete in a movie's log: the same rows again, under the same ids. */
	| { type: "restoreWatches"; rows: RestoredWatch[] }

/**
 * A watch that was deleted from a movie's log, as the browser hands it back for Undo. The member and the movie are
 * not in it: they come from the session and from the request's title.
 */
export interface RestoredWatch {
	watchId: string
	/** Milliseconds: the instant, 00:00 UTC of the day, or null for an unknown date. */
	watchedAt: number | null
	precision: "moment" | "day" | "unknown"
	/** A watch marked by hand or imported. No other origin is the member's to restore. */
	origin: "single" | "import"
	importId: string | null
	/** When the watch was first recorded, in milliseconds. */
	createdAt: number
}

export interface TrackingResult {
	status: "applied" | "refused"
	/** Why nothing was written, in member words. */
	refused: string | null
	/** The title's state row after the event; null when it has none. */
	state: StateRow | null
	/** The last row of the transition table that was used, for a show's event that took one. */
	row: string | null
	/** The watch ids this event added to and removed from the log. */
	inserted: string[]
	deleted: string[]
	/**
	 * What Undo needs to put back: when the title was added to the Wishlist (ISO) if this event took it off, and
	 * whether it took it off Not interested.
	 */
	cleared: { wantToSeeAddedAt: string | null; notInterested: boolean }
}

/** Another action on the same show kept getting in between. The log rows are written; the same request repairs. */
export class TrackingConflictError extends Error {
	constructor() {
		super(
			"Another action on this show came in at the same time. Please try again.",
		)
		this.name = "TrackingConflictError"
	}
}

/** How often the writer starts again after another action changed the show's state row in between. */
const STATE_RETRIES = 3

// ---------------------------------------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------------------------------------

type Param = string | number | Date
const run = (sql: string, params: CrateValue[] = []) =>
	execute(sql, params as Param[])
const read = <T extends object>(sql: string, params: CrateValue[]) =>
	query<T>(sql, params as Param[])
const marks = (count: number) => Array(count).fill("?").join(", ")
const at = (ms: number | null) => (ms === null ? null : new Date(ms))
const ms = (value: unknown) =>
	value === null || value === undefined
		? null
		: new Date(value as number).getTime()

const LOG_COLUMNS = [
	"user_id",
	"watch_id",
	"media_type",
	"tmdb_id",
	"episode_tmdb_id",
	"season_number",
	"episode_number",
	"watched_at",
	"watched_at_precision",
	"origin",
	"group_id",
	"import_id",
	"pass",
	"created_at",
	"updated_at",
]
const STATE_COLUMNS = [
	"user_id",
	"tmdb_id",
	"media_type",
	"state",
	"state_changed_at",
	"pass",
	"seen_press_group",
	"seen_press_from",
	"rate_prompt_dismissed_at",
	"seen_question",
	"created_at",
	"updated_at",
]
const STATE_KEY = ["user_id", "tmdb_id", "media_type"]
const DELETE_CHUNK = 500

type StoredState = StateRow & { _seq_no: number; _primary_term: number }

async function readState(
	userId: string,
	title: TrackedTitle,
): Promise<StoredState | null> {
	const [row] = await read<Record<string, unknown>>(STATE_ROW_QUERY, [
		userId,
		title.tmdbId,
		title.mediaType,
	])
	if (!row) return null
	return {
		state: row.state as StateRow["state"],
		state_changed_at: ms(row.state_changed_at) ?? 0,
		pass: Number(row.pass),
		seen_press_group: (row.seen_press_group as string | null) ?? null,
		seen_press_from:
			(row.seen_press_from as StateRow["seen_press_from"]) ?? null,
		rate_prompt_dismissed_at: ms(row.rate_prompt_dismissed_at),
		seen_question: (row.seen_question as StateRow["seen_question"]) ?? null,
		_seq_no: Number(row._seq_no),
		_primary_term: Number(row._primary_term),
	}
}

const stateOnly = (row: StoredState | null): StateRow | null => {
	if (!row) return null
	const { _seq_no, _primary_term, ...state } = row
	return state
}

async function readLog(userId: string, title: TrackedTitle): Promise<LogRow[]> {
	const rows = await read<Record<string, unknown>>(
		title.mediaType === "show" ? SHOW_LOG_QUERY : MOVIE_LOG_QUERY,
		[userId, title.tmdbId],
	)
	return rows.map((row) => ({
		watch_id: row.watch_id as string,
		media_type: title.mediaType,
		tmdb_id: title.tmdbId,
		episode_tmdb_id: (row.episode_tmdb_id as number | null) ?? null,
		season_number: (row.season_number as number | null) ?? null,
		episode_number: (row.episode_number as number | null) ?? null,
		watched_at: ms(row.watched_at),
		watched_at_precision:
			row.watched_at_precision as LogRow["watched_at_precision"],
		origin: row.origin as LogRow["origin"],
		group_id: (row.group_id as string | null) ?? null,
		import_id: (row.import_id as string | null) ?? null,
		pass: row.pass === undefined ? 1 : Number(row.pass),
		created_at: ms(row.created_at) ?? 0,
	}))
}

/** One multi-row insert per 500 rows. A row whose `watch_id` is stored already is left as it is. */
async function insertLog(userId: string, rows: readonly LogRow[], now: number) {
	return insertRows(
		"user_watch_log",
		LOG_COLUMNS,
		rows.map((r) => [
			userId,
			r.watch_id,
			r.media_type,
			r.tmdb_id,
			r.episode_tmdb_id,
			r.season_number,
			r.episode_number,
			at(r.watched_at),
			r.watched_at_precision,
			r.origin,
			r.group_id,
			r.import_id,
			r.pass,
			new Date(r.created_at),
			new Date(now),
		]),
		{ conflict: ["user_id", "watch_id"] },
	)
}

/** Deletes log rows by their whole key, which Crate does in real time. */
async function deleteLog(userId: string, watchIds: readonly string[]) {
	for (let start = 0; start < watchIds.length; start += DELETE_CHUNK) {
		const ids = watchIds.slice(start, start + DELETE_CHUNK)
		await run(
			`DELETE FROM user_watch_log WHERE user_id = ? AND watch_id IN (${marks(ids.length)})`,
			[userId, ...ids],
		)
	}
}

const stateValues = (row: StateRow): CrateValue[] => [
	row.state,
	new Date(row.state_changed_at),
	row.pass,
	row.seen_press_group,
	row.seen_press_from,
	at(row.rate_prompt_dismissed_at),
	row.seen_question,
]

async function insertState(
	userId: string,
	title: TrackedTitle,
	row: StateRow,
	now: number,
): Promise<boolean> {
	const { rowcount } = await insertRows(
		"user_watch_state",
		STATE_COLUMNS,
		[
			[
				userId,
				title.tmdbId,
				title.mediaType,
				...stateValues(row),
				new Date(now),
				new Date(now),
			],
		],
		{ conflict: STATE_KEY },
	)
	return rowcount === 1
}

/**
 * Writes a show's state row, checked against the version that was read. False means that no row was written:
 * another action on the show changed, made or removed the row in between.
 */
async function writeState(
	userId: string,
	title: TrackedTitle,
	write: "insert" | "update" | "delete" | "none",
	row: StateRow | null,
	before: StoredState | null,
	now: number,
): Promise<boolean> {
	if (write === "none") return true
	if (write === "insert")
		return row ? insertState(userId, title, row, now) : true
	if (!before) return false
	const key: CrateValue[] = [
		userId,
		title.tmdbId,
		title.mediaType,
		before._seq_no,
		before._primary_term,
	]
	const unchanged =
		"WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?"
	const result =
		write === "update" && row
			? await run(
					`UPDATE user_watch_state
					 SET state = ?, state_changed_at = ?, pass = ?, seen_press_group = ?, seen_press_from = ?,
					     rate_prompt_dismissed_at = ?, seen_question = ?, updated_at = ?
					 ${unchanged}`,
					[...stateValues(row), new Date(now), ...key],
				)
			: await run(`DELETE FROM user_watch_state ${unchanged}`, key)
	return (result.rowcount || 0) >= 1
}

/**
 * Takes the title off the Wishlist and off Not interested, by their whole keys, and says what it took: the
 * Wishlist's added-at time, so that Undo can give the title its place back.
 */
async function clearIntentions(
	userId: string,
	title: TrackedTitle,
	clear: { wantToSee: boolean; notInterested: boolean },
): Promise<TrackingResult["cleared"]> {
	const key = [userId, title.tmdbId, title.mediaType]
	let wantToSeeAddedAt: string | null = null
	let notInterested = false
	if (clear.wantToSee) {
		const [wish] = await read<{
			created_at: number | null
			updated_at: number
		}>(
			"SELECT created_at, updated_at FROM user_wishlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			key,
		)
		if (wish) {
			await run(
				"DELETE FROM user_wishlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
				key,
			)
			wantToSeeAddedAt = new Date(
				wish.created_at ?? wish.updated_at,
			).toISOString()
		}
	}
	if (clear.notInterested) {
		try {
			const found = await read<{ updated_at: number }>(
				"SELECT updated_at FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
				key,
			)
			notInterested = found.length > 0
		} catch (error) {
			if (!isMissingNotInterestedTable(error)) throw error
		}
		if (notInterested)
			await clearNotInterested(userId, title.tmdbId, title.mediaType)
	}
	// Taste is built from scores and Want to See, so it changed when a Want to See row went.
	if (wantToSeeAddedAt) await markTasteChanged(userId)
	return { wantToSeeAddedAt, notInterested }
}

/**
 * The last step of every write. `resetUserDataCache` refreshes the member's tables, the two of tracking among them,
 * so the next read of the member data sees this write.
 */
async function finish(userId: string) {
	await resetUserDataCache({ user_id: userId })
}

const NOT_CLEARED = { wantToSeeAddedAt: null, notInterested: false }

const refusal = (
	refused: string,
	state: StateRow | null = null,
): TrackingResult => ({
	status: "refused",
	refused,
	state,
	row: null,
	inserted: [],
	deleted: [],
	cleared: NOT_CLEARED,
})

// An id the browser made. `g-`, `score-`, `i-` and `mig-` name watches that are made here, by an import and by the
// migration, so an id from a request never starts with one of them.
const ACTION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/
const RESERVED = /^(g|i|score|mig)-/
const validId = (id: string | undefined): id is string =>
	typeof id === "string" && ACTION_ID.test(id) && !RESERVED.test(id)
const BAD_ID = "The action's id is missing or not valid."
const whole = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0

const validWhen = (when: WatchedWhen | undefined) =>
	!when ||
	when.precision === "moment" ||
	when.precision === "unknown" ||
	(when.precision === "day" && isDay(when.day))

const DAY_MS = 86_400_000
/** The end of tomorrow by the UTC date: a device is never more than a day ahead of UTC (data-model.md, C4). */
const latestDay = (now: number) => (Math.floor(now / DAY_MS) + 2) * DAY_MS
/** The day a member names has come, where they are. */
const dayHasCome = (when: WatchedWhen | undefined, now: number) =>
	when?.precision !== "day" ||
	Date.parse(`${when.day}T00:00:00Z`) < latestDay(now)
const NOT_YET = "That day has not come yet."

/** How many watches one Undo can put back. A movie's log is read up to 200 rows. */
const MAX_RESTORED = 200
const IMPORT_WATCH_ID = /^i-[0-9a-f]{32}$/
const NOT_RESTORABLE = "That watch can't be put back."

/**
 * Whether a row could have been in this movie's log, by what it says about itself. Undo sends back what the log
 * showed, so everything in it is checked as a member's input: the id is one the browser, the migration, an import
 * or this movie's score made for this movie; the origin is the member's own; the date fits its precision and has
 * come. Whose import an imported watch names is checked against the table.
 */
function restorable(row: RestoredWatch, movieId: number, now: number): boolean {
	if (!row || typeof row !== "object") return false
	const { watchId, watchedAt, precision, origin, importId, createdAt } = row
	if (typeof watchId !== "string") return false
	if (origin === "import") {
		if (!IMPORT_WATCH_ID.test(watchId)) return false
		if (typeof importId !== "string" || !importId || importId.length > 80)
			return false
	} else if (origin === "single") {
		if (importId !== null) return false
		const own =
			validId(watchId) ||
			watchId === scoreWatchId(movieId) ||
			watchId === `mig-movie-${movieId}`
		if (!own) return false
	} else return false
	if (!Number.isFinite(createdAt) || createdAt <= 0 || createdAt > now + 60_000)
		return false
	if (precision === "unknown") return watchedAt === null
	if (watchedAt === null || !Number.isFinite(watchedAt)) return false
	if (watchedAt < 0 || watchedAt >= latestDay(now)) return false
	if (precision === "day") return watchedAt % DAY_MS === 0
	return precision === "moment"
}

// ---------------------------------------------------------------------------------------------------------
// The episode list (Q3)
// ---------------------------------------------------------------------------------------------------------

export interface EpisodeListRow {
	tmdb_id: number
	season_number: number
	episode_number: number
	name: string | null
	/** Midnight UTC of TMDB's air date, in milliseconds; null when unknown. */
	air_date: number | null
	runtime: number | null
	still_path: string | null
	episode_type: string | null
	/** TMDB's description. Missing in a list cached before the read asked for it, and where the column is not there. */
	overview?: string | null
	[key: string]: string | number | null | undefined
}

/**
 * A show without a listed episode has no list, and so has every show while the episode catalog's table is not
 * there: rating a show and its Seen press must not depend on the catalog being deployed. A show marked Seen without
 * a list gets its press filled later (data-model.md, C5).
 */
async function readEpisodeList({ showId }: { showId: number }) {
	try {
		return await query<EpisodeListRow>(EPISODE_LIST_QUERY, [showId])
	} catch (error) {
		// The webapp can be deployed before the catalog's table has the column (#387).
		if (isMissingColumn(error, "overview"))
			return query<EpisodeListRow>(EPISODE_LIST_WITHOUT_OVERVIEW_QUERY, [showId])
		if (!isMissingTable(error, "episode")) throw error
		console.error("The episode catalog's table is missing: no show has a list")
		return []
	}
}

/** A show's episodes as TMDB lists them, specials in season 0. Public data, the same for everyone. */
export async function getEpisodeList(
	showId: number,
): Promise<EpisodeListRow[]> {
	return cached<{ showId: number }, EpisodeListRow[]>({
		name: "tracking-episode-list-v1",
		target: readEpisodeList,
		params: { showId },
		ttlMinutes: 10,
	})
}

const listed = (rows: readonly EpisodeListRow[]): ListedEpisode[] =>
	rows.map((row) => ({
		id: row.tmdb_id,
		season: row.season_number,
		number: row.episode_number,
		airDate: row.air_date === null ? null : utcDay(row.air_date),
	}))

// ---------------------------------------------------------------------------------------------------------
// The writer
// ---------------------------------------------------------------------------------------------------------

/**
 * Applies one action of a member to a title: the log rows first, the state row second, the Wishlist and Not
 * interested third, then the member data cache is reset.
 *
 * `actionId` is the id the browser made for the action: the `watch_id` of a `watch`, and the group id of
 * `pressSeen`, `markSeason` and `watchUpTo`. Sending the same action with the same id again writes nothing twice
 * and ends in the same rows, also when the first request stopped half way.
 *
 * A refused action writes nothing and says why. Throws `TrackingConflictError` when other actions on the same show
 * kept changing its state in between, and whatever Crate throws.
 */
export async function applyTrackingEvent(
	userId: string,
	title: TrackedTitle,
	event: TrackingAction,
	actionId?: string,
): Promise<TrackingResult> {
	const canonical: TrackedTitle = {
		mediaType: title.mediaType,
		tmdbId: canonicalTitleId(title.mediaType, title.tmdbId),
	}
	if (!userId || !whole(canonical.tmdbId)) return refusal("No such title.")
	if (event.type === "editWatchDate")
		return editWatchDate(userId, canonical, event)
	if (event.type === "setGroupDate")
		return setGroupDate(userId, canonical, event)
	if (canonical.mediaType === "movie")
		return applyMovieEvent(userId, canonical.tmdbId, event, actionId)
	if (event.type === "watch" && !("season" in event))
		return refusal("A watch of a show names an episode.")
	if (event.type === "removeWatches" || event.type === "restoreWatches")
		return refusal("A show's watches are changed in its episode list.")
	return applyShowEventStored(
		userId,
		canonical,
		event as TrackingEvent,
		actionId,
	)
}

const NEEDS_ID = ["watch", "pressSeen", "markSeason", "watchUpTo"]

function invalid(event: TrackingEvent, actionId?: string): string | null {
	if (NEEDS_ID.includes(event.type) && !validId(actionId)) return BAD_ID
	if ("season" in event && !whole(event.season)) return "No such season."
	if ("number" in event && !whole(event.number)) return "No such episode."
	if (event.type === "watch" && !validWhen(event.when)) return "No such day."
	return null
}

async function applyShowEventStored(
	userId: string,
	title: TrackedTitle,
	event: TrackingEvent,
	actionId?: string,
): Promise<TrackingResult> {
	const bad = invalid(event, actionId)
	if (bad) return refusal(bad)
	// Log rows an earlier round of this call inserted. They were worked out from a state that has changed since.
	let stale: string[] = []
	for (let round = 0; round <= STATE_RETRIES; round++) {
		if (stale.length) {
			await deleteLog(userId, stale)
			stale = []
		}
		// 1. So that the read below sees the rows of the member's previous action.
		await run("REFRESH TABLE user_watch_log")
		// 2. The state row (real-time), the show's log rows, the cached episode list.
		const [before, log, episodes] = await Promise.all([
			readState(userId, title),
			readLog(userId, title),
			getEpisodeList(title.tmdbId),
		])
		// 3. The machine, in memory. The server can't tell a first request from one sent again, so it always runs
		// with `resend`. Which lists the title is on is not read: the event says which ones it clears.
		const now = Date.now()
		const applied = applyShowEvent({
			showId: title.tmdbId,
			show: serverShow(listed(episodes), event, utcDay(now)),
			state: stateOnly(before),
			log,
			flags: { score: null, wantToSee: true, notInterested: true },
			event,
			actionId,
			now,
			resend: true,
		})
		if (applied.refused) {
			if (round > 0) await finish(userId)
			return refusal(applied.refused, stateOnly(before))
		}
		const { insert, deleteIds, state, stateWrite, clear } = applied.changes
		// 4. The log rows: one insert, or one delete naming the rows the machine removed.
		await insertLog(userId, insert, now)
		await deleteLog(userId, deleteIds)
		// 5. The state row, which is also the lock: no row written means another action came in between.
		if (!(await writeState(userId, title, stateWrite, state, before, now))) {
			stale = insert.map((r) => r.watch_id)
			continue
		}
		// 6. Want to See and Not interested.
		const cleared = await clearIntentions(userId, title, clear)
		// 7. The member data.
		await finish(userId)
		return {
			status: "applied",
			refused: null,
			state,
			row: applied.row,
			inserted: insert.map((r) => r.watch_id),
			deleted: deleteIds,
			cleared,
		}
	}
	await finish(userId)
	throw new TrackingConflictError()
}

// ---------------------------------------------------------------------------------------------------------
// Movies
// ---------------------------------------------------------------------------------------------------------

async function readScore(userId: string, movieId: number): Promise<boolean> {
	const rows = await read<{ score: number }>(
		"SELECT score FROM user_score WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
		[userId, movieId, "movie"],
	)
	return rows.length > 0
}

export interface MovieSettled {
	/** The movie has a log row, so it is Seen. */
	seen: boolean
	/** The movie's state row; null when it is not Seen. */
	state: StateRow | null
	/** The movie's only watch is the one its score owns. */
	byScoreAlone: boolean
	inserted: string[]
	deleted: string[]
}

/**
 * Makes a movie's rows follow the movie rule: the score's watch exists exactly while the movie has a score and no
 * log row of another origin, and the state row exists exactly while a log row does.
 *
 * Every path that writes a movie's score or log itself calls this after its write: the rating control, the taste
 * quiz, the guest transfer, an import and its undo. It reads `user_score` by key, so it sees a score written just
 * before. It does not reset the member data cache; the caller does, after its last write.
 */
export async function settleMovie(
	userId: string,
	movieId: number,
): Promise<MovieSettled> {
	const title: TrackedTitle = {
		mediaType: "movie",
		tmdbId: canonicalTitleId("movie", movieId),
	}
	await run("REFRESH TABLE user_watch_log")
	const [before, log, hasScore] = await Promise.all([
		readState(userId, title),
		readLog(userId, title),
		readScore(userId, title.tmdbId),
	])
	const now = Date.now()
	const settled = settleMovieRows({
		movieId: title.tmdbId,
		log,
		hasScore,
		hasState: before !== null,
		now,
	})
	await insertLog(userId, settled.insert, now)
	await deleteLog(userId, settled.deleteIds)
	let state = stateOnly(before)
	if (settled.stateWrite === "insert") {
		state = movieStateRow(now)
		await insertState(userId, title, state, now)
	}
	if (settled.stateWrite === "delete") {
		state = null
		await run(
			"DELETE FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			[userId, title.tmdbId, "movie"],
		)
	}
	return {
		seen: settled.seen,
		state,
		byScoreAlone: settled.byScoreAlone,
		inserted: settled.insert.map((r) => r.watch_id),
		deleted: settled.deleteIds,
	}
}

const SETTLE_CHUNK = 500

/**
 * The movie rule for many movies at once, for a path that wrote or removed many scores: an import and its undo.
 * A handful of statements per 500 movies, where `settleMovie` takes five for one. Like `settleMovie`, it leaves the
 * Wishlist and the member data cache to the caller.
 */
export async function settleMovies(
	userId: string,
	movieIds: readonly number[],
): Promise<{ inserted: string[]; deleted: string[] }> {
	const ids = [
		...new Set(movieIds.map((id) => canonicalTitleId("movie", Number(id)))),
	].filter(whole)
	const inserted: string[] = []
	const deleted: string[] = []
	for (let start = 0; start < ids.length; start += SETTLE_CHUNK) {
		const chunk = ids.slice(start, start + SETTLE_CHUNK)
		// The scores were written a moment ago, and none of these reads names a row by its whole key.
		await run("REFRESH TABLE user_score, user_watch_log, user_watch_state")
		const where = `WHERE user_id = ? AND media_type = 'movie' AND tmdb_id IN (${marks(chunk.length)})`
		const [scores, log, states] = await Promise.all([
			read<{ tmdb_id: number }>(`SELECT tmdb_id FROM user_score ${where}`, [
				userId,
				...chunk,
			]),
			read<{ tmdb_id: number; watch_id: string; origin: LogRow["origin"] }>(
				`SELECT tmdb_id, watch_id, origin FROM user_watch_log ${where}`,
				[userId, ...chunk],
			),
			read<{ tmdb_id: number }>(
				`SELECT tmdb_id FROM user_watch_state ${where}`,
				[userId, ...chunk],
			),
		])
		const scored = new Set(scores.map((r) => Number(r.tmdb_id)))
		const stated = new Set(states.map((r) => Number(r.tmdb_id)))
		const now = Date.now()
		const insert: LogRow[] = []
		const remove: string[] = []
		const stateInsert: number[] = []
		const stateDelete: number[] = []
		for (const movieId of chunk) {
			const settled = settleMovieRows({
				movieId,
				log: log
					.filter((r) => Number(r.tmdb_id) === movieId)
					.map((r) => ({
						...movieLogRow(movieId, r.watch_id, r.origin, undefined, now),
					})),
				hasScore: scored.has(movieId),
				hasState: stated.has(movieId),
				now,
			})
			insert.push(...settled.insert)
			remove.push(...settled.deleteIds)
			if (settled.stateWrite === "insert") stateInsert.push(movieId)
			if (settled.stateWrite === "delete") stateDelete.push(movieId)
		}
		await insertLog(userId, insert, now)
		await deleteLog(userId, remove)
		if (stateInsert.length)
			await insertRows(
				"user_watch_state",
				STATE_COLUMNS,
				stateInsert.map((movieId) => [
					userId,
					movieId,
					"movie",
					...stateValues(movieStateRow(now)),
					new Date(now),
					new Date(now),
				]),
				{ conflict: STATE_KEY },
			)
		if (stateDelete.length)
			await run(
				`DELETE FROM user_watch_state WHERE user_id = ? AND media_type = 'movie' AND tmdb_id IN (${marks(stateDelete.length)})`,
				[userId, ...stateDelete],
			)
		inserted.push(...insert.map((r) => r.watch_id))
		deleted.push(...remove)
	}
	return { inserted, deleted }
}

async function applyMovieEvent(
	userId: string,
	movieId: number,
	event: Exclude<TrackingAction, { type: "editWatchDate" | "setGroupDate" }>,
	actionId?: string,
): Promise<TrackingResult> {
	const title: TrackedTitle = { mediaType: "movie", tmdbId: movieId }
	const inserted: string[] = []
	const deleted: string[] = []
	let clear = { wantToSee: false, notInterested: false }
	switch (event.type) {
		case "watch": {
			if (!validId(actionId)) return refusal(BAD_ID)
			if (!validWhen(event.when)) return refusal("No such day.")
			const now = Date.now()
			if (!dayHasCome(event.when, now)) return refusal(NOT_YET)
			const { rowcount } = await insertLog(
				userId,
				[movieLogRow(movieId, actionId, "single", event.when, now)],
				now,
			)
			if (rowcount === 1) inserted.push(actionId)
			clear = { wantToSee: true, notInterested: true }
			break
		}
		case "deleteWatch": {
			// The watch a score owns is not the member's to delete: the rule would put it back. Once a date made it
			// their own it is, though it keeps the id.
			if (event.watchId === scoreWatchId(movieId)) {
				const [owned] = await read<{ origin: string }>(
					"SELECT origin FROM user_watch_log WHERE user_id = ? AND watch_id = ?",
					[userId, event.watchId],
				)
				if (owned?.origin === "score")
					return refusal(
						"This watch comes from your score. It goes when the score is cleared.",
					)
			}
			const result = await run(
				"DELETE FROM user_watch_log WHERE user_id = ? AND watch_id = ? AND media_type = 'movie' AND tmdb_id = ?",
				[userId, event.watchId, movieId],
			)
			if ((result.rowcount || 0) >= 1) deleted.push(event.watchId)
			break
		}
		case "removeWatches": {
			// Read by the movie, not by a key: the rows of the member's previous action have to be visible.
			await run("REFRESH TABLE user_watch_log")
			const mine = (await readLog(userId, title))
				.filter((watch) => watch.origin !== "score")
				.map((watch) => watch.watch_id)
			await deleteLog(userId, mine)
			deleted.push(...mine)
			break
		}
		case "restoreWatches": {
			const rows = Array.isArray(event.rows) ? event.rows : []
			const now = Date.now()
			const ids = new Set(rows.map((row) => row?.watchId))
			if (!rows.length || rows.length > MAX_RESTORED || ids.size !== rows.length)
				return refusal(NOT_RESTORABLE)
			if (!rows.every((row) => restorable(row, movieId, now)))
				return refusal(NOT_RESTORABLE)
			// An imported watch names its import, and that import is this member's.
			const imports = [
				...new Set(rows.flatMap((row) => (row.importId ? [row.importId] : []))),
			]
			if (imports.length) {
				const owned = await read<{ id: string }>(
					`SELECT id FROM user_import WHERE user_id = ? AND id IN (${marks(imports.length)})`,
					[userId, ...imports],
				)
				if (owned.length !== imports.length) return refusal(NOT_RESTORABLE)
			}
			for (const row of rows) {
				const log: LogRow = {
					...movieLogRow(movieId, row.watchId, row.origin, undefined, now),
					watched_at: row.watchedAt,
					watched_at_precision: row.precision,
					import_id: row.importId,
					created_at: row.createdAt,
				}
				// A stored id is left as it is, so the same Undo sent twice restores once.
				const { rowcount } = await insertLog(userId, [log], now)
				if (rowcount === 1) inserted.push(row.watchId)
				// The deleted watch had the score's id (a date had made it the member's own), and the rule has put the
				// score's watch back under that id since: that row becomes the member's own again.
				else if (row.watchId === scoreWatchId(movieId))
					await run(
						`UPDATE user_watch_log SET origin = 'single', watched_at = ?, watched_at_precision = ?, updated_at = ?
						 WHERE user_id = ? AND watch_id = ? AND origin = 'score'`,
						[
							at(row.watchedAt),
							row.precision,
							new Date(now),
							userId,
							row.watchId,
						],
					)
			}
			break
		}
		case "rate":
			break
		default:
			return refusal("A movie is watched or rated. It has no other status.")
	}
	const settled = await settleMovie(userId, movieId)
	// A score takes the movie off Not interested, and off the Wishlist when the score is what makes the movie
	// Seen. That is asked of the rows and not of this request, so that a request sent again still clears it.
	if (event.type === "rate" && event.score !== null)
		clear = { wantToSee: settled.byScoreAlone, notInterested: true }
	const cleared = await clearIntentions(userId, title, clear)
	await finish(userId)
	return {
		status: "applied",
		refused: null,
		state: settled.state,
		row: null,
		inserted: [...inserted, ...settled.inserted],
		deleted: [...deleted, ...settled.deleted],
		cleared,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Dates in the log. Neither touches a state row.
// ---------------------------------------------------------------------------------------------------------

async function editWatchDate(
	userId: string,
	title: TrackedTitle,
	event: Extract<TrackingAction, { type: "editWatchDate" }>,
): Promise<TrackingResult> {
	const when = event.when
	if (
		!when ||
		(when.precision !== "unknown" &&
			!(when.precision === "day" && isDay(when.day)))
	)
		return refusal("No such day.")
	const now = new Date()
	if (!dayHasCome(when, now.getTime())) return refusal(NOT_YET)
	const date = watchedAt(when, now.getTime())
	const result = await run(
		`UPDATE user_watch_log SET watched_at = ?, watched_at_precision = ?, updated_at = ?
		 WHERE user_id = ? AND watch_id = ? AND media_type = ? AND tmdb_id = ?`,
		[
			at(date.watched_at),
			date.watched_at_precision,
			now,
			userId,
			event.watchId,
			title.mediaType,
			title.tmdbId,
		],
	)
	if ((result.rowcount || 0) < 1)
		return refusal("That watch is not in the log.")
	// A date the member sets makes the score's watch their own record: clearing the score later leaves it.
	if (date.watched_at !== null && event.watchId === scoreWatchId(title.tmdbId))
		await run(
			`UPDATE user_watch_log SET origin = 'single', updated_at = ?
			 WHERE user_id = ? AND watch_id = ? AND origin = 'score'`,
			[now, userId, event.watchId],
		)
	await finish(userId)
	return { ...refusal(""), status: "applied", refused: null }
}

async function setGroupDate(
	userId: string,
	title: TrackedTitle,
	event: Extract<TrackingAction, { type: "setGroupDate" }>,
): Promise<TrackingResult> {
	if (!isDay(event.day)) return refusal("No such day.")
	const now = new Date()
	// The group's rows were inserted a moment ago, and this update finds them by a column that is not the key.
	await run("REFRESH TABLE user_watch_log")
	const result = await run(
		`UPDATE user_watch_log SET watched_at = ?, watched_at_precision = 'day', updated_at = ?
		 WHERE user_id = ? AND group_id = ? AND media_type = ? AND tmdb_id = ?`,
		[
			new Date(`${event.day}T00:00:00Z`),
			now,
			userId,
			event.group,
			title.mediaType,
			title.tmdbId,
		],
	)
	if ((result.rowcount || 0) < 1) return refusal("That group has no watch.")
	await finish(userId)
	return { ...refusal(""), status: "applied", refused: null }
}

// ---------------------------------------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------------------------------------

const TRACKING_TABLES = [
	"user_watch_log",
	"user_watch_state",
	"user_import_item",
	"user_import",
]

const isMissingColumn = (error: unknown, column: string) =>
	new RegExp(`ColumnUnknown.*\\b${column}\\b`).test(
		String((error as { message?: unknown } | null)?.message ?? error),
	)

const isMissingTable = (error: unknown, table: string) => {
	const message = String(
		(error as { message?: unknown } | null)?.message ?? error,
	)
	return /RelationUnknown|SchemaUnknown/.test(message) && message.includes(table)
}

/**
 * Deletes everything tracking stores for a member: their watch log, their watch states, and their imports with the
 * rows of the files. Hard deletes: the rows are private and nothing public points at them. Their rows in the
 * retired `user_watch_history` go too, while that table still exists as the backup.
 */
export async function deleteTrackingData(userId: string): Promise<void> {
	if (!userId) return
	// A delete by member names no row by its whole key, so it works on the rows of the last refresh.
	await run(`REFRESH TABLE ${TRACKING_TABLES.join(", ")}`)
	for (const table of TRACKING_TABLES)
		await run(`DELETE FROM ${table} WHERE user_id = ?`, [userId])
	try {
		await run("DELETE FROM user_watch_history WHERE user_id = ?", [userId])
	} catch (error) {
		if (!isMissingTable(error, "user_watch_history")) throw error
	}
	await resetUserDataCache({ user_id: userId })
}

// ---------------------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------------------

/** QS and QG, beside each other. Timestamps arrive as milliseconds. */
async function readStatesAndGroups(
	userId: string,
): Promise<[TitleState[], GroupRow[]]> {
	return Promise.all([
		query<TitleState>(STATES_QUERY, [userId]),
		query<GroupRow>(GROUPED_QUERY, [userId]),
	])
}

/**
 * What the log and the state say about each of a member's titles: the state, the watch count, the progress of the
 * current pass, the furthest episode, the latest watch and the last activity. One grouped query over the member's
 * log and one read of their states; a title is in the result when it has a state or a log row.
 */
export async function getWatchTotals(
	userId: string,
): Promise<Map<TitleKey, TitleTotals>> {
	const [states, groups] = await readStatesAndGroups(userId)
	return titleTotals(states, groups)
}

/**
 * The `watchState` entry of the member data map: one entry per title whose state is not Not started, read fresh.
 * `getUserData` builds the same entry from the same two statements beside its other reads, and caches it.
 */
export async function getWatchState(
	userId: string,
): Promise<Record<TitleKey, WatchStateEntry>> {
	const [states, groups] = await readStatesAndGroups(userId)
	return watchStateOf(states, groups)
}

/**
 * What the show page holds for one show: the member's state row and every watch of the show, in the order of
 * the episodes. The state is read in real time; the log rows are as fresh as the last refresh, which every write
 * through `applyTrackingEvent` ends with.
 */
export async function getShowTracking(
	userId: string,
	showId: number,
): Promise<{ state: StateRow | null; log: LogRow[] }> {
	const title: TrackedTitle = { mediaType: "show", tmdbId: showId }
	const [state, log] = await Promise.all([
		readState(userId, title),
		readLog(userId, title),
	])
	return { state: stateOnly(state), log }
}

/** A movie's state row and its watch log, newest first, undated watches last. */
export async function getMovieTracking(
	userId: string,
	movieId: number,
): Promise<{ state: StateRow | null; log: LogRow[] }> {
	const title: TrackedTitle = {
		mediaType: "movie",
		tmdbId: canonicalTitleId("movie", movieId),
	}
	const [state, log] = await Promise.all([
		readState(userId, title),
		readLog(userId, title),
	])
	return { state: stateOnly(state), log }
}

// Tracking on the server: the one writer for the watch log and the watch state, and their reads
// (docs/implementation/tracking/data-model.md, ADR 0008, ADR 0009).
//
// The interface is `applyTrackingEvent` for every action on a title, `settleMovie` and `settleMovies` for the paths
// that write movies' scores themselves, `deleteTrackingData`, and four reads. Everything else is hidden here and in
// domain/tracking: the state machine, the mapping between its record and the two tables, the order of the writes,
// the check that keeps two actions on one show from overwriting each other, and what a request that is sent twice
// does.
//
// The writer does not write `user_score`. It clears intentions, and status-only import Undo restores those rows.
// Setting a score, adding to the Wishlist and marking Not interested stay with their own writers. The score's
// writers call in here with `rate` after their write (scores.server.ts, the guest transfer) or settle their movies
// (the IMDb import). wishList.server.ts and not-interested.server.ts do not call in yet: the only row of the table
// they would take is Want to See on a Dropped show, and nothing in the interface drops a show yet.
import { createHash, randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import type { UndoOutcome } from "~/domain/import-result"
import {
	type ImportItem,
	type ImportSource,
	isApplicableStatus,
} from "~/domain/imports"
import {
	type ListedEpisode,
	PROTECTED_STATES,
	STATES,
	type TrackingEvent,
	type WatchedWhen,
	facts,
	groupWatchId,
	importShowStatus,
	isDay,
	serverShow,
	showAiredBy,
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
	episodeScoreWatchId,
	movieLogRow,
	movieStateRow,
	recordFromRows,
	scoreWatchId,
	settleMovieRows,
	stateRowOf,
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
import {
	captureProductEvent,
	eventUuid,
	withProductContext,
} from "~/telemetry/product-analytics.server"
import { cached } from "~/utils/cache"
import {
	type CrateValue,
	execute,
	insertRows,
	isCrateRecoveryError,
	query,
	timestampsAsMillis,
} from "~/utils/crate"
import { crateEvent, withCrateOperation } from "~/utils/crate-diagnostics"
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

/**
 * The writer's own answer for a show event, inside this module: also when its rows were recorded (their
 * `created_at`) and how many of them this call wrote; a row whose id was stored already isn't counted.
 */
type StoredShowResult = TrackingResult & {
	recorded?: { at: number; written: number }
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

type StoredState = StateRow & {
	/** Immutable receipt for the first physical show-state insert, retained through logical deletion. */
	insert_token: string | null
	_seq_no: number
	_primary_term: number
	updated_at: number
}

async function readState(
	userId: string,
	title: TrackedTitle,
): Promise<StoredState | null> {
	const [row] = await read<Record<string, unknown>>(STATE_ROW_QUERY, [
		userId,
		title.tmdbId,
		title.mediaType,
	])
	return storedState(row)
}

function storedState(
	row: Record<string, unknown> | undefined,
): StoredState | null {
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
		insert_token: (row.insert_token as string | null) ?? null,
		_seq_no: Number(row._seq_no),
		_primary_term: Number(row._primary_term),
		updated_at: ms(row.updated_at) ?? 0,
	}
}

const stateOnly = (row: StoredState | null): StateRow | null => {
	if (!row) return null
	const { _seq_no, _primary_term, updated_at, insert_token, ...state } = row
	// The empty Not started row is a physical fence/receipt, not a member state or a remembered prompt.
	if (
		state.state === "not_started" &&
		state.pass === 1 &&
		state.rate_prompt_dismissed_at === null &&
		state.seen_question === null
	)
		return null
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
	const result = await insertRows(
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
	if (result.rowcount)
		captureProductEvent(userId, "watch logged", {
			watch_count: result.rowcount,
			tmdb_id:
				new Set(rows.map((r) => r.tmdb_id)).size === 1
					? rows[0]?.tmdb_id
					: undefined,
			media_type: rows[0]?.media_type,
			tmdb_ids: [...new Set(rows.map((r) => r.tmdb_id))].slice(0, 100),
			origin: rows[0]?.origin,
			import_id: rows[0]?.import_id ?? undefined,
			batch_id: rows[0]?.group_id ?? undefined,
			watch_id: rows.length === 1 ? rows[0]?.watch_id : undefined,
			season_number:
				rows.length === 1 ? (rows[0]?.season_number ?? undefined) : undefined,
			episode_number:
				rows.length === 1 ? (rows[0]?.episode_number ?? undefined) : undefined,
			date_precision:
				rows.length === 1 ? rows[0]?.watched_at_precision : undefined,
		})
	return result
}

/** Deletes log rows by their whole key, which Crate does in real time. */
async function deleteLog(userId: string, watchIds: readonly string[]) {
	for (let start = 0; start < watchIds.length; start += DELETE_CHUNK) {
		const ids = watchIds.slice(start, start + DELETE_CHUNK)
		const removed = await run(
			`DELETE FROM user_watch_log WHERE user_id = ? AND watch_id IN (${marks(ids.length)})`,
			[userId, ...ids],
		)
		if (removed.rowcount)
			captureProductEvent(userId, "watch removed", {
				removed_count: removed.rowcount,
			})
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
	if (title.mediaType === "movie") {
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
	// A show key is never removed by a tracking action. This token identifies our first insert even after
	// a later action replaces its values with an empty receipt. An identical delayed insert cannot recreate it.
	const token = randomUUID()
	const columns = [...STATE_COLUMNS, "insert_token"]
	const params: CrateValue[] = [
		userId,
		title.tmdbId,
		title.mediaType,
		...stateValues(row),
		new Date(now),
		new Date(now),
		token,
	]
	const statement = `INSERT INTO user_watch_state (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${marks(columns.length)}) ON CONFLICT (${STATE_KEY.map((c) => `"${c}"`).join(", ")}) DO NOTHING`
	return withCrateOperation("tracking.insertState", async () => {
		let lost: unknown
		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				const result = await run(statement, params)
				if ((result.rowcount || 0) === 1) return true
				if (!lost) return false // A known conflict: the original was not applied.
			} catch (error) {
				if (!isCrateRecoveryError(error)) throw error
				lost = error
			}
			const current = await readState(userId, title)
			const ours = current?.insert_token === token
			crateEvent("crate.readback", {
				attempt,
				outcome: ours ? "applied" : current ? "conflict" : "absent",
				guard: "insert_token",
			})
			if (ours) return true
			// A different creator is ambiguous to the domain event: its log effects may already have been observed
			// and undone. Never restart that event over a newer action after an indeterminate first insert.
			if (current || attempt === 2) throw lost
			crateEvent("crate.replay", {
				attempt: 2,
				outcome: "started",
				guard: "retained_title_key",
			})
		}
		throw lost
	})
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
	const applied = await writeStateStored(userId, title, write, row, before, now)
	if (
		applied &&
		write !== "none" &&
		((before?.state ?? "not_started") !== (row?.state ?? "not_started") ||
			(before?.pass ?? 1) !== (row?.pass ?? 1))
	)
		captureProductEvent(userId, "watch state changed", {
			tmdb_id: title.tmdbId,
			media_type: title.mediaType,
			from_state: before?.state ?? "not_started",
			to_state: row?.state ?? "not_started",
			pass: row?.pass ?? 1,
			previous_pass: before?.pass ?? 1,
		})
	return applied
}

async function writeStateStored(
	userId: string,
	title: TrackedTitle,
	write: "insert" | "update" | "delete" | "none",
	row: StateRow | null,
	before: StoredState | null,
	now: number,
): Promise<boolean> {
	if (write === "none") return true
	if (write === "insert" && !before)
		return row ? insertState(userId, title, row, now) : true
	// Logical removal retains the physical key and its immutable receipt. Even a still-running original INSERT
	// loses ON CONFLICT after an unwatch. A later real watch updates this key by its original CAS version.
	const storedRow: StateRow = row ?? {
		state: "not_started",
		state_changed_at: now,
		pass: 1,
		seen_press_group: null,
		seen_press_from: null,
		rate_prompt_dismissed_at: null,
		seen_question: null,
	}
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
	// Keep this statement, its values, timestamp and version unchanged through recovery. The version predicate
	// permits at most one application, including when the first response is lost while its request still runs.
	const submit = () =>
		run(
			`UPDATE user_watch_state
					 SET state = ?, state_changed_at = ?, pass = ?, seen_press_group = ?, seen_press_from = ?,
					     rate_prompt_dismissed_at = ?, seen_question = ?, updated_at = ?
					 ${unchanged}`,
			[...stateValues(storedRow), new Date(now), ...key],
		)
	return withCrateOperation("tracking.writeState", async () => {
		const inspect = async () => {
			const current = await readState(userId, title)
			const applied = Boolean(
				current &&
					current._seq_no !== before._seq_no &&
					current.updated_at === now &&
					isDeepStrictEqual(stateOnly(current), row),
			)
			const stillBefore =
				current?._seq_no === before._seq_no &&
				current?._primary_term === before._primary_term
			crateEvent("crate.readback", {
				outcome: applied ? "applied" : stillBefore ? "unchanged" : "conflict",
			})
			return { applied, stillBefore }
		}
		try {
			return ((await submit()).rowcount || 0) >= 1
		} catch (error) {
			if (!isCrateRecoveryError(error)) throw error
			const checked = await inspect()
			if (checked.applied) return true
			// Another version without ours is ambiguous: ours may have landed and then been superseded by that
			// writer. False would make the caller apply this event again over the newer state, so fail instead.
			if (!checked.stillBefore) throw error
			crateEvent("crate.replay", {
				attempt: 2,
				outcome: "started",
				guard: "original_version",
			})
			try {
				if (((await submit()).rowcount || 0) >= 1) return true
			} catch (retryError) {
				if (!isCrateRecoveryError(retryError)) throw retryError
				if ((await inspect()).applied) return true
				throw retryError
			}
			// The version moved after the readback: the original landed in between, or another writer did, possibly
			// after ours. Only our own row proves the outcome. Anything else is indeterminate, not a conflict.
			if ((await inspect()).applied) return true
			throw error
		}
	})
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
	if (wantToSeeAddedAt)
		captureProductEvent(userId, "want to see removed", {
			tmdb_id: title.tmdbId,
			media_type: title.mediaType,
			origin: "tracking",
		})
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
			return query<EpisodeListRow>(EPISODE_LIST_WITHOUT_OVERVIEW_QUERY, [
				showId,
			])
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
	return withProductContext(
		{
			tmdb_id: canonicalTitleId(title.mediaType, title.tmdbId),
			media_type: title.mediaType,
			action: event.type,
		},
		async () => {
			const result = await applyTrackingEventStored(
				userId,
				title,
				event,
				actionId,
			)
			if (result.status === "applied") {
				const properties = {
					action: event.type,
					to_state: result.state?.state,
					pass: result.state?.pass,
					watch_count: result.inserted.length,
					removed_count: result.deleted.length,
					season_number: "season" in event ? event.season : undefined,
					episode_number: "number" in event ? event.number : undefined,
				}
				captureProductEvent(
					userId,
					"tracking action applied",
					properties,
					actionId
						? {
								uuid: eventUuid(
									`tracking:${userId}:${title.mediaType}:${title.tmdbId}:${event.type}:${actionId}`,
								),
							}
						: {},
				)
				if (event.type === "editWatchDate" || event.type === "setGroupDate")
					captureProductEvent(userId, "watch date changed", {
						action: event.type,
					})
			}
			return result
		},
	)
}

async function applyTrackingEventStored(
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
	const { recorded: _recorded, ...result } = await applyShowEventStored(
		userId,
		canonical,
		event as TrackingEvent,
		actionId,
	)
	return result
}

const NEEDS_ID = [
	"watch",
	"pressSeen",
	"markSeason",
	"markRange",
	"markEpisodes",
	"watchUpTo",
]

/** How many watches a Seen press that is put back can have: more than any show lists episodes. */
const MAX_PRESS_WATCHES = 20_000
const PRESS_NOT_RESTORABLE = "That Seen press can't be put back."

/**
 * Whether a Seen press could have stood for this show, by what it says about itself. The Undo of taking a press
 * back sends the press as the page held it, so everything in it is checked as a member's input: the group is one
 * the browser made, or the migration's for this show; every watch is a regular episode's and carries the id a
 * press under that group gives it; the dates fit their precision and have come; and no time lies ahead.
 */
function restorablePress(
	event: Extract<TrackingEvent, { type: "restoreSeen" }>,
	showId: number,
	now: number,
): boolean {
	const { group, from, pass, changedAt, watches } = event
	if (!validId(group) && group !== `mig-seen-${showId}`) return false
	if (!STATES.includes(from)) return false
	if (!whole(pass) || pass < 1) return false
	const past = (at: unknown) =>
		typeof at === "number" &&
		Number.isFinite(at) &&
		at > 0 &&
		at <= now + 60_000
	if (!past(changedAt)) return false
	if (!Array.isArray(watches) || watches.length > MAX_PRESS_WATCHES)
		return false
	const ids = new Set<string>()
	for (const watch of watches) {
		if (!watch || typeof watch !== "object") return false
		const { id, episodeId, season, number, watchedAt, precision } = watch
		if (!whole(episodeId) || !whole(season) || season < 1 || !whole(number))
			return false
		if (id !== groupWatchId(group, episodeId) || ids.has(id)) return false
		ids.add(id)
		if (!past(watch.createdAt)) return false
		if (precision === "unknown") {
			if (watchedAt !== null) return false
			continue
		}
		if (typeof watchedAt !== "number" || !Number.isFinite(watchedAt))
			return false
		if (watchedAt < 0 || watchedAt >= latestDay(now)) return false
		if (precision === "day" ? watchedAt % DAY_MS !== 0 : precision !== "moment")
			return false
	}
	return true
}

const SEASON_NOT_RESTORABLE = "That season can't be put back."
const UNMARKED_FROM = ["watching", "on_hold", "dropped", "seen"]

/**
 * Whether these watches could have been removed from this show's log by Unmark season, by what the event says
 * about itself. The Undo sends the rows as the page held them, so everything in it is checked as a member's input:
 * the state is one a show with watches has; a press stands only on a Seen show, under an id the browser or this
 * show's migration made; every watch is a regular episode's and has the id its origin gives it (the browser's for
 * a tick, the group's for a group action, an import's for an imported one, its episode's for a score's); the dates fit their precision and have
 * come; and no time lies ahead. Whose import an imported watch names is checked against the table.
 */
function restorableSeason(
	event: Extract<TrackingEvent, { type: "restoreSeason" }>,
	showId: number,
	now: number,
): boolean {
	const { from, press, pass, changedAt, watches } = event
	const migrated = `mig-seen-${showId}`
	if (!UNMARKED_FROM.includes(from)) return false
	if (press !== null) {
		if (!press || typeof press !== "object" || from !== "seen") return false
		if (!validId(press.group) && press.group !== migrated) return false
		if (!STATES.includes(press.from)) return false
	}
	if (!whole(pass) || pass < 1) return false
	const past = (at: unknown) =>
		typeof at === "number" &&
		Number.isFinite(at) &&
		at > 0 &&
		at <= now + 60_000
	if (!past(changedAt)) return false
	if (
		!Array.isArray(watches) ||
		!watches.length ||
		watches.length > MAX_PRESS_WATCHES
	)
		return false
	const ids = new Set<string>()
	for (const watch of watches) {
		if (!watch || typeof watch !== "object") return false
		const { id, episodeId, season, number, origin, group, importId } = watch
		if (typeof id !== "string" || ids.has(id)) return false
		ids.add(id)
		if (!whole(season) || season < 1 || !whole(number)) return false
		if (origin === "import") {
			if (!IMPORT_WATCH_ID.test(id) || group !== null) return false
			if (typeof importId !== "string" || !importId || importId.length > 80)
				return false
			if (episodeId !== null && !whole(episodeId)) return false
		} else if (origin === "single") {
			if (group !== null || importId !== null) return false
			if (!whole(episodeId)) return false
			// A tick, or an episode score's watch the member dated, which keeps its id.
			if (!validId(id) && id !== episodeScoreWatchId(episodeId)) return false
		} else if (origin === "score") {
			// The watch an episode's score recorded: its id names its episode.
			if (!whole(episodeId) || group !== null || importId !== null) return false
			if (id !== episodeScoreWatchId(episodeId)) return false
		} else if (origin === "season" || origin === "upto" || origin === "seen") {
			if (typeof group !== "string") return false
			if (!validId(group) && !(origin === "seen" && group === migrated))
				return false
			if (!whole(episodeId) || importId !== null) return false
			if (id !== groupWatchId(group, episodeId)) return false
		} else return false
		if (!past(watch.createdAt)) return false
		const { watchedAt, precision } = watch
		if (precision === "unknown") {
			if (watchedAt !== null) return false
			continue
		}
		if (typeof watchedAt !== "number" || !Number.isFinite(watchedAt))
			return false
		if (watchedAt < 0 || watchedAt >= latestDay(now)) return false
		if (precision === "day" ? watchedAt % DAY_MS !== 0 : precision !== "moment")
			return false
	}
	return true
}

/** Every one of these imports is this member's. */
async function ownsImports(
	userId: string,
	importIds: readonly (string | null)[],
): Promise<boolean> {
	const imports = [...new Set(importIds.filter((id) => id !== null))]
	if (!imports.length) return true
	const owned = await read<{ id: string }>(
		`SELECT id FROM user_import WHERE user_id = ? AND id IN (${marks(imports.length)})`,
		[userId, ...imports],
	)
	return owned.length === imports.length
}

/** The id of the watch an episode's score records: made here, never by the browser. */
const EPISODE_SCORE_WATCH_ID = /^score-e[1-9][0-9]{0,15}$/

function invalid(
	event: TrackingEvent,
	showId: number,
	actionId?: string,
	origin?: "score",
): string | null {
	if (origin === "score") {
		if (event.type !== "watch" || !EPISODE_SCORE_WATCH_ID.test(actionId ?? ""))
			return BAD_ID
	} else if (NEEDS_ID.includes(event.type) && !validId(actionId)) return BAD_ID
	if ("season" in event && !whole(event.season)) return "No such season."
	if ("number" in event && !whole(event.number)) return "No such episode."
	if (event.type === "watch" && !validWhen(event.when)) return "No such day."
	if (
		event.type === "restoreSeen" &&
		!restorablePress(event, showId, Date.now())
	)
		return PRESS_NOT_RESTORABLE
	if (
		event.type === "restoreSeason" &&
		!restorableSeason(event, showId, Date.now())
	)
		return SEASON_NOT_RESTORABLE
	return null
}

async function applyShowEventStored(
	userId: string,
	title: TrackedTitle,
	event: TrackingEvent,
	actionId?: string,
	/** "score": the watch an episode's score records (`markScoredEpisodeWatched`). */
	origin?: "score",
	/**
	 * Delete this watch only while it is still the version read here (`_seq_no`, `_primary_term`), so a change made
	 * since, such as a date set on it, keeps it. The action is refused when it changed.
	 */
	guard?: { watchId: string; seq: number; term: number },
): Promise<StoredShowResult> {
	const bad = invalid(event, title.tmdbId, actionId, origin)
	if (bad) return refusal(bad)
	// An imported watch names its import, and that import is this member's.
	if (
		event.type === "restoreSeason" &&
		!(await ownsImports(
			userId,
			event.watches.map((watch) => watch.importId),
		))
	)
		return refusal(SEASON_NOT_RESTORABLE)
	// Log rows an earlier round of this call inserted. They were worked out from a state that has changed since.
	let stale: string[] = []
	for (let round = 0; round <= STATE_RETRIES; round++) {
		// 1. So that the read below sees the rows of the member's previous action.
		await run("REFRESH TABLE user_watch_log")
		// 2. The state row (real-time), the show's log rows, the cached episode list.
		const [before, stored, episodes] = await Promise.all([
			readState(userId, title),
			readLog(userId, title),
			getEpisodeList(title.tmdbId),
		])
		// An action that took away a row of the last round had read it: the member undid this event, and running it
		// again would put that watch back over their later choice. Rows still there are taken out and written again.
		if (stale.some((id) => !stored.some((r) => r.watch_id === id))) {
			await finish(userId)
			throw new TrackingConflictError()
		}
		const log = stored.filter((r) => !stale.includes(r.watch_id))
		if (stale.length) {
			await deleteLog(userId, stale)
			stale = []
		}
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
			origin,
		})
		if (applied.refused) {
			if (round > 0) await finish(userId)
			return refusal(applied.refused, stateOnly(before))
		}
		const { insert, deleteIds, state, stateWrite, clear } = applied.changes
		// 4. The log rows: one insert, or one delete naming the rows the machine removed.
		const { rowcount: written } = await insertLog(userId, insert, now)
		if (guard && deleteIds.includes(guard.watchId)) {
			const { rowcount } = await run(
				"DELETE FROM user_watch_log WHERE user_id = ? AND watch_id = ? AND _seq_no = ? AND _primary_term = ?",
				[userId, guard.watchId, guard.seq, guard.term],
			)
			if (rowcount !== 1) {
				await finish(userId)
				return refusal("That watch changed since.", stateOnly(before))
			}
		}
		await deleteLog(
			userId,
			guard ? deleteIds.filter((id) => id !== guard.watchId) : deleteIds,
		)
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
			recorded: { at: now, written: written ?? 0 },
		}
	}
	await finish(userId)
	throw new TrackingConflictError()
}

// ---------------------------------------------------------------------------------------------------------
// The watch an episode's score records (#759 follow-up)
// ---------------------------------------------------------------------------------------------------------

/** Any pass has a watch of this episode: by its TMDB id, or by its numbers for a watch stored without one. */
const watchedInAnyPass = (log: readonly LogRow[], episode: EpisodeListRow) =>
	log.some(
		(row) =>
			row.episode_tmdb_id === episode.tmdb_id ||
			(row.episode_tmdb_id == null &&
				row.season_number === episode.season_number &&
				row.episode_number === episode.episode_number),
	)

/**
 * Scoring an episode by hand (the episode page's control, rate_title) also marks it watched: one undated watch with
 * origin `score` and the id `score-e<episode id>`, through the state machine like a tick, so the show's state follows.
 * Nothing is recorded when any pass already has a watch of the episode, when it isn't in the show's list, or when it
 * hasn't aired. Season and part scores don't call this. Answers the id of the watch it added, or null.
 *
 * An import records its own watch instead (imports/episode-score-watches.server.ts): an imported one, which keeps
 * the show's status as imports do and which the import's Undo takes back.
 */
export async function markScoredEpisodeWatched(
	userId: string,
	showId: number,
	episodeTmdbId: number,
): Promise<{ watchId: string; createdAt: number } | null> {
	const title: TrackedTitle = {
		mediaType: "show",
		tmdbId: canonicalTitleId("show", showId),
	}
	if (!userId || !whole(title.tmdbId) || !whole(episodeTmdbId)) return null
	await run("REFRESH TABLE user_watch_log")
	const [log, episodes] = await Promise.all([
		readLog(userId, title),
		getEpisodeList(title.tmdbId),
	])
	const episode = episodes.find((row) => row.tmdb_id === episodeTmdbId)
	if (!episode || watchedInAnyPass(log, episode)) return null
	const watchId = episodeScoreWatchId(episodeTmdbId)
	const result = await applyShowEventStored(
		userId,
		title,
		{
			type: "watch",
			season: episode.season_number,
			number: episode.episode_number,
			when: { precision: "unknown" },
		},
		watchId,
		"score",
	)
	// The time this call's own insert recorded tells this watch from one a later score records under the same id.
	// Not read back: by then the row can already be that later watch.
	const recorded = result.recorded
	if (
		result.status !== "applied" ||
		!result.inserted.includes(watchId) ||
		!recorded
	)
		return null
	if (recorded.written === 1) return { watchId, createdAt: recorded.at }
	// Nothing written: an earlier attempt of this same call landed and its answer was lost. The stored row is ours
	// only when it is exactly what this call wrote.
	const stored = await scoreWatchRow(userId, title.tmdbId, watchId)
	return stored?.createdAt === recorded.at
		? { watchId, createdAt: recorded.at }
		: null
}

/** The score's watch of an episode as it is now (a read by the whole key), while it is still the score's. */
async function scoreWatchRow(userId: string, showId: number, watchId: string) {
	const [row] = await read<{
		origin: string
		watched_at: number | string | Date | null
		created_at: number | string | Date
		_seq_no: number
		_primary_term: number
	}>(
		"SELECT origin, watched_at, created_at, _seq_no, _primary_term FROM user_watch_log WHERE user_id = ? AND watch_id = ? AND media_type = 'show' AND tmdb_id = ?",
		[userId, watchId, showId],
	)
	if (!row || row.origin !== "score" || row.watched_at !== null) return null
	return {
		createdAt: ms(row.created_at) ?? 0,
		seq: Number(row._seq_no),
		term: Number(row._primary_term),
	}
}

/**
 * Takes back the watch `markScoredEpisodeWatched` recorded for this episode, while it is still the score's: undated
 * and not made the member's own since (a date makes it theirs, as for a movie's score watch). With `createdAt`, only
 * the watch recorded then: a later score's watch under the same id stays. The delete names the version read here,
 * so a date set in between keeps the watch. Through the state machine, so a show the watch had started goes back to
 * Not started. Answers the id of the watch it removed, or null.
 */
export async function removeScoredEpisodeWatch(
	userId: string,
	showId: number,
	episodeTmdbId: number,
	createdAt?: number,
): Promise<string | null> {
	const title: TrackedTitle = {
		mediaType: "show",
		tmdbId: canonicalTitleId("show", showId),
	}
	if (!userId || !whole(title.tmdbId) || !whole(episodeTmdbId)) return null
	const watchId = episodeScoreWatchId(episodeTmdbId)
	const owned = await scoreWatchRow(userId, title.tmdbId, watchId)
	if (!owned || (createdAt !== undefined && owned.createdAt !== createdAt))
		return null
	const result = await applyShowEventStored(
		userId,
		title,
		{ type: "deleteWatch", watchId },
		undefined,
		undefined,
		{ watchId, seq: owned.seq, term: owned.term },
	)
	return result.status === "applied" && result.deleted.includes(watchId)
		? watchId
		: null
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
		if (await insertState(userId, title, state, now))
			captureProductEvent(userId, "watch state changed", {
				tmdb_id: title.tmdbId,
				media_type: "movie",
				from_state: "not_started",
				to_state: "seen",
			})
	}
	if (settled.stateWrite === "delete") {
		state = null
		await run(
			"DELETE FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			[userId, title.tmdbId, "movie"],
		)
	}
	if (settled.stateWrite === "delete")
		captureProductEvent(userId, "watch state changed", {
			tmdb_id: title.tmdbId,
			media_type: "movie",
			from_state: "seen",
			to_state: "not_started",
		})
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
		if (stateInsert.length) {
			const insertedStates = await insertRows(
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
			if (insertedStates.rowcount)
				captureProductEvent(userId, "watch state changed", {
					media_type: "movie",
					from_state: "not_started",
					to_state: "seen",
					watch_count: insertedStates.rowcount,
					tmdb_ids:
						insertedStates.rowcount === stateInsert.length
							? stateInsert.slice(0, 100)
							: undefined,
				})
		}
		if (stateDelete.length) {
			const deletedStates = await run(
				`DELETE FROM user_watch_state WHERE user_id = ? AND media_type = 'movie' AND tmdb_id IN (${marks(stateDelete.length)})`,
				[userId, ...stateDelete],
			)
			if (deletedStates.rowcount)
				captureProductEvent(userId, "watch state changed", {
					media_type: "movie",
					from_state: "seen",
					to_state: "not_started",
					removed_count: deletedStates.rowcount,
					tmdb_ids:
						deletedStates.rowcount === stateDelete.length
							? stateDelete.slice(0, 100)
							: undefined,
				})
		}
		inserted.push(...insert.map((r) => r.watch_id))
		deleted.push(...remove)
	}
	return { inserted, deleted }
}

/**
 * Whether a movie that is Seen through its score's watch is on the Wishlist as Want to rewatch: it was put there
 * after that watch was recorded. A place that is older is the Want to See the score fulfils. Both rows are read by
 * their whole keys, so a rating that is sent again answers as the first one would have.
 */
async function wantsRewatch(userId: string, movieId: number): Promise<boolean> {
	const [[watch], [wish]] = await Promise.all([
		read<{ created_at: number }>(
			"SELECT created_at FROM user_watch_log WHERE user_id = ? AND watch_id = ?",
			[userId, scoreWatchId(movieId)],
		),
		read<{ created_at: number | null; updated_at: number }>(
			"SELECT created_at, updated_at FROM user_wishlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			[userId, movieId, "movie"],
		),
	])
	if (!watch || !wish) return false
	return Number(wish.created_at ?? wish.updated_at) > Number(watch.created_at)
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
			if (
				!rows.length ||
				rows.length > MAX_RESTORED ||
				ids.size !== rows.length
			)
				return refusal(NOT_RESTORABLE)
			if (!rows.every((row) => restorable(row, movieId, now)))
				return refusal(NOT_RESTORABLE)
			// An imported watch names its import, and that import is this member's.
			if (
				!(await ownsImports(
					userId,
					rows.map((row) => row.importId),
				))
			)
				return refusal(NOT_RESTORABLE)
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
		clear = {
			wantToSee: settled.byScoreAlone && !(await wantsRewatch(userId, movieId)),
			notInterested: true,
		}
	// Want to rewatch lasts while the movie is Seen: a removed watch that leaves it not Seen takes it off the
	// Wishlist. A rated movie stays Seen through its score's watch, and stays on it.
	if (
		(event.type === "deleteWatch" || event.type === "removeWatches") &&
		deleted.length > 0 &&
		settled.state === null
	)
		clear = { ...clear, wantToSee: true }
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
	if (
		date.watched_at !== null &&
		(title.mediaType === "movie"
			? event.watchId === scoreWatchId(title.tmdbId)
			: EPISODE_SCORE_WATCH_ID.test(event.watchId))
	)
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
	return (
		/RelationUnknown|SchemaUnknown/.test(message) && message.includes(table)
	)
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

/** QS and QG, beside each other. The driver hands a timestamp over as a Date; the groups carry milliseconds. */
async function readStatesAndGroups(
	userId: string,
): Promise<[TitleState[], GroupRow[]]> {
	return Promise.all([
		query<TitleState>(STATES_QUERY, [userId]),
		query<GroupRow>(GROUPED_QUERY, [userId]).then(timestampsAsMillis),
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

// ---------------------------------------------------------------------------------------------------------
// Native exports: a durable, per-title plan, journaled by the importer before the first write.
// ---------------------------------------------------------------------------------------------------------

/** The sources an imported watch can come from: the native imports, and the IMDb ratings import's episode scores. */
type WatchSource = ImportSource | "imdb"

export const importWatchId = (source: WatchSource, key: string) =>
	`i-${createHash("sha1").update(`${source}:${key}`).digest("hex").slice(0, 32)}`

export type ImportStatusItem = ImportItem & {
	_previewStatus?: { _seq_no: number; _primary_term: number } | null
}

/** Preview snapshots in bounded batches; status-only rows need no episode catalog. */
export async function getImportStatusSnapshots(
	userId: string,
	showIds: number[],
) {
	const result = new Map<
		number,
		{ state: StoredState | null; hasWatches: boolean }
	>()
	await run("REFRESH TABLE user_watch_state, user_watch_log")
	for (let start = 0; start < showIds.length; start += 800) {
		const ids = showIds.slice(start, start + 800)
		const placeholders = ids.map(() => "?").join(", ")
		const [states, watches] = await Promise.all([
			read<Record<string, unknown>>(
				`SELECT tmdb_id, state, state_changed_at, pass, seen_press_group, seen_press_from, rate_prompt_dismissed_at, seen_question, insert_token, updated_at, _seq_no, _primary_term FROM user_watch_state WHERE user_id = ? AND media_type = 'show' AND tmdb_id IN (${placeholders}) LIMIT 800`,
				[userId, ...ids],
			),
			read<{ tmdb_id: number }>(
				`SELECT DISTINCT tmdb_id FROM user_watch_log WHERE user_id = ? AND media_type = 'show' AND tmdb_id IN (${placeholders}) LIMIT 800`,
				[userId, ...ids],
			),
		])
		const byId = new Map(
			states.map((row) => [Number(row.tmdb_id), storedState(row)]),
		)
		const watched = new Set(watches.map((row) => Number(row.tmdb_id)))
		for (const id of ids)
			result.set(id, {
				state: byId.get(id) ?? null,
				hasWatches: watched.has(id),
			})
	}
	return result
}

type Version = { _seq_no: number; _primary_term: number } | null
const sameVersion = (a: Version, b: Version) =>
	a?._seq_no === b?._seq_no && a?._primary_term === b?._primary_term

export interface ImportTrackingPlan {
	/** Watcharr and Plex Undo restore intentions only where no newer watches or choices remain. */
	restoreIntentions?: boolean
	/**
	 * The plan records watches only of episodes no pass has a watch of (`onlyUnwatched`): the apply checks again and
	 * keeps a watch whose episode was watched since. `keysByWatch` names each planned watch's item.
	 */
	onlyUnwatched?: { keysByWatch: Record<string, string> }
	/**
	 * Watches this plan wrote and then deleted as duplicates of a watch that landed meanwhile. The status and the
	 * lists the plan changed with them are still its own: Undo takes those back even with no watch left.
	 */
	pruned?: string[]
	priorWatchIds?: string[]
	userId: string
	importId: string
	title: TrackedTitle
	now: number
	beforeState: StoredState | null
	afterState: StateRow | null
	statusItem?: ImportItem
	watches: LogRow[]
	addedKeys: string[]
	keptKeys: string[]
	clear: {
		table: "user_wishlist" | "user_not_interested"
		seq: number
		term: number
		createdAt?: number | null
		updatedAt?: number | null
		removed?: boolean
		restored?: boolean
	}[]
}

/** Import matching needs all watches, not the movie log's 200-row display limit. */
async function readImportLog(
	userId: string,
	title: TrackedTitle,
): Promise<LogRow[]> {
	const statement = (
		title.mediaType === "show" ? SHOW_LOG_QUERY : MOVIE_LOG_QUERY
	).replace(/LIMIT \d+/, "LIMIT 50001")
	const rows = await read<Record<string, unknown>>(statement, [
		userId,
		title.tmdbId,
	])
	if (rows.length > 50_000)
		throw new Error("This title has too many watches to import safely.")
	return rows.map((row) => ({
		watch_id: String(row.watch_id),
		media_type: title.mediaType,
		tmdb_id: title.tmdbId,
		episode_tmdb_id:
			row.episode_tmdb_id == null ? null : Number(row.episode_tmdb_id),
		season_number: row.season_number == null ? null : Number(row.season_number),
		episode_number:
			row.episode_number == null ? null : Number(row.episode_number),
		watched_at: ms(row.watched_at),
		watched_at_precision:
			row.watched_at_precision as LogRow["watched_at_precision"],
		origin: row.origin as LogRow["origin"],
		group_id: (row.group_id as string | null) ?? null,
		import_id: (row.import_id as string | null) ?? null,
		pass: Number(row.pass ?? 1),
		created_at: ms(row.created_at) ?? 0,
	}))
}

function sameImportedViewing(a: LogRow, b: LogRow): boolean {
	if (
		a.pass !== b.pass ||
		a.media_type !== b.media_type ||
		a.tmdb_id !== b.tmdb_id
	)
		return false
	if (
		a.media_type === "show" &&
		!(a.episode_tmdb_id != null && a.episode_tmdb_id === b.episode_tmdb_id) &&
		(a.season_number !== b.season_number ||
			a.episode_number !== b.episode_number)
	)
		return false
	if (b.watched_at_precision === "unknown") return true
	if (a.watched_at === null || b.watched_at === null) return false
	const bucket =
		a.watched_at_precision === "day" || b.watched_at_precision === "day"
			? 86_400_000
			: 60_000
	return Math.floor(a.watched_at / bucket) === Math.floor(b.watched_at / bucket)
}

/** Did only this import change the previewed state? Every link still checks the journal's exact state and time. */
function followsImportPlans(
	preview: Version,
	current: StoredState | null,
	plans: ImportTrackingPlan[],
): boolean {
	let state = current
	for (const plan of [...plans].reverse()) {
		if (
			!isDeepStrictEqual(stateOnly(state), plan.afterState) ||
			(state && state.updated_at !== plan.now)
		)
			return false
		state = plan.beforeState
		if (sameVersion(preview, state)) return true
	}
	return false
}

export async function prepareImportTrackingPlan(input: {
	userId: string
	importId: string
	source: WatchSource
	tmdbId: number
	mediaType: MediaType
	items: ImportItem[]
	/** Earlier applied passes of this import; deferred statuses may follow only their own state transitions. */
	priorPlans?: ImportTrackingPlan[]
	watchDates: "preserve" | "unknown"
	now: number
	/**
	 * Keep a watch item whose episode has a watch in any pass, not only a duplicate of the same viewing: an episode
	 * score's watch is recorded only for an episode the member hasn't watched (#759 follow-up).
	 */
	onlyUnwatched?: boolean
	/** Undo puts back the Want to See and Not interested the plan cleared, whatever the source. */
	restoreIntentions?: boolean
}): Promise<ImportTrackingPlan> {
	const title = {
		mediaType: input.mediaType,
		tmdbId: canonicalTitleId(input.mediaType, input.tmdbId),
	}
	await run("REFRESH TABLE user_watch_log")
	const [beforeState, existing] = await Promise.all([
		readState(input.userId, title),
		readImportLog(input.userId, title),
	])
	const restoreIntentions =
		input.restoreIntentions === true ||
		input.source === "plex" ||
		(input.source === "wishlist" &&
			input.items.some((item) => item.wishlistEvidence?.source === "watcharr"))
	const plan: ImportTrackingPlan = {
		...(restoreIntentions
			? {
					restoreIntentions: true,
					priorWatchIds: existing.map((row) => row.watch_id),
				}
			: {}),
		userId: input.userId,
		importId: input.importId,
		title,
		now: input.now,
		beforeState,
		afterState: stateOnly(beforeState),
		watches: [],
		addedKeys: [],
		keptKeys: [],
		clear: [],
	}
	const candidates = existing.filter((row) => row.origin !== "score")
	const used = new Set<string>()
	// Reserve source identities first, so an older play cannot consume a newer play's exact identity.
	const exact = new Set(
		input.items.map((item) => importWatchId(input.source, item.key)),
	)
	for (const row of candidates)
		if (exact.has(row.watch_id)) used.add(row.watch_id)
	for (const item of input.items.filter((item) => item.kind === "watch")) {
		const watchId = importWatchId(input.source, item.key)
		if (
			(input.onlyUnwatched &&
				existing.some(
					(row) =>
						(item.episodeTmdbId != null &&
							row.episode_tmdb_id === item.episodeTmdbId) ||
						(row.episode_tmdb_id == null &&
							row.season_number === (item.season ?? null) &&
							row.episode_number === (item.episode ?? null)),
				)) ||
			(item.watcharrSnapshot &&
				item.episodeTmdbId != null &&
				existing.some((row) => row.episode_tmdb_id === item.episodeTmdbId)) ||
			existing.some((row) => row.watch_id === watchId) ||
			plan.watches.some((row) => row.watch_id === watchId)
		) {
			plan.keptKeys.push(item.key)
			continue
		}
		const precision =
			input.watchDates === "unknown" ? "unknown" : (item.precision ?? "unknown")
		const watchedAt =
			precision === "unknown"
				? null
				: item.watchedAt
					? Date.parse(item.watchedAt)
					: null
		if (
			precision !== "unknown" &&
			(watchedAt === null || !Number.isFinite(watchedAt))
		)
			throw new Error("A watch has an invalid date.")
		const pass =
			title.mediaType === "movie"
				? 1
				: Math.min(item.pass ?? 1, beforeState?.pass ?? item.pass ?? 1)
		const row: LogRow = {
			watch_id: watchId,
			media_type: title.mediaType,
			tmdb_id: title.tmdbId,
			episode_tmdb_id: item.episodeTmdbId ?? null,
			season_number: item.season ?? null,
			episode_number: item.episode ?? null,
			watched_at: watchedAt,
			watched_at_precision: precision,
			origin: "import",
			group_id: null,
			import_id: input.importId,
			pass,
			created_at: input.now,
		}
		const duplicate = candidates.find(
			(candidate) =>
				!used.has(candidate.watch_id) && sameImportedViewing(candidate, row),
		)
		if (duplicate) {
			used.add(duplicate.watch_id)
			plan.keptKeys.push(item.key)
			continue
		}
		plan.watches.push(row)
		plan.addedKeys.push(item.key)
		if (input.onlyUnwatched)
			plan.onlyUnwatched = {
				keysByWatch: {
					...plan.onlyUnwatched?.keysByWatch,
					[watchId]: item.key,
				},
			}
	}

	const statusItem: ImportStatusItem | undefined = input.items.find(
		(item) => item.kind === "show_status",
	)
	if (
		statusItem &&
		title.mediaType === "show" &&
		isApplicableStatus(statusItem.showStatus)
	) {
		const preview = statusItem._previewStatus
		const changed =
			preview !== undefined &&
			!sameVersion(preview, beforeState) &&
			!followsImportPlans(preview, beforeState, input.priorPlans ?? [])
		if (
			changed ||
			(beforeState &&
				((beforeState.state === statusItem.showStatus &&
					!plan.watches.length) ||
					PROTECTED_STATES.includes(beforeState.state)))
		)
			plan.keptKeys.push(statusItem.key)
		else plan.statusItem = statusItem
	}
	if (!plan.watches.length && !plan.statusItem) return plan
	if (
		plan.watches.length > 0 &&
		title.mediaType === "show" &&
		(!beforeState ||
			beforeState.state === "not_started" ||
			beforeState.state === "watching")
	) {
		const episodes = await getEpisodeList(title.tmdbId)
		const current = recordFromRows(
			stateOnly(beforeState),
			[...existing, ...plan.watches],
			{ score: null, wantToSee: false, notInterested: false },
		)
		if (!beforeState)
			current.pass = Math.max(1, ...plan.watches.map((row) => row.pass))
		const progress = facts(
			showAiredBy(listed(episodes), utcDay(input.now)),
			current,
		)
		if (progress.watchRemains) {
			current.state = progress.upToDate ? "seen" : "watching"
			current.seenQuestion = "answered"
			plan.afterState = stateRowOf(current, stateOnly(beforeState), input.now)
		}
	}

	if (plan.statusItem) {
		const record = recordFromRows(
			plan.afterState,
			[...existing, ...plan.watches],
			{ score: null, wantToSee: false, notInterested: false },
		)
		if (!beforeState)
			record.pass = Math.max(1, ...plan.watches.map((row) => row.pass))
		const status = plan.statusItem.showStatus
		if (isApplicableStatus(status)) {
			const show = showAiredBy(
				listed(await getEpisodeList(title.tmdbId)),
				utcDay(input.now),
			)
			const result = importShowStatus(
				{ show, record },
				status,
				plan.statusItem.completionScope,
				importWatchId(input.source, plan.statusItem.key),
			)
			if (result.refused) {
				plan.keptKeys.push(plan.statusItem.key)
				plan.statusItem = undefined
			} else {
				plan.afterState = stateRowOf(
					result.world.record,
					stateOnly(beforeState),
					input.now,
				)
				// Zero denotes no member move for a source-only Watching status. No watch exists to carry
				// the import provenance used by the activity readers; updated_at still owns the undo.
				if (
					plan.afterState?.state === "watching" &&
					beforeState?.state !== "watching"
				)
					plan.afterState.state_changed_at = 0
				const known = new Set(record.watches.map((w) => w.id))
				for (const watch of result.world.record.watches.filter(
					(w) => !known.has(w.id),
				)) {
					plan.watches.push({
						watch_id: importWatchId(
							input.source,
							`${plan.statusItem.key}:pass:${watch.pass}:episode:${watch.episodeId}`,
						),
						media_type: "show",
						tmdb_id: title.tmdbId,
						episode_tmdb_id: watch.episodeId,
						season_number: watch.season,
						episode_number: watch.number,
						watched_at: null,
						watched_at_precision: "unknown",
						origin: "import",
						group_id: null,
						import_id: input.importId,
						pass: watch.pass,
						created_at: input.now,
					})
				}
			}
		}
	}
	// Only clear the intentions observed while preparing this plan. A later edit gets a new version.
	if (
		title.mediaType === "movie" ||
		plan.statusItem !== undefined ||
		plan.watches.some((row) => (row.season_number ?? 0) > 0)
	) {
		for (const table of ["user_wishlist", "user_not_interested"] as const) {
			try {
				const [row] = await read<{
					_seq_no: number
					_primary_term: number
					created_at: number | null
					updated_at: number | null
				}>(
					`SELECT created_at, updated_at, _seq_no, _primary_term FROM ${table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
					[input.userId, title.tmdbId, title.mediaType],
				)
				if (row)
					plan.clear.push({
						table,
						seq: Number(row._seq_no),
						term: Number(row._primary_term),
						createdAt: ms(row.created_at),
						updatedAt: ms(row.updated_at),
					})
			} catch (error) {
				if (
					table !== "user_not_interested" ||
					!isMissingNotInterestedTable(error)
				)
					throw error
			}
		}
	}
	return plan
}

/** A row this plan wrote: one of its watch ids, under its import. */
const ownRow = (plan: ImportTrackingPlan, row: LogRow) =>
	row.import_id === plan.importId &&
	plan.watches.some((watch) => watch.watch_id === row.watch_id)

/** Another row than this plan's own watches the same episode. */
const watchedElsewhere = (
	plan: ImportTrackingPlan,
	log: readonly LogRow[],
	watch: LogRow,
) =>
	log.some(
		(row) =>
			!ownRow(plan, row) &&
			((watch.episode_tmdb_id != null &&
				row.episode_tmdb_id === watch.episode_tmdb_id) ||
				(row.episode_tmdb_id == null &&
					row.season_number === watch.season_number &&
					row.episode_number === watch.episode_number)),
	)

/** Moves these planned watches to kept, and journals the plan. */
async function keepInstead(
	plan: ImportTrackingPlan,
	watches: readonly LogRow[],
	checkpoint?: (plan: ImportTrackingPlan) => Promise<void>,
) {
	if (!watches.length || !plan.onlyUnwatched) return
	const keys = plan.onlyUnwatched.keysByWatch
	const ids = new Set(watches.map((row) => row.watch_id))
	const kept = watches.map((row) => keys[row.watch_id])
	plan.watches = plan.watches.filter((row) => !ids.has(row.watch_id))
	plan.addedKeys = plan.addedKeys.filter((key) => !kept.includes(key))
	plan.keptKeys = [...plan.keptKeys, ...kept]
	await checkpoint?.(plan)
}

export async function applyImportTrackingPlan(
	userId: string,
	plan: ImportTrackingPlan,
	checkpoint?: (plan: ImportTrackingPlan) => Promise<void>,
) {
	if (userId !== plan.userId)
		throw new Error("This import belongs to another member.")
	if (plan.onlyUnwatched && plan.watches.length) {
		// Watched since the plan was made, by the member or another writer: that watch is kept, not added twice. A
		// watch this plan inserted before a stop stays its own here; the check after the insert settles it.
		await run("REFRESH TABLE user_watch_log")
		const log = await readImportLog(userId, plan.title)
		const late = plan.watches.filter(
			(watch) =>
				!log.some(
					(row) => ownRow(plan, row) && row.watch_id === watch.watch_id,
				) && watchedElsewhere(plan, log, watch),
		)
		await keepInstead(plan, late, checkpoint)
	}
	if (!plan.watches.length && !plan.statusItem)
		return {
			added: 0,
			kept: plan.keptKeys.length,
			watchIds: [],
			statusKeys: [],
		}
	await insertLog(userId, plan.watches, plan.now)
	await run("REFRESH TABLE user_watch_log")
	let log = await readImportLog(userId, plan.title)
	if (plan.onlyUnwatched) {
		// Another watch of the episode landed between the check and the insert, or before a resume: this plan's own
		// row is the extra one. The journal first says so while it still holds the watch, then the row is deleted, then
		// the plan leaves it out: a stop at any point leaves a journal whose Undo takes back the status and the lists.
		const overtaken = plan.watches.filter(
			(watch) =>
				log.some(
					(row) => ownRow(plan, row) && row.watch_id === watch.watch_id,
				) && watchedElsewhere(plan, log, watch),
		)
		if (overtaken.length) {
			plan.pruned = [
				...(plan.pruned ?? []),
				...overtaken.map((row) => row.watch_id),
			]
			await checkpoint?.(plan)
			await deleteLog(
				userId,
				overtaken.map((row) => row.watch_id),
			)
			await keepInstead(plan, overtaken, checkpoint)
			const gone = new Set(overtaken.map((row) => row.watch_id))
			log = log.filter((row) => !(ownRow(plan, row) && gone.has(row.watch_id)))
		}
	}
	const plannedIds = new Set(plan.watches.map((watch) => watch.watch_id))
	const ours = log.filter(
		(row) => row.import_id === plan.importId && plannedIds.has(row.watch_id),
	)
	// A simultaneous upload can have won every insert. It owns the state transition as well as the watches.
	if (!ours.length && !plan.statusItem)
		return {
			added: 0,
			kept: plan.keptKeys.length + plan.watches.length,
			watchIds: [],
			statusKeys: [],
		}
	let statusApplied = false
	if (plan.title.mediaType === "movie")
		await settleMovie(userId, plan.title.tmdbId)
	else {
		for (let attempt = 0; attempt < STATE_RETRIES; attempt++) {
			const current = await readState(userId, plan.title)
			// A successful earlier attempt, or a status chosen here, must not be replayed as a fresh action.
			if (
				current?.updated_at === plan.now &&
				current.state === plan.afterState?.state
			) {
				statusApplied = !!plan.statusItem
				break
			}
			if (plan.statusItem) {
				// Any edit since planning wins, including another move to Watching.
				if (!sameVersion(current, plan.beforeState)) break
				if (
					await writeState(
						userId,
						plan.title,
						current ? "update" : "insert",
						plan.afterState,
						current,
						plan.now,
					)
				) {
					statusApplied = true
					break
				}
				if (attempt === STATE_RETRIES - 1) throw new TrackingConflictError()
				continue
			}
			if (current && PROTECTED_STATES.includes(current.state)) break
			await run("REFRESH TABLE user_watch_log")
			const combined = await readImportLog(userId, plan.title)
			const record = recordFromRows(stateOnly(current), combined, {
				score: null,
				wantToSee: false,
				notInterested: false,
			})
			if (!current)
				record.pass = Math.max(1, ...combined.map((row) => row.pass))
			const progress = facts(
				showAiredBy(
					listed(await getEpisodeList(plan.title.tmdbId)),
					utcDay(Date.now()),
				),
				record,
			)
			if (!progress.watchRemains) break
			record.state = progress.upToDate ? "seen" : "watching"
			record.seenQuestion = "answered"
			if (!sameVersion(current, plan.beforeState)) {
				plan.beforeState = current
				plan.now = Math.max(
					Date.now(),
					plan.now + 1,
					(current?.updated_at ?? 0) + 1,
				)
			}
			plan.afterState = stateRowOf(record, stateOnly(current), plan.now)
			// The importer persists this changed prior state before a CAS retry can touch the state row.
			await checkpoint?.(plan)
			if (
				await writeState(
					userId,
					plan.title,
					current ? "update" : "insert",
					plan.afterState,
					current,
					plan.now,
				)
			)
				break
			if (attempt === STATE_RETRIES - 1) throw new TrackingConflictError()
		}
	}
	for (const clear of statusApplied || ours.length ? plan.clear : []) {
		const deleted = await run(
			`DELETE FROM ${clear.table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?`,
			[userId, plan.title.tmdbId, plan.title.mediaType, clear.seq, clear.term],
		)
		if (plan.restoreIntentions && deleted.rowcount) {
			clear.removed = true
			await checkpoint?.(plan)
		}
	}
	await finish(userId)
	if (plan.clear.some((row) => row.table === "user_wishlist"))
		await markTasteChanged(userId)
	return {
		added: ours.length,
		kept: plan.keptKeys.length + plan.watches.length - ours.length,
		watchIds: ours.map((row) => row.watch_id),
		statusKeys: statusApplied && plan.statusItem ? [plan.statusItem.key] : [],
	}
}

/**
 * Takes back one title's import plan and says what it did with the show status: "reverted" when it is as it was
 * before the import (or the plan didn't change it), "left" when the member changed it after the import.
 */
export async function undoImportTrackingPlan(
	userId: string,
	plan: ImportTrackingPlan,
	/** An earlier, interrupted Undo of this plan began: a status as before the import is its own work. */
	resumed = false,
): Promise<UndoOutcome> {
	if (userId !== plan.userId)
		throw new Error("This import belongs to another member.")
	if (!plan.watches.length && !plan.statusItem && !plan.pruned?.length)
		return "reverted"
	let outcome: UndoOutcome = "reverted"
	await run("REFRESH TABLE user_watch_log")
	const ownIds = new Set(plan.watches.map((row) => row.watch_id))
	const log = await readImportLog(userId, plan.title)
	// Edited imported watch dates remain part of the import, as the undo confirmation explains.
	await deleteLog(
		userId,
		log
			.filter(
				(row) => row.import_id === plan.importId && ownIds.has(row.watch_id),
			)
			.map((row) => row.watch_id),
	)
	if (plan.title.mediaType === "movie")
		await settleMovie(userId, plan.title.tmdbId)
	else {
		const current = await readState(userId, plan.title)
		const owned =
			current &&
			current.updated_at === plan.now &&
			current.state === plan.afterState?.state
		const before = plan.beforeState?.state ?? null
		// Changed since the import, unless an earlier, interrupted Undo already put it back.
		if (
			!owned &&
			(plan.afterState?.state ?? null) !== before &&
			// A show with no status reads as Not started, as its empty receipt row does.
			!(
				resumed &&
				(current?.state ?? "not_started") === (before ?? "not_started")
			)
		)
			outcome = "left"
		if (owned) {
			await run("REFRESH TABLE user_watch_log")
			const remaining = await readImportLog(userId, plan.title)
			const hasRegular = remaining.some((row) => (row.season_number ?? 0) > 0)
			let restored = stateOnly(plan.beforeState)
			// Another import may already have been undone, or may have added watches while this show was Seen.
			// Restore the earlier choice only where it still satisfies the watch/state invariant.
			if (
				!plan.statusItem &&
				!(restored?.state === "watching" && restored.state_changed_at === 0) &&
				!hasRegular &&
				restored &&
				["watching", "seen"].includes(restored.state)
			) {
				restored = {
					...restored,
					state: "not_started",
					state_changed_at: Date.now(),
					seen_press_group: null,
					seen_press_from: null,
				}
			} else if (hasRegular && !restored) {
				const record = recordFromRows(null, remaining, {
					score: null,
					wantToSee: false,
					notInterested: false,
				})
				record.pass = Math.max(1, ...remaining.map((row) => row.pass))
				record.state = facts(
					showAiredBy(
						listed(await getEpisodeList(plan.title.tmdbId)),
						utcDay(Date.now()),
					),
					record,
				).upToDate
					? "seen"
					: "watching"
				// The show is where the watches that remain put it, since the last of them was recorded. The time of
				// this undo would read as the member's own move to Watching (C3).
				restored = stateRowOf(
					record,
					null,
					Math.max(...remaining.map((row) => row.created_at)),
				)
			}
			// Restore before releasing state ownership, so an interrupted undo can retry the inserts.
			// DO NOTHING preserves any intention the member has since added.
			if (plan.statusItem && !plan.watches.length && !plan.restoreIntentions)
				for (const clear of plan.clear) {
					if (clear.updatedAt == null) continue // Older journals did not retain intentions.
					await run(
						`INSERT INTO ${clear.table} (user_id, tmdb_id, media_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, tmdb_id, media_type) DO NOTHING`,
						[
							userId,
							plan.title.tmdbId,
							plan.title.mediaType,
							clear.createdAt == null ? null : new Date(clear.createdAt),
							new Date(clear.updatedAt),
						],
					)
				}
			await writeState(
				userId,
				plan.title,
				restored ? "update" : "delete",
				restored,
				current,
				// Preserve the earlier writer's ownership when restoring its exact state. Otherwise an older
				// import could no longer be undone after this one.
				plan.beforeState &&
					JSON.stringify(restored) ===
						JSON.stringify(stateOnly(plan.beforeState))
					? plan.beforeState.updated_at
					: Date.now(),
			)
		}
	}
	await finish(userId)
	return outcome
}

/** Runs after score Undo has settled its implicit movie watch. Never overwrites a newer intention. */
export async function restoreImportTrackingIntentions(
	userId: string,
	plan: ImportTrackingPlan,
	checkpoint: (plan: ImportTrackingPlan) => Promise<void>,
) {
	if (userId !== plan.userId)
		throw new Error("This import belongs to another member.")
	if (!plan.restoreIntentions) return
	await run("REFRESH TABLE user_watch_log")
	const remaining = await readImportLog(userId, plan.title)
	const priorIds = new Set(plan.priorWatchIds ?? [])
	if (remaining.some((row) => !priorIds.has(row.watch_id))) return
	if (plan.title.mediaType === "show") {
		const current = await readState(userId, plan.title)
		if (
			(current?.state ?? "not_started") !==
				(plan.beforeState?.state ?? "not_started") ||
			(current?.pass ?? 1) !== (plan.beforeState?.pass ?? 1)
		)
			return
	}
	for (const clear of plan.clear) {
		if (!clear.removed || clear.updatedAt == null) continue
		if (clear.table === "user_not_interested" && remaining.length) continue
		const opposite =
			clear.table === "user_wishlist" ? "user_not_interested" : "user_wishlist"
		const params = [userId, plan.title.tmdbId, plan.title.mediaType]
		try {
			if (
				(
					await read(
						`SELECT created_at, updated_at, _seq_no, _primary_term FROM ${opposite} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
						params,
					)
				).length
			)
				continue
		} catch (error) {
			if (
				opposite !== "user_not_interested" ||
				!isMissingNotInterestedTable(error)
			)
				throw error
		}
		await run(
			`INSERT INTO ${clear.table} (user_id, tmdb_id, media_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, tmdb_id, media_type) DO NOTHING`,
			[
				...params,
				clear.createdAt == null ? null : new Date(clear.createdAt),
				new Date(clear.updatedAt),
			],
		)
		const [current] = await read<{
			created_at: number | null
			updated_at: number | null
		}>(
			`SELECT created_at, updated_at, _seq_no, _primary_term FROM ${clear.table} WHERE user_id = ? AND tmdb_id = ? AND media_type = ?`,
			params,
		)
		clear.restored =
			!!current &&
			ms(current.created_at) === (clear.createdAt ?? null) &&
			ms(current.updated_at) === clear.updatedAt
		await checkpoint(plan)
		if (clear.restored && clear.table === "user_wishlist")
			await markTasteChanged(userId)
	}
	await finish(userId)
}

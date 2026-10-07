// What is stored for tracking, and how it maps to the state machine (docs/implementation/tracking/data-model.md).
//
// Stored are the `user_watch_log` rows of a title and one `user_watch_state` row; nothing else. This file turns
// those rows into the machine's record, an event into the row changes it means, a movie's rows into what the movie
// rule asks for, and the grouped query's rows into what the lists read. Pure: no clock, no database. The server's
// writer (server/tracking.server.ts) issues the statements; the browser can run the same functions on the rows it
// holds for a show.
//
// Timestamps are epoch milliseconds, as Crate returns them.
import {
	type Origin,
	type Show,
	type State,
	type TrackingEvent,
	type TrackingRecord,
	type WatchedWhen,
	step,
} from "./machine.ts"

// ---------------------------------------------------------------------------------------------------------
// The two tables
// ---------------------------------------------------------------------------------------------------------

export type MediaType = "movie" | "show"
export type Precision = "moment" | "day" | "unknown"
/** The key of a title in the member data map: "movie-603", "show-1399". */
export type TitleKey = `${MediaType}-${number}`

/** One row of `user_watch_log`, without the member. */
export interface LogRow {
	watch_id: string
	media_type: MediaType
	tmdb_id: number
	episode_tmdb_id: number | null
	season_number: number | null
	episode_number: number | null
	watched_at: number | null
	watched_at_precision: Precision
	origin: Origin
	group_id: string | null
	import_id: string | null
	pass: number
	created_at: number
}

/** One row of `user_watch_state`, without its key. */
export interface StateRow {
	state: State
	state_changed_at: number
	pass: number
	seen_press_group: string | null
	seen_press_from: State | null
	rate_prompt_dismissed_at: number | null
	seen_question: "open" | "answered" | null
}

/** What the other tables say about the title: `user_score`, `user_wishlist`, `user_not_interested`. */
export interface Flags {
	score: number | null
	wantToSee: boolean
	notInterested: boolean
}

// ---------------------------------------------------------------------------------------------------------
// Rows -> the machine's record, and back
// ---------------------------------------------------------------------------------------------------------

export function recordFromRows(
	state: StateRow | null,
	log: readonly LogRow[],
	flags: Flags,
): TrackingRecord {
	return {
		state: state?.state ?? "not_started",
		pass: state?.pass ?? 1,
		watches: log.map((r) => ({
			id: r.watch_id,
			episodeId: r.episode_tmdb_id,
			season: r.season_number ?? 0,
			number: r.episode_number ?? 0,
			origin: r.origin,
			group: r.group_id,
			pass: r.pass,
		})),
		score: flags.score,
		wantToSee: flags.wantToSee,
		notInterested: flags.notInterested,
		seenPress:
			state?.seen_press_group && state.seen_press_from
				? { group: state.seen_press_group, from: state.seen_press_from }
				: null,
		ratePromptDismissed: state?.rate_prompt_dismissed_at != null,
		seenQuestion: state?.seen_question ?? "not_asked",
	}
}

/**
 * The state row of a record. No row when there is nothing to remember: Not started, pass 1, no prompt.
 * `state_changed_at` moves only when the state does.
 */
export function stateRowOf(
	record: TrackingRecord,
	before: StateRow | null,
	now: number,
): StateRow | null {
	const nothing =
		record.state === "not_started" &&
		record.pass === 1 &&
		!record.ratePromptDismissed &&
		record.seenQuestion === "not_asked"
	if (nothing) return null
	return {
		state: record.state,
		state_changed_at:
			before && before.state === record.state ? before.state_changed_at : now,
		pass: record.pass,
		seen_press_group: record.seenPress?.group ?? null,
		seen_press_from: record.seenPress?.from ?? null,
		rate_prompt_dismissed_at: record.ratePromptDismissed
			? (before?.rate_prompt_dismissed_at ?? now)
			: null,
		seen_question:
			record.seenQuestion === "not_asked" ? null : record.seenQuestion,
	}
}

/** The date columns of a watch made at `now`. A day is stored as 00:00:00 UTC of that day. */
export function watchedAt(
	when: WatchedWhen | undefined,
	now: number,
): { watched_at: number | null; watched_at_precision: Precision } {
	if (!when || when.precision === "moment")
		return { watched_at: now, watched_at_precision: "moment" }
	if (when.precision === "day")
		return {
			watched_at: Date.parse(`${when.day}T00:00:00Z`),
			watched_at_precision: "day",
		}
	return { watched_at: null, watched_at_precision: "unknown" }
}

// ---------------------------------------------------------------------------------------------------------
// One event of a show, as row changes
// ---------------------------------------------------------------------------------------------------------

export interface RowChanges {
	/** Log rows to insert. Their ids are fixed, so inserting them again changes nothing. */
	insert: LogRow[]
	/** The `watch_id`s of the log rows to delete. */
	deleteIds: string[]
	/** The state row after the event; null for no row. */
	state: StateRow | null
	/**
	 * What to do with the state row. "update" also when its content is the same: the write is what two actions on
	 * one show are checked against. "none" only when there was no row and there is none.
	 */
	stateWrite: "insert" | "update" | "delete" | "none"
	/** Which of the two lists of intentions the event takes the title off. */
	clear: { wantToSee: boolean; notInterested: boolean }
}

export interface AppliedEvent {
	/** Why nothing happened; then there is nothing to write. */
	refused: string | null
	/** The id of the last row of the transition table that was used. */
	row: string | null
	record: TrackingRecord
	changes: RowChanges
}

export interface ShowEventInput {
	showId: number
	/** The episode list with what counts as aired for this event (see `serverShow` and `showAiredBy`). */
	show: Show
	state: StateRow | null
	log: readonly LogRow[]
	flags: Flags
	event: TrackingEvent
	/** The id the browser made for the action: the watch id, or the group id of a group action. */
	actionId?: string
	now: number
	/** See `StepOptions.resend`. The server always sets it. */
	resend?: boolean
}

/** Runs the machine on the stored rows of one show and says which rows change. */
export function applyShowEvent(input: ShowEventInput): AppliedEvent {
	const { showId, show, state, log, flags, event, now } = input
	const before = recordFromRows(state, log, flags)
	const done = step({ show, record: before }, event, input.actionId ?? "", {
		resend: input.resend,
	})
	const after = done.world.record
	if (done.refused)
		return {
			refused: done.refused,
			row: null,
			record: before,
			changes: {
				insert: [],
				deleteIds: [],
				state,
				stateWrite: "none",
				clear: { wantToSee: false, notInterested: false },
			},
		}
	const stored = new Set(log.map((r) => r.watch_id))
	const kept = new Set(after.watches.map((w) => w.id))
	const when = event.type === "watch" ? event.when : undefined
	const insert: LogRow[] = after.watches
		.filter((w) => !stored.has(w.id))
		.map((w) => ({
			watch_id: w.id,
			media_type: "show",
			tmdb_id: showId,
			episode_tmdb_id: w.episodeId,
			season_number: w.season,
			episode_number: w.number,
			// A group action has no date: the member said what, not when.
			...(w.origin === "single"
				? watchedAt(when, now)
				: { watched_at: null, watched_at_precision: "unknown" as const }),
			origin: w.origin,
			group_id: w.group,
			import_id: null,
			pass: w.pass,
			created_at: now,
		}))
	const next = stateRowOf(after, state, now)
	return {
		refused: null,
		row: done.row?.id ?? null,
		record: after,
		changes: {
			insert,
			deleteIds: log.map((r) => r.watch_id).filter((id) => !kept.has(id)),
			state: next,
			stateWrite: next
				? state
					? "update"
					: "insert"
				: state
					? "delete"
					: "none",
			clear: {
				wantToSee: flags.wantToSee && !after.wantToSee,
				notInterested: flags.notInterested && !after.notInterested,
			},
		},
	}
}

// ---------------------------------------------------------------------------------------------------------
// Movies: no machine, one rule
// ---------------------------------------------------------------------------------------------------------

/** The id of the watch that a movie's score owns. A member has at most one per movie. */
export const scoreWatchId = (movieId: number) => `score-${movieId}`

export function movieLogRow(
	movieId: number,
	watchId: string,
	origin: Origin,
	when: WatchedWhen | undefined,
	now: number,
): LogRow {
	return {
		watch_id: watchId,
		media_type: "movie",
		tmdb_id: movieId,
		episode_tmdb_id: null,
		season_number: null,
		episode_number: null,
		...watchedAt(when, now),
		origin,
		group_id: null,
		import_id: null,
		pass: 1,
		created_at: now,
	}
}

export const movieStateRow = (now: number): StateRow => ({
	state: "seen",
	state_changed_at: now,
	pass: 1,
	seen_press_group: null,
	seen_press_from: null,
	rate_prompt_dismissed_at: null,
	seen_question: null,
})

export interface MovieSettlement {
	/** The score's watch, when it has to be written. */
	insert: LogRow[]
	deleteIds: string[]
	stateWrite: "insert" | "delete" | "none"
	/** The movie has a log row afterwards, so it is Seen. */
	seen: boolean
	/** The score's watch stands afterwards: the movie is Seen through its score alone. */
	byScoreAlone: boolean
}

/**
 * The movie rule: the score's watch exists exactly while the movie has a score and no log row of another origin,
 * and the state row exists exactly while a log row does. Returns what has to change for that to hold.
 */
export function settleMovieRows(input: {
	movieId: number
	log: readonly LogRow[]
	hasScore: boolean
	hasState: boolean
	now: number
}): MovieSettlement {
	const { movieId, log, hasScore, hasState, now } = input
	const own = log.filter((r) => r.origin !== "score")
	const byScore = log.filter((r) => r.origin === "score")
	const wanted = hasScore && own.length === 0
	const insert =
		wanted && byScore.length === 0
			? [
					movieLogRow(
						movieId,
						scoreWatchId(movieId),
						"score",
						{ precision: "unknown" },
						now,
					),
				]
			: []
	const deleteIds = wanted ? [] : byScore.map((r) => r.watch_id)
	const seen = own.length > 0 || wanted
	return {
		insert,
		deleteIds,
		stateWrite:
			seen && !hasState ? "insert" : !seen && hasState ? "delete" : "none",
		seen,
		byScoreAlone: wanted,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The grouped query's rows -> what the lists and the member data map read
// ---------------------------------------------------------------------------------------------------------

/** One row of the grouped query: everything the log says about one title in one pass. */
export interface GroupRow {
	tmdb_id: number
	media_type: MediaType
	pass: number
	watch_count: number
	episodes_watched: number
	/** season * 100000 + episode of the furthest regular episode; null without one. */
	furthest: number | null
	first_watched_at: number | null
	last_watched_at: number | null
	last_moment_at: number | null
	last_activity_at: number | null
}

/** The key and the two columns of a state row that pick the current pass. */
export interface TitleState {
	tmdb_id: number
	media_type: MediaType
	state: State
	pass: number
}

/** What the log and the state say about one title. */
export interface TitleTotals {
	state: State
	/** The current pass: the state row's, or 1 for a title without one. */
	pass: number
	/** Log rows of the title, over all passes. A movie's watch count. */
	count: number
	/** Different regular episodes watched in the current pass. */
	episodesWatched: number
	/** The furthest of them, as [season, episode]. */
	furthest: [number, number] | null
	/** A regular episode is watched in some pass: the guard "a watch remains". */
	startedEver: boolean
	firstWatchedAt: number | null
	/** The latest dated watch, and how exact it is. */
	watchedAt: number | null
	precision: Precision
	/** The latest dated watch or, for undated watches not from an import, the time they were recorded. */
	lastActivityAt: number | null
}

const largest = (values: (number | null)[]) =>
	values.reduce<number | null>(
		(m, v) => (v === null ? m : m === null || v > m ? v : m),
		null,
	)
const smallest = (values: (number | null)[]) =>
	values.reduce<number | null>(
		(m, v) => (v === null ? m : m === null || v < m ? v : m),
		null,
	)

export const titleKeyOf = (title: {
	media_type: MediaType
	tmdb_id: number
}): TitleKey => `${title.media_type}-${title.tmdb_id}`

/**
 * Per title, from the member's state rows and the grouped query's rows. A title is in the result when it has a
 * state row or a log row. Progress counts the group of the current pass; counts and dates span all passes.
 */
export function titleTotals(
	states: readonly TitleState[],
	groups: readonly GroupRow[],
): Map<TitleKey, TitleTotals> {
	const stateOf = new Map<TitleKey, TitleState>()
	for (const row of states) stateOf.set(titleKeyOf(row), row)
	const groupsOf = new Map<TitleKey, GroupRow[]>()
	for (const row of groups) {
		const key = titleKeyOf(row)
		const list = groupsOf.get(key)
		if (list) list.push(row)
		else groupsOf.set(key, [row])
	}
	const totals = new Map<TitleKey, TitleTotals>()
	for (const key of new Set([...stateOf.keys(), ...groupsOf.keys()])) {
		const row = stateOf.get(key)
		const all = groupsOf.get(key) ?? []
		const pass = row?.pass ?? 1
		const current = all.find((g) => g.pass === pass)
		const furthest = current?.furthest ?? null
		const watchedAt = largest(all.map((g) => g.last_watched_at))
		const lastMoment = largest(all.map((g) => g.last_moment_at))
		totals.set(key, {
			state: row?.state ?? "not_started",
			pass,
			count: all.reduce((n, g) => n + Number(g.watch_count), 0),
			episodesWatched: Number(current?.episodes_watched ?? 0),
			furthest:
				furthest === null
					? null
					: [Math.floor(furthest / 100000), furthest % 100000],
			startedEver: all.some((g) => Number(g.episodes_watched) > 0),
			firstWatchedAt: smallest(all.map((g) => g.first_watched_at)),
			watchedAt,
			precision:
				watchedAt === null
					? "unknown"
					: watchedAt === lastMoment
						? "moment"
						: "day",
			lastActivityAt: largest(all.map((g) => g.last_activity_at)),
		})
	}
	return totals
}

/** A title's entry in the member data map. */
export interface WatchStateEntry {
	state: Exclude<State, "not_started">
	/** The latest dated watch, and how exact it is. */
	watchedAt: Date | null
	precision: Precision
	/** Log rows of the title. */
	count: number
	// Shows only:
	pass: number
	/** Different regular episodes watched in the current pass. */
	episodesWatched: number
	/** The furthest of them, as [season, episode]. */
	furthest: [number, number] | null
	lastActivityAt: Date | null
}

/**
 * The `watchState` entry of the member data map: one entry per title with a state other than Not started. The
 * groups of a title without such a state (a show of which only a special was watched) are dropped.
 */
export function watchStateOf(
	states: readonly TitleState[],
	groups: readonly GroupRow[],
): Record<TitleKey, WatchStateEntry> {
	const entries: Record<TitleKey, WatchStateEntry> = {}
	for (const [key, totals] of titleTotals(states, groups)) {
		if (totals.state === "not_started") continue
		entries[key] = {
			state: totals.state,
			watchedAt: totals.watchedAt === null ? null : new Date(totals.watchedAt),
			precision: totals.precision,
			count: totals.count,
			pass: totals.pass,
			episodesWatched: totals.episodesWatched,
			furthest: totals.furthest,
			lastActivityAt:
				totals.lastActivityAt === null ? null : new Date(totals.lastActivityAt),
		}
	}
	return entries
}

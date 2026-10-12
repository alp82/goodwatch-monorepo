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
	type PressWatch,
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
 * `state_changed_at` moves only when the state does. `applyShowEvent` dates a move to Watching that only takes
 * watches away by the last remaining watch.
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

/**
 * The event that puts the standing Seen press back once it is taken back (row 30): the press of the state row and
 * its rows of the log, read before `undoSeen` removes them. Null when no press stands, and for a press with a row
 * that no Seen press makes (another origin or pass), which the event could not write again as it was.
 */
export function seenPressRestore(
	state: StateRow | null,
	log: readonly LogRow[],
): Extract<TrackingEvent, { type: "restoreSeen" }> | null {
	if (
		state?.state !== "seen" ||
		!state.seen_press_group ||
		!state.seen_press_from
	)
		return null
	const group = state.seen_press_group
	const own = log.filter((row) => row.group_id === group)
	if (own.some((row) => row.origin !== "seen" || row.pass !== state.pass))
		return null
	return {
		type: "restoreSeen",
		group,
		from: state.seen_press_from,
		pass: state.pass,
		changedAt: state.state_changed_at,
		watches: own.map((row) => ({
			id: row.watch_id,
			episodeId: row.episode_tmdb_id,
			season: row.season_number ?? 0,
			number: row.episode_number ?? 0,
			watchedAt: row.watched_at,
			precision: row.watched_at_precision,
			createdAt: row.created_at,
		})),
	}
}

/**
 * The event that puts back what Unmark season removed (rows 32 to 34): the state row as it was before, and the
 * rows the unmark removed from the log. Null when there is nothing to put back, and for a row that Unmark season
 * does not remove (a special, another pass), which the event could not write again as it was.
 */
export function seasonRestore(
	state: StateRow | null,
	removed: readonly LogRow[],
): Extract<TrackingEvent, { type: "restoreSeason" }> | null {
	if (!state || state.state === "not_started" || !removed.length) return null
	if (
		removed.some(
			(row) => row.pass !== state.pass || (row.season_number ?? 0) < 1,
		)
	)
		return null
	return {
		type: "restoreSeason",
		from: state.state,
		press:
			state.state === "seen" && state.seen_press_group && state.seen_press_from
				? { group: state.seen_press_group, from: state.seen_press_from }
				: null,
		pass: state.pass,
		changedAt: state.state_changed_at,
		watches: removed.map((row) => ({
			id: row.watch_id,
			episodeId: row.episode_tmdb_id,
			season: row.season_number ?? 0,
			number: row.episode_number ?? 0,
			watchedAt: row.watched_at,
			precision: row.watched_at_precision,
			createdAt: row.created_at,
			origin: row.origin,
			group: row.group_id,
			importId: row.import_id,
		})),
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
	// A press or a season that is put back: its rows as they were, with their dates and the time they were made.
	const back =
		event.type === "restoreSeen" || event.type === "restoreSeason"
			? new Map<string, PressWatch & { importId?: string | null }>(
					event.watches.map((w) => [w.id, w]),
				)
			: null
	const insert: LogRow[] = after.watches
		.filter((w) => !stored.has(w.id))
		.map((w) => {
			const was = back?.get(w.id)
			return {
				watch_id: w.id,
				media_type: "show",
				tmdb_id: showId,
				episode_tmdb_id: w.episodeId,
				season_number: w.season,
				episode_number: w.number,
				...(was
					? { watched_at: was.watchedAt, watched_at_precision: was.precision }
					: w.origin === "single"
						? watchedAt(when, now)
						: // A group action has no date: the member said what, not when.
							{ watched_at: null, watched_at_precision: "unknown" as const }),
				origin: w.origin,
				group_id: w.group,
				import_id: was?.importId ?? null,
				pass: w.pass,
				created_at: was?.createdAt ?? now,
			}
		})
	const row = stateRowOf(after, state, now)
	// The show is Seen since the time it was before the press was taken back, not since this Undo. And a show whose
	// season is put back has its state since the time it had it before.
	const restored =
		row &&
		(event.type === "restoreSeen" || event.type === "restoreSeason") &&
		state?.state !== row.state
			? { ...row, state_changed_at: event.changedAt }
			: row
	// C3: taking watches or a Seen press away is no move to Watching of the member's own. The show is Watching since
	// its last remaining watch, so it goes by that watch. Resume and Watch again are such a move; an event that adds
	// a watch is activity through the watch.
	const remaining = log.filter((r) => kept.has(r.watch_id))
	const next =
		restored &&
		restored === row &&
		row?.state === "watching" &&
		state?.state !== "watching" &&
		event.type !== "resume" &&
		event.type !== "watchAgain" &&
		!insert.length &&
		remaining.length
			? {
					...restored,
					state_changed_at: Math.max(
						...remaining.map((r) => r.watched_at ?? r.created_at),
					),
				}
			: restored
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
	/** When the latest imported watch of the group was recorded; null without one. */
	last_import_at: number | null
}

/** The key of a state row, the two columns that pick the current pass, and when the state last changed. */
export interface TitleState {
	tmdb_id: number
	media_type: MediaType
	state: State
	pass: number
	state_changed_at: number
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
	/**
	 * Since when the member has had the show in Watching by their own action; null in any other state, and when an
	 * import made it Watching (C3).
	 */
	watchingSince: number | null
}

// The driver hands a timestamp over as a Date, and a NULL one as the Date of 0; the tests as milliseconds.
const moment = (value: number | Date | null | undefined) =>
	value === null || value === undefined ? null : new Date(value).getTime()

/**
 * C3: a member's own move to Watching counts as activity, an import's does not. The state row does not say who
 * wrote it, so an import is told by its watches: it records them no later than it changes the state.
 */
function watchingSinceOf(
	state: TitleState | undefined,
	groups: readonly GroupRow[],
): number | null {
	if (state?.state !== "watching") return null
	const changed = moment(state.state_changed_at)
	if (changed === null) return null
	const imported = largest(groups.map((g) => moment(g.last_import_at)))
	return imported !== null && changed <= imported ? null : changed
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
			watchingSince: watchingSinceOf(row, all),
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
	/**
	 * Since when the member has had the show in Watching by their own action. Null in any other state, when an
	 * import made it Watching, and for a movie. Not there on an entry cached by the build before.
	 */
	watchingSince?: Date | null
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
			watchingSince:
				totals.watchingSince === null ? null : new Date(totals.watchingSince),
		}
	}
	return entries
}

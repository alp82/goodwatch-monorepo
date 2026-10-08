// What the show page holds for episode tracking, and how the browser works on it
// (docs/implementation/tracking/data-model.md, "The browser").
//
// The browser holds the member's state row and log rows of one show and the show's episode list. It runs the same
// state machine as the server on them, with "aired" by the date on the device, shows the result, and sends the
// action with the ids it made. The server's answer then replaces the guess. Pure: no clock, no request.
import type { EpisodeRating } from "./episode-ratings.ts"
import {
	type Derived,
	type ListedEpisode,
	type TrackingEvent,
	type WatchedWhen,
	airedRegular,
	countedEpisode,
	derive,
	isDay,
	offer,
	seenButton,
	showAiredBy,
	watchedIds,
} from "./machine.ts"
import {
	type DateWords,
	PLAIN_DATES,
	type SeenPress,
	seenPressOf,
} from "./seen-press.ts"
import { type MenuEntry, statusMenu } from "./status-menu.ts"
import {
	type LogRow,
	type StateRow,
	type WatchStateEntry,
	applyShowEvent,
	recordFromRows,
	watchedAt,
} from "./storage.ts"

// ---------------------------------------------------------------------------------------------------------
// What the server sends
// ---------------------------------------------------------------------------------------------------------

/** One episode of the episode list, in TMDB's numbering. Season 0 holds the specials. */
export interface PageEpisode extends ListedEpisode {
	name: string | null
	runtime: number | null
	/** TMDB's path of the still. */
	still: string | null
	/** TMDB's description; null where the episode catalog has none. Shown only in an opened row. */
	overview: string | null
	/** IMDb's rating, where IMDb and TMDB mean the same episode (see episode-ratings.ts). */
	rating: number | null
	ratedBy: EpisodeRating["how"] | null
}

/** A show's tracking for one member: what the show page reads. */
export interface ShowTrackingPage {
	/** The member's state row; null when there is none. */
	state: StateRow | null
	/** Every watch of the member for the show, in every pass. */
	log: LogRow[]
	/** Empty for a show the episode catalog has no list for (yet): the page then offers no episode tracking. */
	episodes: PageEpisode[]
	/** From the show's status: false for Ended and Canceled, and when the status is not known. */
	running: boolean
	/** The season score per season number, in IMDb's numbering. */
	seasonScores: Record<string, number>
	/** Seasons that IMDb numbers differently, and what their ratings lose by it. */
	notes: Record<string, { byTitle: number; missing: number }>
}

/** A date set in the watch log. It is a day or unknown, never a time. */
export type LoggedWhen = Exclude<WatchedWhen, { precision: "moment" }>

/**
 * What the show page sends. The state machine's events, without the ones other writers own (a score, Not
 * interested, taking a title off the Wishlist), and the two edits of dates.
 */
export type PageAction =
	| Exclude<TrackingEvent, { type: "rate" | "notInterested" | "wantToSee" }>
	/** Want to See on a Dropped show with nothing watched: the show is Not started again and on the Wishlist. */
	| { type: "wantToSee"; on: true }
	| { type: "editWatchDate"; watchId: string; when: LoggedWhen }
	| { type: "setGroupDate"; group: string; day: string }

/** What an Undo puts back after it took a first watch away: the title's place on the Wishlist, and Not interested. */
export interface Restore {
	wantToSeeAddedAt?: string | null
	notInterested?: boolean
}

/** The server's answer to an action. */
export interface ActionAnswer {
	status: "applied" | "refused"
	/** Why nothing was written, in member words. */
	refused: string | null
	/** The show's state row after the action; null when it has none. */
	state: StateRow | null
	/** The log rows the action added or changed, as they are stored now. */
	rows: LogRow[]
	/** The watch ids the action removed from the log. */
	deleted: string[]
	/** What Undo needs to put back: see `Restore`. */
	cleared: { wantToSeeAddedAt: string | null; notInterested: boolean }
}

// ---------------------------------------------------------------------------------------------------------
// The browser's copy
// ---------------------------------------------------------------------------------------------------------

/** What the member has stored for the show. */
export interface ShowCopy {
	state: StateRow | null
	log: LogRow[]
}

export interface LocalContext {
	showId: number
	episodes: readonly ListedEpisode[]
	/** The date on the device, "YYYY-MM-DD": what has aired for this member. */
	today: string
	/** The time of the action, in milliseconds. */
	now: number
}

export interface LocalResult {
	copy: ShowCopy
	/** Why nothing happened; the copy is then the one that was given. */
	refused: string | null
}

/** The copy after an action, as the browser expects it before the server has answered. */
export function applyLocally(
	copy: ShowCopy,
	action: PageAction,
	actionId: string | undefined,
	ctx: LocalContext,
): LocalResult {
	if (action.type === "editWatchDate") {
		if (!copy.log.some((row) => row.watch_id === action.watchId))
			return { copy, refused: "That watch is not in the log." }
		const date = watchedAt(action.when, ctx.now)
		return {
			copy: {
				...copy,
				log: copy.log.map((row) =>
					row.watch_id === action.watchId ? { ...row, ...date } : row,
				),
			},
			refused: null,
		}
	}
	if (action.type === "setGroupDate") {
		if (!isDay(action.day)) return { copy, refused: "No such day." }
		if (!copy.log.some((row) => row.group_id === action.group))
			return { copy, refused: "That group has no watch." }
		const date = watchedAt({ precision: "day", day: action.day }, ctx.now)
		return {
			copy: {
				...copy,
				log: copy.log.map((row) =>
					row.group_id === action.group ? { ...row, ...date } : row,
				),
			},
			refused: null,
		}
	}
	const applied = applyShowEvent({
		showId: ctx.showId,
		show: showAiredBy(ctx.episodes, ctx.today),
		state: copy.state,
		log: copy.log,
		flags: { score: null, wantToSee: false, notInterested: false },
		event: action,
		actionId,
		now: ctx.now,
	})
	if (applied.refused) return { copy, refused: applied.refused }
	const gone = new Set(applied.changes.deleteIds)
	return {
		copy: {
			state: applied.changes.state,
			log: [
				...copy.log.filter((row) => !gone.has(row.watch_id)),
				...applied.changes.insert,
			],
		},
		refused: null,
	}
}

/** The copy after the server answered: its state row, and its rows in place of the guessed ones. */
export function confirmed(copy: ShowCopy, answer: ActionAnswer): ShowCopy {
	const changed = new Map(answer.rows.map((row) => [row.watch_id, row]))
	const gone = new Set(answer.deleted)
	const log = copy.log
		.filter((row) => !gone.has(row.watch_id))
		.map((row) => {
			const stored = changed.get(row.watch_id)
			if (stored) changed.delete(row.watch_id)
			return stored ?? row
		})
	return { state: answer.state, log: [...log, ...changed.values()] }
}

// ---------------------------------------------------------------------------------------------------------
// What the page shows. All of it derived, none of it stored.
// ---------------------------------------------------------------------------------------------------------

export interface SeenControl {
	/**
	 * What a press does: marks the show Seen, marks the episodes that are new since, takes the press back, or
	 * nothing, because the show is Seen by its ticks and has no press to take back.
	 */
	mode: "mark" | "markNew" | "takeBack" | "off"
	newEpisodes: number
}

export interface ShowView {
	derived: Derived
	/** The member has a state for the show or a watch of it. */
	tracked: boolean
	seen: SeenControl
	/** What the status pill's menu offers, in order: every action the machine allows now (status-menu.ts). */
	menu: MenuEntry[]
	/** The Seen press that stands for the show, with what it covered; null when none stands. */
	press: SeenPress | null
	/** Want to See can be pressed: the show is Not started, or Dropped with nothing watched. */
	wantToSee: { ok: boolean; why: string }
	/** The prompt to rate, when it is due: the show is Seen ("all"), or three episodes are watched ("partway"). */
	ratePrompt: "all" | "partway" | null
	/** The ids of the listed episodes watched in the current pass. */
	watched: Set<number>
	/** Every watch of each listed episode, in every pass, newest first and undated last. */
	watchesOf: Map<number, LogRow[]>
	/** Regular episodes that have not aired, by the date on the device. */
	unaired: number
	/** Specials watched in the current pass. They count toward nothing. */
	specialsWatched: number
}

export function viewOf(
	copy: ShowCopy,
	episodes: readonly ListedEpisode[],
	context: {
		today: string
		running: boolean
		score: number | null
		/** How dates read in the menu. The page gives the member's locale. */
		words?: DateWords
	},
): ShowView {
	const show = showAiredBy(episodes, context.today, context.running)
	const record = recordFromRows(copy.state, copy.log, {
		score: context.score,
		wantToSee: false,
		notInterested: false,
	})
	const world = { show, record }
	const derived = derive(world)
	const button = seenButton(world)
	const watched = watchedIds(show, record)
	const rowOf = new Map(copy.log.map((row) => [row.watch_id, row]))
	const watchesOf = new Map<number, LogRow[]>()
	for (const watch of record.watches) {
		const episode = countedEpisode(show, watch)
		const row = rowOf.get(watch.id)
		if (!episode || !row) continue
		const list = watchesOf.get(episode.id)
		if (list) list.push(row)
		else watchesOf.set(episode.id, [row])
	}
	for (const list of watchesOf.values())
		list.sort(
			(a, b) =>
				b.pass - a.pass ||
				(b.watched_at ?? Number.NEGATIVE_INFINITY) -
					(a.watched_at ?? Number.NEGATIVE_INFINITY) ||
				b.created_at - a.created_at,
		)
	const press = seenPressOf(copy, episodes)
	const menu = statusMenu(world, press, context.words ?? PLAIN_DATES)
	const regular = show.episodes.filter((e) => e.season > 0)
	return {
		derived,
		tracked: record.state !== "not_started" || record.watches.length > 0,
		seen: {
			mode:
				button.event === "undoSeen"
					? "takeBack"
					: button.event === null
						? "off"
						: button.newEpisodes > 0
							? "markNew"
							: "mark",
			newEpisodes: button.newEpisodes,
		},
		menu,
		press,
		wantToSee: offer(world, { type: "wantToSee", on: true }),
		ratePrompt: !derived.ratePrompt
			? null
			: derived.state === "seen"
				? "all"
				: "partway",
		watched,
		watchesOf,
		unaired: regular.length - airedRegular(show).length,
		specialsWatched: show.episodes.filter(
			(e) => e.season === 0 && watched.has(e.id),
		).length,
	}
}

// ---------------------------------------------------------------------------------------------------------
// The member data map's entry, so that cards and lists agree with the show page
// ---------------------------------------------------------------------------------------------------------

const EPISODE_KEY = 100000
const latest = (values: (number | null)[]) =>
	values.reduce<number | null>(
		(max, value) =>
			value === null ? max : max === null || value > max ? value : max,
		null,
	)

/**
 * The show's `watchState` entry of the member data map, as the grouped query and `watchStateOf` would give it for
 * these rows; null while the show is Not started.
 */
export function watchStateEntryOf(copy: ShowCopy): WatchStateEntry | null {
	const state = copy.state?.state ?? "not_started"
	if (state === "not_started") return null
	const pass = copy.state?.pass ?? 1
	const keys = copy.log
		.filter((row) => row.pass === pass && (row.season_number ?? 0) > 0)
		.map(
			(row) =>
				(row.season_number ?? 0) * EPISODE_KEY + (row.episode_number ?? 0),
		)
	const furthest = keys.length ? Math.max(...keys) : null
	const at = latest(copy.log.map((row) => row.watched_at))
	const moment = latest(
		copy.log.map((row) =>
			row.watched_at_precision === "moment" ? row.watched_at : null,
		),
	)
	const activity = latest(
		copy.log.map(
			(row) =>
				row.watched_at ?? (row.origin !== "import" ? row.created_at : null),
		),
	)
	return {
		state,
		watchedAt: at === null ? null : new Date(at),
		precision: at === null ? "unknown" : at === moment ? "moment" : "day",
		count: copy.log.length,
		pass,
		episodesWatched: new Set(keys).size,
		furthest:
			furthest === null
				? null
				: [Math.floor(furthest / EPISODE_KEY), furthest % EPISODE_KEY],
		lastActivityAt: activity === null ? null : new Date(activity),
	}
}

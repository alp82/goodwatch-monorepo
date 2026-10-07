// The state machine for a member and a show (ADR 0009, docs/implementation/tracking/data-model.md).
//
// One stored state per member and show. It changes only when the member acts. Nothing here reads a clock, a date or a
// database: "aired" is a fact the caller puts on each episode (see `showAiredBy` and `serverShow` at the end), and a
// change of the catalog is not a transition. The server and the browser run this same code.
//
// The machine is data: `TABLE` is the specification (state x event -> guard -> next state). `step()` is the
// interpreter: it applies what the event does to the watches, then takes the first row that matches. Everything a
// member reads (label, progress, next episode, filters, prompts) is worked out in `derive()` and never stored.
//
// The owner's decisions are built in: a running Seen show reads "Caught up"; On hold and Dropped survive having
// nothing watched; the page offers Not interested before the first watch and Drop after it; Watch again is built and
// needs a watched regular episode; rating a never-started show asks once whether it was seen; a Seen show with new
// episodes stays Seen.

// ---------------------------------------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------------------------------------

export const STATES = [
	"not_started",
	"watching",
	"on_hold",
	"dropped",
	"seen",
] as const
export type State = (typeof STATES)[number]

export const STATE_LABEL: Record<State, string> = {
	not_started: "Not started",
	watching: "Watching",
	on_hold: "On hold",
	dropped: "Dropped",
	seen: "Seen",
}

// ---------------------------------------------------------------------------------------------------------
// The catalog (what TMDB lists) and the member's record
// ---------------------------------------------------------------------------------------------------------

/** Season 0 holds the specials. `aired` is a fact the caller supplies; the machine never works it out. */
export interface Episode {
	/** TMDB's episode id. */
	id: number
	season: number
	number: number
	aired: boolean
}

export interface Show {
	/** From TMDB's status: false for Ended and Canceled. It only picks a word in the label. */
	running: boolean
	episodes: Episode[]
}

/** How a watch was made. Only the group of a watch matters to the machine; the origin is kept for the log. */
export type Origin = "single" | "upto" | "season" | "seen" | "score" | "import"

export interface Watch {
	/** The identity of the watch, fixed before it is written (ADR 0008). */
	id: string
	/** TMDB's id at the time of the watch. The season and number are kept beside it. */
	episodeId: number | null
	season: number
	number: number
	origin: Origin
	/** The group action that made the watch. Taking a Seen press back removes exactly its group. */
	group: string | null
	pass: number
}

/** Everything the machine knows about one member and one show. */
export interface TrackingRecord {
	state: State
	pass: number
	watches: Watch[]
	score: number | null
	wantToSee: boolean
	notInterested: boolean
	/** The Seen press that one more press takes back, and the state it was pressed from. */
	seenPress: { group: string; from: State } | null
	ratePromptDismissed: boolean
	/** "Have you seen all of it?", asked once when a never-started show is rated by hand. */
	seenQuestion: "not_asked" | "open" | "answered"
}

export interface World {
	show: Show
	record: TrackingRecord
}

export const newRecord = (): TrackingRecord => ({
	state: "not_started",
	pass: 1,
	watches: [],
	score: null,
	wantToSee: false,
	notInterested: false,
	seenPress: null,
	ratePromptDismissed: false,
	seenQuestion: "not_asked",
})

// ---------------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------------

/** When a watch happened. Without it a watch is made at the moment it is recorded. */
export type WatchedWhen =
	| { precision: "moment" }
	| { precision: "day"; day: string }
	| { precision: "unknown" }

/**
 * What a member does. Episodes are named by season and number, so a re-added episode keeps its name.
 *
 * `watch`, `pressSeen`, `markSeason` and `watchUpTo` make watches and need the action's id (see `step`).
 * `today` is the date on the member's device, which the server reads for a group action (see `serverShow`).
 */
export type TrackingEvent =
	| { type: "watch"; season: number; number: number; when?: WatchedWhen }
	| { type: "unwatch"; season: number; number: number }
	| { type: "markSeason"; season: number; today?: string }
	| { type: "watchUpTo"; season: number; number: number; today?: string }
	| { type: "unmarkSeason"; season: number }
	/** Undo of Mark season or Watched up to here: removes the watches of that group. */
	| { type: "undoGroup"; group: string }
	/** Deleting one watch in the watch log. */
	| { type: "deleteWatch"; watchId: string }
	| { type: "pressSeen"; today?: string }
	| { type: "undoSeen" }
	| { type: "hold" }
	| { type: "drop" }
	| { type: "resume" }
	/** `byHand` is false for a score that an import or the taste quiz wrote: those never ask the question. */
	| { type: "rate"; score: number | null; byHand?: boolean }
	| { type: "wantToSee"; on: boolean }
	| { type: "notInterested"; on: boolean }
	| { type: "watchAgain" }
	/** "Not now" on the prompt to rate. Never a transition. */
	| { type: "dismissRatePrompt" }
	/** "I'm partway" or "Just rating". "Yes, all of it" is a Seen press. Never a transition. */
	| { type: "answerSeenQuestion"; answer: "partway" | "just_rating" }

/** The event column of the table. "catalog" stands for every change of the catalog. */
export type TableEvent =
	| "watch"
	| "unwatch"
	| "pressSeen"
	| "undoSeen"
	| "hold"
	| "drop"
	| "resume"
	| "rate"
	| "wantToSee"
	| "notInterested"
	| "watchAgain"
	| "catalog"

type TableMemberEvent = Extract<
	TrackingEvent,
	{ type: Exclude<TableEvent, "catalog"> }
>

export const EVENT_LABEL: Record<TableEvent, string> = {
	watch: "watch an episode",
	unwatch: "unwatch an episode",
	pressSeen: "press Seen",
	undoSeen: "press Seen again",
	hold: "put on hold",
	drop: "drop",
	resume: "resume",
	rate: "rate",
	wantToSee: "Want to See",
	notInterested: "Not interested",
	watchAgain: "watch again",
	catalog: "the catalog changes",
}

// ---------------------------------------------------------------------------------------------------------
// Facts: read when an event happens, never stored
// ---------------------------------------------------------------------------------------------------------

export const isSpecial = (episode: { season: number }) => episode.season === 0
export const episodeLabel = (episode: { season: number; number: number }) =>
	isSpecial(episode)
		? `Special ${episode.number}`
		: `S${episode.season} E${episode.number}`
const inOrder = (
	a: { season: number; number: number },
	b: { season: number; number: number },
) => a.season - b.season || a.number - b.number

/** A: the aired regular episodes, in order. */
export const airedRegular = (show: Show) =>
	show.episodes.filter((e) => !isSpecial(e) && e.aired).sort(inOrder)

/**
 * The listed episode a watch counts for. By id; and when TMDB removed the episode and added it again under a new
 * id, by season and number, as long as exactly one listed episode has them.
 */
export function countedEpisode(show: Show, watch: Watch): Episode | null {
	if (watch.episodeId !== null) {
		const byId = show.episodes.find((e) => e.id === watch.episodeId)
		if (byId) return byId
	}
	const same = show.episodes.filter(
		(e) => e.season === watch.season && e.number === watch.number,
	)
	return same.length === 1 ? same[0] : null
}

/** The ids of the listed episodes watched in one pass. */
export function watchedIds(
	show: Show,
	record: TrackingRecord,
	pass = record.pass,
): Set<number> {
	const ids = new Set<number>()
	for (const watch of record.watches) {
		if (watch.pass !== pass) continue
		const episode = countedEpisode(show, watch)
		if (episode) ids.add(episode.id)
	}
	return ids
}

export interface Facts {
	/** |A|: aired regular episodes. */
	aired: number
	/** |W|: aired regular episodes watched in the current pass. */
	watched: number
	/** W = A and A is not empty. */
	upToDate: boolean
	/** A watch of a regular episode exists, in any pass. */
	watchRemains: boolean
}

export function facts(show: Show, record: TrackingRecord): Facts {
	const aired = airedRegular(show)
	const ids = watchedIds(show, record)
	const watched = aired.filter((e) => ids.has(e.id)).length
	return {
		aired: aired.length,
		watched,
		upToDate: aired.length > 0 && watched === aired.length,
		watchRemains: record.watches.some((w) => !isSpecial(w)),
	}
}

// ---------------------------------------------------------------------------------------------------------
// Guards. A guard is checked AFTER the event did its work on the watches.
// ---------------------------------------------------------------------------------------------------------

interface GuardInput {
	/** The record before the event. */
	before: TrackingRecord
	facts: Facts
	factsBefore: Facts
	/** The episode of a watch or unwatch. */
	episode: { season: number } | null
}

export const GUARDS = {
	special: {
		says: "the episode is a special",
		test: (g: GuardInput) => !!g.episode && isSpecial(g.episode),
	},
	upToDate: {
		says: "every aired episode is now watched",
		test: (g: GuardInput) => g.facts.upToDate,
	},
	notUpToDate: {
		says: "aired episodes are still unwatched",
		test: (g: GuardInput) => !g.facts.upToDate,
	},
	watchRemains: {
		says: "a watch remains",
		test: (g: GuardInput) => g.facts.watchRemains,
	},
	noWatchRemains: {
		says: "no watch remains",
		test: (g: GuardInput) => !g.facts.watchRemains,
	},
	newEpisodes: {
		says: "episodes aired since",
		test: (g: GuardInput) => g.factsBefore.watched < g.factsBefore.aired,
	},
	pressedFromSeen: {
		says: "the press was made on a Seen show",
		test: (g: GuardInput) => g.before.seenPress?.from === "seen",
	},
	pressedOnHold: {
		says: "the press was made on an On hold show",
		test: (g: GuardInput) => g.before.seenPress?.from === "on_hold",
	},
	pressedDropped: {
		says: "the press was made on a Dropped show",
		test: (g: GuardInput) => g.before.seenPress?.from === "dropped",
	},
	regularWatched: {
		says: "a regular episode is watched",
		test: (g: GuardInput) => g.facts.watchRemains,
	},
} as const
export type Guard = keyof typeof GUARDS

// ---------------------------------------------------------------------------------------------------------
// THE TRANSITION TABLE. This is the specification. Rows are tried from the top; the first that matches is taken.
// The ids are the ones the data model and ADR 0009 use. 10b and 27b belonged to options the owner did not choose.
// ---------------------------------------------------------------------------------------------------------

export interface Row {
	id: string
	from: readonly State[]
	event: TableEvent
	guard: Guard | null
	/** "same" keeps the state. */
	to: State | "same"
	/** One line a person can read. */
	says: string
}

const ANY = STATES
const BEFORE_SEEN: readonly State[] = [
	"not_started",
	"watching",
	"on_hold",
	"dropped",
]

export const TABLE: readonly Row[] = [
	// watch
	{
		id: "1",
		from: ANY,
		event: "watch",
		guard: "special",
		to: "same",
		says: "A special is recorded and changes nothing else.",
	},
	{
		id: "2",
		from: BEFORE_SEEN,
		event: "watch",
		guard: "upToDate",
		to: "seen",
		says: "That was the last aired episode: the show is Seen.",
	},
	{
		id: "3",
		from: BEFORE_SEEN,
		event: "watch",
		guard: "notUpToDate",
		to: "watching",
		says: "An episode is watched and more are left: Watching. This also ends On hold and Dropped.",
	},
	{
		id: "4",
		from: ["seen"],
		event: "watch",
		guard: "upToDate",
		to: "same",
		says: "New episodes had aired and now all of them are watched: still Seen.",
	},
	{
		id: "5",
		from: ["seen"],
		event: "watch",
		guard: "notUpToDate",
		to: "watching",
		says: "New episodes had aired and only some are watched: back to Watching.",
	},
	// unwatch
	{
		id: "6",
		from: ANY,
		event: "unwatch",
		guard: "special",
		to: "same",
		says: "Unticking a special changes nothing else.",
	},
	{
		id: "7",
		from: ["watching", "seen"],
		event: "unwatch",
		guard: "watchRemains",
		to: "watching",
		says: "An episode is unticked and others stay: Watching.",
	},
	{
		id: "8",
		from: ["watching", "seen"],
		event: "unwatch",
		guard: "noWatchRemains",
		to: "not_started",
		says: "The only watched episode is unticked: Not started.",
	},
	{
		id: "9",
		from: ["on_hold", "dropped"],
		event: "unwatch",
		guard: "watchRemains",
		to: "same",
		says: "Unticking an episode leaves On hold and Dropped alone.",
	},
	{
		id: "10",
		from: ["on_hold", "dropped"],
		event: "unwatch",
		guard: "noWatchRemains",
		to: "same",
		says: "On hold and Dropped were chosen, so they stay with nothing watched.",
	},
	// Seen, and Seen again
	{
		id: "11",
		from: BEFORE_SEEN,
		event: "pressSeen",
		guard: null,
		to: "seen",
		says: "Seen marks every aired episode not yet watched, as one group without dates.",
	},
	{
		id: "12",
		from: ["seen"],
		event: "pressSeen",
		guard: "newEpisodes",
		to: "same",
		says: "On a Seen show with new episodes, Seen marks the new ones as a group of their own.",
	},
	{
		id: "13",
		from: ["seen"],
		event: "undoSeen",
		guard: "pressedFromSeen",
		to: "same",
		says: "The press only added new episodes; taking it back leaves the show Seen with them new again.",
	},
	{
		id: "15",
		from: ["seen"],
		event: "undoSeen",
		guard: "pressedOnHold",
		to: "on_hold",
		says: "The press is taken back: On hold, as before, with the episodes ticked before it.",
	},
	{
		id: "16",
		from: ["seen"],
		event: "undoSeen",
		guard: "pressedDropped",
		to: "dropped",
		says: "The press is taken back: Dropped, as before, with the episodes ticked before it.",
	},
	{
		id: "14",
		from: ["seen"],
		event: "undoSeen",
		guard: "watchRemains",
		to: "watching",
		says: "The press is taken back and episodes ticked before it stay: Watching, as before.",
	},
	{
		id: "17",
		from: ["seen"],
		event: "undoSeen",
		guard: "noWatchRemains",
		to: "not_started",
		says: "The press is taken back and nothing else was watched: Not started.",
	},
	// On hold, Dropped, Resume
	{
		id: "18",
		from: ["watching"],
		event: "hold",
		guard: null,
		to: "on_hold",
		says: "Set aside, may return.",
	},
	{
		id: "19",
		from: ["not_started", "watching", "on_hold"],
		event: "drop",
		guard: null,
		to: "dropped",
		says: "Given up on. Clears Want to See; always hidden from recommendations.",
	},
	{
		id: "20",
		from: ["on_hold", "dropped"],
		event: "resume",
		guard: "watchRemains",
		to: "watching",
		says: "Back to it: Watching.",
	},
	{
		id: "21",
		from: ["on_hold", "dropped"],
		event: "resume",
		guard: "noWatchRemains",
		to: "not_started",
		says: "Back to it with nothing watched: Not started.",
	},
	// Things that are not a status
	{
		id: "22",
		from: ANY,
		event: "rate",
		guard: null,
		to: "same",
		says: "A score never changes the state. A scored show still counts as Seen for Not seen yet.",
	},
	{
		id: "23",
		from: ["not_started"],
		event: "wantToSee",
		guard: null,
		to: "same",
		says: "On or off the Wishlist. Not a state.",
	},
	{
		id: "24",
		from: ["dropped"],
		event: "wantToSee",
		guard: "noWatchRemains",
		to: "not_started",
		says: "Want to See clears Dropped. Offered only with nothing watched; otherwise Resume is the way back.",
	},
	{
		id: "25",
		from: ["not_started"],
		event: "notInterested",
		guard: null,
		to: "same",
		says: "Hidden from recommendations. Not a state; offered only before the first watch.",
	},
	{
		id: "26",
		from: ["seen"],
		event: "watchAgain",
		guard: "regularWatched",
		to: "watching",
		says: "A new pass starts. Progress and the next episode count only its watches.",
	},
	// The catalog. No code takes this row: the catalog is an argument of every function here, never an event.
	{
		id: "27",
		from: ANY,
		event: "catalog",
		guard: null,
		to: "same",
		says: "An episode airs, a season starts, the show ends, TMDB re-adds an episode: never a transition.",
	},
]

const row = (id: string) => TABLE.find((r) => r.id === id) as Row

// ---------------------------------------------------------------------------------------------------------
// What an event does to the record, before the table is read
// ---------------------------------------------------------------------------------------------------------

export const findEpisode = (show: Show, season: number, number: number) =>
	show.episodes.find((e) => e.season === season && e.number === number) ?? null

/** The watch id of one episode of a group action. */
export const groupWatchId = (group: string, episodeId: number) =>
	`g-${group}-${episodeId}`

const answered = (record: TrackingRecord) =>
	record.seenQuestion === "open" ? "answered" : record.seenQuestion

function effect(
	show: Show,
	record: TrackingRecord,
	event: TableMemberEvent,
	actionId: string,
	made: { origin: Origin; group: string | null },
): TrackingRecord {
	switch (event.type) {
		case "watch": {
			const episode = findEpisode(show, event.season, event.number)
			if (!episode) return record
			const watch: Watch = {
				id: actionId,
				episodeId: episode.id,
				season: episode.season,
				number: episode.number,
				origin: made.origin,
				group: made.group,
				pass: record.pass,
			}
			// A special is only its own mark.
			if (isSpecial(episode))
				return { ...record, watches: [...record.watches, watch] }
			return {
				...record,
				watches: [...record.watches, watch],
				wantToSee: false,
				notInterested: false,
				seenQuestion: answered(record),
			}
		}
		case "unwatch": {
			const episode = findEpisode(show, event.season, event.number)
			if (!episode) return record
			return {
				...record,
				watches: record.watches.filter(
					(w) =>
						!(
							w.pass === record.pass &&
							countedEpisode(show, w)?.id === episode.id
						),
				),
			}
		}
		case "pressSeen": {
			const have = watchedIds(show, record)
			const watches: Watch[] = airedRegular(show)
				.filter((e) => !have.has(e.id))
				.map((e) => ({
					id: groupWatchId(actionId, e.id),
					episodeId: e.id,
					season: e.season,
					number: e.number,
					origin: "seen",
					group: actionId,
					pass: record.pass,
				}))
			return {
				...record,
				watches: [...record.watches, ...watches],
				seenPress: { group: actionId, from: record.state },
				wantToSee: false,
				notInterested: false,
				seenQuestion: answered(record),
			}
		}
		case "undoSeen":
			return {
				...record,
				watches: record.watches.filter(
					(w) => w.group !== record.seenPress?.group,
				),
				seenPress: null,
			}
		case "drop":
			return { ...record, wantToSee: false, notInterested: false }
		case "rate":
			return {
				...record,
				score: event.score,
				notInterested: event.score === null ? record.notInterested : false,
			}
		case "wantToSee":
			return {
				...record,
				wantToSee: event.on,
				notInterested: event.on ? false : record.notInterested,
			}
		case "notInterested":
			return {
				...record,
				notInterested: event.on,
				wantToSee: event.on ? false : record.wantToSee,
			}
		case "watchAgain":
			return { ...record, pass: record.pass + 1 }
		default:
			return record
	}
}

// ---------------------------------------------------------------------------------------------------------
// Why an event is not possible, in member words
// ---------------------------------------------------------------------------------------------------------

function whyNot(
	world: World,
	event: TableMemberEvent,
	actionId: string,
	resend: boolean,
): string | null {
	const { show, record } = world
	const state = record.state
	switch (event.type) {
		case "watch": {
			if (!actionId) return "A watch needs an id."
			const episode = findEpisode(show, event.season, event.number)
			if (!episode) return "The show lists no such episode."
			if (!episode.aired) return "It has not aired yet."
			if (watchedIds(show, record).has(episode.id))
				return "Already watched in this pass."
			return null
		}
		case "unwatch": {
			const episode = findEpisode(show, event.season, event.number)
			if (!episode) return "The show lists no such episode."
			if (!resend && !watchedIds(show, record).has(episode.id))
				return "Not watched in this pass."
			return null
		}
		case "pressSeen":
			if (!actionId) return "A Seen press needs an id."
			if (state !== "seen") return null
			if (facts(show, record).watched < airedRegular(show).length) return null
			return record.seenPress
				? "Pressing Seen again takes the press back."
				: "It is Seen because every aired episode is ticked. Untick one to change that."
		case "undoSeen":
			return state === "seen" && record.seenPress
				? null
				: "There is no Seen press to take back."
		case "hold":
			if (state === "watching") return null
			return {
				not_started:
					"Nothing is watched yet, so there is nothing to put on hold.",
				on_hold: "It is on hold already.",
				dropped: "It is dropped. Resume it first.",
				seen: "On hold is for a show you are in the middle of.",
			}[state]
		case "drop":
			if (state === "dropped") return "It is dropped already."
			if (state === "seen") return "A show you have seen can't be dropped."
			return null
		case "resume":
			return state === "on_hold" || state === "dropped"
				? null
				: "Only a show that is on hold or dropped can be resumed."
		case "wantToSee":
			if (state === "not_started") return null
			if (!event.on) return "It is not on your Wishlist."
			if (state === "dropped")
				return facts(show, record).watchRemains
					? "You have started it. Resume brings it back to Watching."
					: null
			return state === "seen"
				? "You have seen it."
				: "You have started it, so it lives under Watching and not in the Wishlist."
		case "notInterested":
			if (state === "not_started") return null
			if (state === "dropped")
				return "Dropped hides it from recommendations already."
			return state === "seen"
				? "You have seen it."
				: "Once an episode is watched, Drop takes its place."
		case "watchAgain":
			if (state !== "seen")
				return "Only a show you have seen can be watched again."
			return facts(show, record).watchRemains
				? null
				: "No episode of it is watched, so there is nothing to watch again."
		default:
			return null
	}
}

// ---------------------------------------------------------------------------------------------------------
// The interpreter
// ---------------------------------------------------------------------------------------------------------

export interface Step {
	world: World
	event: TrackingEvent
	/** The last row that was used; null when the event was refused or answered a prompt. */
	row: Row | null
	/** Every row that was used, in order. A group action uses one per episode. */
	rows: Row[]
	from: State
	to: State
	/** Why nothing happened. */
	refused: string | null
}

export interface StepOptions {
	/**
	 * For the server, which can't tell a first request from one that is sent again after its log rows were written
	 * (a timeout, a crash between the log and the state, a retry after another action on the show).
	 *
	 * With it, watches that carry this action's id are left out before the event is applied, so the event gives the
	 * same watches and the right state again; a Seen press that already stands under this id, and a Drop of a
	 * Dropped show, only clear what they clear; an unwatch of an episode that is no longer watched still takes its
	 * row of the table; and a deletion that finds nothing left to delete only makes a Watching show with no watch
	 * Not started.
	 */
	resend?: boolean
}

function findRow(
	from: State,
	event: TableEvent,
	input: GuardInput,
): Row | null {
	return (
		TABLE.find(
			(r) =>
				r.event === event &&
				r.from.includes(from) &&
				(!r.guard || GUARDS[r.guard].test(input)),
		) ?? null
	)
}

/** One event of the table: its effect on the record, then the first row that matches. */
function single(
	world: World,
	event: TableMemberEvent,
	actionId: string,
	resend: boolean,
	made: { origin: Origin; group: string | null } = {
		origin: "single",
		group: null,
	},
): { record: TrackingRecord; row: Row } | { refused: string } {
	const refused = whyNot(world, event, actionId, resend)
	if (refused) return { refused }
	const { show, record } = world
	const from = record.state
	const episode =
		event.type === "watch" || event.type === "unwatch"
			? findEpisode(show, event.season, event.number)
			: null
	const after = effect(show, record, event, actionId, made)
	const taken = findRow(from, event.type, {
		before: record,
		facts: facts(show, after),
		factsBefore: facts(show, record),
		episode,
	})
	if (!taken)
		return {
			refused: `No row: "${EVENT_LABEL[event.type]}" is not possible from ${STATE_LABEL[from]}.`,
		}
	const to = taken.to === "same" ? from : taken.to
	let next: TrackingRecord = { ...after, state: to }
	// A press can be taken back only while the show is still Seen.
	if (to !== "seen") next = { ...next, seenPress: null }
	if (
		event.type === "rate" &&
		event.score !== null &&
		event.byHand !== false &&
		from === "not_started" &&
		next.seenQuestion === "not_asked"
	)
		next = { ...next, seenQuestion: "open" }
	return { record: next, row: taken }
}

const isRegular = (watch: { season: number }) => watch.season > 0

/** A Watching or Seen show with no watch of a regular episode left is Not started (row 8). */
function withoutWatchNotStarted(
	record: TrackingRecord,
	rows: Row[],
): TrackingRecord {
	if (record.state !== "watching" && record.state !== "seen") return record
	if (record.watches.some(isRegular)) return record
	rows.push(row("8"))
	return { ...record, state: "not_started", seenPress: null }
}

/**
 * Applies one event. `actionId` is the id the browser made for the action: the watch id of a `watch`, the group id
 * of `pressSeen`, `markSeason` and `watchUpTo`. Other events ignore it.
 *
 * A refused event returns the same world.
 */
export function step(
	world: World,
	event: TrackingEvent,
	actionId = "",
	options: StepOptions = {},
): Step {
	const resend = options.resend === true
	const from = world.record.state
	const nothing = (refused: string): Step => ({
		world,
		event,
		row: null,
		rows: [],
		from,
		to: from,
		refused,
	})
	const done = (record: TrackingRecord, rows: Row[]): Step => ({
		world: { show: world.show, record },
		event,
		row: rows.length ? rows[rows.length - 1] : null,
		rows,
		from,
		to: record.state,
		refused: null,
	})
	const { show } = world
	const without = (drop: (watch: Watch) => boolean): World => ({
		show,
		record: {
			...world.record,
			watches: world.record.watches.filter((w) => !drop(w)),
		},
	})
	/** Each episode in turn, as that many watch or unwatch events. */
	const inTurn = (
		start: World,
		episodes: Episode[],
		one: (at: World, episode: Episode) => ReturnType<typeof single>,
	): { world: World; rows: Row[] } | { refused: string } => {
		let at = start
		const rows: Row[] = []
		for (const episode of episodes) {
			const result = one(at, episode)
			if ("refused" in result) return result
			rows.push(result.row)
			at = { show, record: result.record }
		}
		return { world: at, rows }
	}
	const unwatchEach = (start: World, episodes: Episode[]) =>
		inTurn(start, episodes, (at, e) =>
			single(
				at,
				{ type: "unwatch", season: e.season, number: e.number },
				"",
				false,
			),
		)
	/** Removes watches by id: an unwatch for every episode that loses its last watch of the pass, then row 8. */
	const remove = (ids: Set<string>): Step => {
		const record = world.record
		const perEpisode = new Map<number, { episode: Episode; all: boolean }>()
		for (const watch of record.watches) {
			if (watch.pass !== record.pass) continue
			const episode = countedEpisode(show, watch)
			if (!episode) continue
			const entry = perEpisode.get(episode.id) ?? { episode, all: true }
			if (!ids.has(watch.id)) entry.all = false
			perEpisode.set(episode.id, entry)
		}
		const lost = [...perEpisode.values()]
			.filter((entry) => entry.all)
			.map((entry) => entry.episode)
			.sort(inOrder)
		const unwatched = unwatchEach(world, lost)
		if ("refused" in unwatched) return nothing(unwatched.refused)
		const rows = unwatched.rows
		const left: TrackingRecord = {
			...unwatched.world.record,
			watches: unwatched.world.record.watches.filter((w) => !ids.has(w.id)),
		}
		return done(withoutWatchNotStarted(left, rows), rows)
	}
	/**
	 * A deletion sent again that finds nothing to delete. What it deleted is gone and can't say whether the state
	 * should move, so only the one pair the machine never allows is mended: Watching with nothing watched. Seen with
	 * nothing watched is left, because a press on a show without an episode list is exactly that.
	 */
	const nothingLeft = (): Step => {
		const rows: Row[] = []
		return done(
			world.record.state === "watching"
				? withoutWatchNotStarted(world.record, rows)
				: world.record,
			rows,
		)
	}

	switch (event.type) {
		case "dismissRatePrompt":
			return done({ ...world.record, ratePromptDismissed: true }, [])
		case "answerSeenQuestion":
			return done({ ...world.record, seenQuestion: "answered" }, [])
		case "markSeason":
		case "watchUpTo": {
			if (!actionId) return nothing("A group action needs an id.")
			const base = resend ? without((w) => w.group === actionId) : world
			const have = watchedIds(show, base.record)
			const targets = airedRegular(show).filter(
				(e) =>
					!have.has(e.id) &&
					(event.type === "markSeason"
						? e.season === event.season
						: e.season < event.season ||
							(e.season === event.season && e.number <= event.number)),
			)
			if (!targets.length)
				return nothing("Every aired episode of it is watched in this pass.")
			const made = {
				origin: event.type === "markSeason" ? "season" : "upto",
				group: actionId,
			} as const
			const watched = inTurn(base, targets, (at, e) =>
				single(
					at,
					{ type: "watch", season: e.season, number: e.number },
					groupWatchId(actionId, e.id),
					false,
					made,
				),
			)
			if ("refused" in watched) return nothing(watched.refused)
			return done(watched.world.record, watched.rows)
		}
		case "unmarkSeason": {
			const have = watchedIds(show, world.record)
			const targets = show.episodes
				.filter((e) => e.season === event.season && have.has(e.id))
				.sort(inOrder)
			if (!targets.length) {
				if (!resend) return nothing("Nothing of it is watched in this pass.")
				// Sent again after its watches were deleted: the row an unwatch takes now.
				const taken = findRow(from, "unwatch", {
					before: world.record,
					facts: facts(show, world.record),
					factsBefore: facts(show, world.record),
					episode: { season: event.season },
				})
				if (!taken) return nothing("Nothing of it is watched in this pass.")
				const to = taken.to === "same" ? from : taken.to
				return done(
					{
						...world.record,
						state: to,
						seenPress: to === "seen" ? world.record.seenPress : null,
					},
					[taken],
				)
			}
			const unwatched = unwatchEach(world, targets)
			if ("refused" in unwatched) return nothing(unwatched.refused)
			return done(unwatched.world.record, unwatched.rows)
		}
		case "undoGroup": {
			if (world.record.seenPress?.group === event.group)
				return step(world, { type: "undoSeen" }, actionId, options)
			const ids = world.record.watches
				.filter((w) => w.group === event.group)
				.map((w) => w.id)
			if (!ids.length)
				return resend ? nothingLeft() : nothing("That group has no watch left.")
			return remove(new Set(ids))
		}
		case "deleteWatch": {
			if (!world.record.watches.some((w) => w.id === event.watchId))
				return resend ? nothingLeft() : nothing("That watch is not in the log.")
			return remove(new Set([event.watchId]))
		}
		default: {
			let base = world
			if (resend && event.type === "watch")
				base = without((w) => w.id === actionId)
			// Dropped already: the state is written. What Drop clears may not be.
			if (resend && event.type === "drop" && from === "dropped")
				return done(
					{ ...world.record, wantToSee: false, notInterested: false },
					[],
				)
			if (resend && event.type === "pressSeen") {
				// The press already stands: its watches and the state are written. What it clears may not be.
				if (actionId && world.record.seenPress?.group === actionId)
					return done(
						{
							...world.record,
							wantToSee: false,
							notInterested: false,
							seenQuestion: answered(world.record),
						},
						[],
					)
				base = without((w) => w.group === actionId)
			}
			const result = single(base, event, actionId, resend)
			if ("refused" in result) return nothing(result.refused)
			return done(result.record, [result.row])
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// Derived: everything a member reads. Never stored.
// ---------------------------------------------------------------------------------------------------------

export interface Derived {
	state: State
	/** The state in member words. */
	label: string
	running: boolean
	pass: number
	/** Progress: |W| of |A|. */
	watched: number
	aired: number
	/** A minus W, while the state is Seen. */
	newEpisodes: number
	next: Episode | null
	/** For filters: the state is Seen, or the show has a score. */
	countsAsSeen: boolean
	hiddenByNotSeenYet: boolean
	hiddenFromRecommendations: boolean
	/** Which of Not interested and Drop the page offers. */
	offers: ("notInterested" | "drop")[]
	ratePrompt: boolean
	seenQuestion: boolean
}

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`

/**
 * The label of a state. A Seen show that is still running reads "Caught up"; with new episodes either says how many.
 * Shared by the show page (exact counts) and the lists (counts from the grouped query).
 */
export function stateLabel(
	state: State,
	running: boolean,
	newEpisodes: number,
): string {
	if (state !== "seen") return STATE_LABEL[state]
	if (running)
		return newEpisodes > 0 ? `Caught up · ${newEpisodes} new` : "Caught up"
	return newEpisodes > 0
		? `Seen · ${plural(newEpisodes, "new episode")}`
		: "Seen"
}

/**
 * The first aired regular episode after the furthest one watched in the current pass that is not watched in this
 * pass; with nothing after it, the earliest one not watched in this pass.
 */
export function nextEpisode(
	show: Show,
	record: TrackingRecord,
): Episode | null {
	const aired = airedRegular(show)
	const ids = watchedIds(show, record)
	let furthest = -1
	aired.forEach((e, index) => {
		if (ids.has(e.id)) furthest = index
	})
	return (
		aired.find((e, index) => index > furthest && !ids.has(e.id)) ??
		aired.find((e) => !ids.has(e.id)) ??
		null
	)
}

export function derive(world: World): Derived {
	const { show, record } = world
	const f = facts(show, record)
	const state = record.state
	const newEpisodes = state === "seen" ? f.aired - f.watched : 0
	const hasNext = state === "watching" || state === "on_hold" || newEpisodes > 0
	const rated = record.score !== null
	const countsAsSeen = state === "seen" || rated
	const hasStatus =
		state === "watching" || state === "on_hold" || state === "dropped"
	const regularWatches = new Set(
		record.watches.filter(isRegular).map((w) => `${w.season}.${w.number}`),
	).size
	return {
		state,
		label: stateLabel(state, show.running, newEpisodes),
		running: show.running,
		pass: record.pass,
		watched: f.watched,
		aired: f.aired,
		newEpisodes,
		next: hasNext ? nextEpisode(show, record) : null,
		countsAsSeen,
		hiddenByNotSeenYet: countsAsSeen || hasStatus,
		hiddenFromRecommendations: state === "dropped" || record.notInterested,
		offers:
			state === "not_started"
				? ["notInterested"]
				: state === "watching" || state === "on_hold"
					? ["drop"]
					: [],
		ratePrompt:
			!rated &&
			!record.ratePromptDismissed &&
			(regularWatches >= 3 || record.seenPress !== null),
		seenQuestion: record.seenQuestion === "open",
	}
}

// ---------------------------------------------------------------------------------------------------------
// What the page offers
// ---------------------------------------------------------------------------------------------------------

/** Whether the page offers an event now. The machine accepts a little more: an import can drop a never-started show. */
export function offer(
	world: World,
	event: TrackingEvent,
): { ok: boolean; why: string } {
	if (event.type === "drop" && world.record.state === "not_started")
		return {
			ok: false,
			why: "With nothing watched the page offers Not interested instead.",
		}
	const tried = step(world, event, "offer")
	return { ok: !tried.refused, why: tried.refused ?? "" }
}

/** The Seen button is one button: it presses, marks the new episodes, takes the press back, or is off. */
export function seenButton(world: World): {
	event: "pressSeen" | "undoSeen" | null
	/** How many episodes a press on a Seen show would mark. */
	newEpisodes: number
} {
	const { show, record } = world
	if (record.state !== "seen") return { event: "pressSeen", newEpisodes: 0 }
	const fresh = airedRegular(show).length - facts(show, record).watched
	if (fresh > 0) return { event: "pressSeen", newEpisodes: fresh }
	return { event: record.seenPress ? "undoSeen" : null, newEpisodes: 0 }
}

// ---------------------------------------------------------------------------------------------------------
// Aired: UTC on the server, the device's date in the browser (C4 of the data model)
// ---------------------------------------------------------------------------------------------------------

/** An episode as the catalog lists it. `airDate` is TMDB's calendar date, "YYYY-MM-DD", or null when unknown. */
export interface ListedEpisode {
	id: number
	season: number
	number: number
	airDate: string | null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
export const isDay = (value: unknown): value is string =>
	typeof value === "string" &&
	DAY.test(value) &&
	!Number.isNaN(Date.parse(`${value}T00:00:00Z`))

/** The calendar date of an instant in UTC. */
export const utcDay = (at: Date | number) =>
	new Date(at).toISOString().slice(0, 10)

const dayAfter = (day: string) =>
	utcDay(Date.parse(`${day}T00:00:00Z`) + 86_400_000)

/** The show with every episode aired whose air date is on or before `day`. The browser passes the device's date. */
export function showAiredBy(
	episodes: readonly ListedEpisode[],
	day: string,
	running = false,
): Show {
	return {
		running,
		episodes: episodes.map((e) => ({
			id: e.id,
			season: e.season,
			number: e.number,
			aired: e.airDate !== null && e.airDate <= day,
		})),
	}
}

/**
 * The show as the server reads it for one event. Aired goes by the UTC date, with the tolerance that lets a device
 * ahead of UTC act on what it shows: the episode of a `watch` counts as aired when it airs at most one day after
 * the UTC date, and a group action marks by the later of the UTC date and the device's `today`, at most one day on.
 */
export function serverShow(
	episodes: readonly ListedEpisode[],
	event: TrackingEvent,
	utcToday: string,
	running = false,
): Show {
	const limit = dayAfter(utcToday)
	const device =
		(event.type === "pressSeen" ||
			event.type === "markSeason" ||
			event.type === "watchUpTo") &&
		isDay(event.today)
			? event.today
			: utcToday
	const through =
		device <= utcToday ? utcToday : device < limit ? device : limit
	const show = showAiredBy(episodes, through, running)
	if (event.type !== "watch") return show
	const ticked = episodes.find(
		(e) => e.season === event.season && e.number === event.number,
	)
	if (!ticked || ticked.airDate === null || ticked.airDate > limit) return show
	return {
		running,
		episodes: show.episodes.map((e) =>
			e.id === ticked.id ? { ...e, aired: true } : e,
		),
	}
}

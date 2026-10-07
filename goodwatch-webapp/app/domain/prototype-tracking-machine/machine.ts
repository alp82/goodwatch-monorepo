// PROTOTYPE - throwaway (issue #368, map #365). The state machine for a member and a show.
//
// One stored state per member and show. It changes only when the member acts (or an import replays such acts).
// Nothing here reads a clock or a date: "aired" is a fact of the catalog, and a catalog change is not a transition.
//
// The machine is DATA: `TABLE` below is the whole specification (state x event -> guard -> next state). `step()`
// is the interpreter: it applies what the event does to the watches, then takes the first row that matches.
// Everything a member reads (label, progress, next episode, filters, prompts) is worked out in `derive()` and never
// stored.

// ---------------------------------------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------------------------------------

export const STATES = ["not_started", "watching", "on_hold", "dropped", "seen"] as const
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

/** Season 0 holds the specials. `aired` is a catalog fact; the machine never works it out from a date. */
export interface Episode {
	id: string
	season: number
	number: number
	aired: boolean
}

export interface Show {
	key: string
	title: string
	about: string
	/** From TMDB's status: false for Ended and Canceled. It only picks a word in the label. */
	running: boolean
	episodes: Episode[]
	/** Counter for the ids of episodes the catalog adds later. */
	made: number
}

export interface Watch {
	/** TMDB's id at the time of the watch. The season and number are kept beside it (ADR 0008). */
	episodeId: string
	season: number
	number: number
	origin: "hand" | "bulk"
	/** The Seen press that made a bulk watch. Taking the press back removes exactly this group. */
	group: string | null
	pass: number
}

export interface Member {
	state: State
	pass: number
	watches: Watch[]
	score: number | null
	wantToSee: boolean
	notInterested: boolean
	/** The Seen press that one more press takes back, and the state it was pressed from. */
	seenPress: { group: string; from: State } | null
	/** How many Seen presses were made, for group ids. */
	presses: number
	ratePromptDismissed: boolean
	/** "Have you seen all of it?", asked once when a never-started show is rated. */
	seenQuestion: "not_asked" | "open" | "answered"
}

export interface World {
	show: Show
	member: Member
}

export const newMember = (): Member => ({
	state: "not_started",
	pass: 1,
	watches: [],
	score: null,
	wantToSee: false,
	notInterested: false,
	seenPress: null,
	presses: 0,
	ratePromptDismissed: false,
	seenQuestion: "not_asked",
})

// ---------------------------------------------------------------------------------------------------------
// The open decisions, as switches. `RECOMMENDED` is what the page runs unless a switch is flipped.
// ---------------------------------------------------------------------------------------------------------

export interface Settings {
	/** M1: what a Seen show that is still running is called. */
	m1: "caught_up" | "seen"
	/** M2: unwatching the last watch of an On hold or Dropped show. */
	m2: "keep" | "not_started"
	/** M3: what the page offers before the first watch. */
	m3: "not_interested" | "both"
	/** M4: Watch again. */
	m4: "drawn" | "built"
	/** M5: "Have you seen all of it?" after rating a never-started title. */
	m5: "shows" | "shows_and_films" | "never"
	/** M6: a Seen show with new episodes. */
	m6: "stays" | "returns"
}

export const RECOMMENDED: Settings = { m1: "caught_up", m2: "keep", m3: "not_interested", m4: "drawn", m5: "shows", m6: "stays" }

// ---------------------------------------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------------------------------------

/** What a member does. Episodes are named by season and number, so a re-added episode keeps its name. */
export type MemberEvent =
	| { type: "watch"; season: number; number: number }
	| { type: "unwatch"; season: number; number: number }
	| { type: "pressSeen" }
	| { type: "undoSeen" }
	| { type: "hold" }
	| { type: "drop" }
	| { type: "resume" }
	| { type: "rate"; score: number | null }
	| { type: "wantToSee" }
	| { type: "notInterested" }
	| { type: "watchAgain" }

/** What the catalog does. None of these is a transition (except under the M6 alternative). */
export type CatalogEvent = { type: "episodeAirs" } | { type: "seasonAirs" } | { type: "showEnds" } | { type: "episodeReadded" }

/** Answering a prompt of the page. Never a transition. */
export type PageEvent = { type: "dismissRatePrompt" } | { type: "answerSeenQuestion"; answer: "partway" | "just_rating" }

export type AnyEvent = MemberEvent | CatalogEvent | PageEvent

const CATALOG_TYPES = ["episodeAirs", "seasonAirs", "showEnds", "episodeReadded"]
const PAGE_TYPES = ["dismissRatePrompt", "answerSeenQuestion"]
export const isCatalogEvent = (event: AnyEvent): event is CatalogEvent => CATALOG_TYPES.includes(event.type)
export const isPageEvent = (event: AnyEvent): event is PageEvent => PAGE_TYPES.includes(event.type)

/** The event column of the table: the member's events, and "catalog" for all four catalog events. */
export type TableEvent = MemberEvent["type"] | "catalog"

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
export const episodeLabel = (episode: { season: number; number: number }) => (isSpecial(episode) ? `Special ${episode.number}` : `S${episode.season} E${episode.number}`)
const inOrder = (a: Episode, b: Episode) => a.season - b.season || a.number - b.number

/** A: the aired regular episodes, in order. */
export const airedRegular = (show: Show) => show.episodes.filter((e) => !isSpecial(e) && e.aired).sort(inOrder)

/**
 * The listed episode a watch counts for. By id; and when TMDB removed the episode and added it again under a new
 * id, by season and number, as long as exactly one listed episode has them.
 */
export function countedEpisode(show: Show, watch: Watch): Episode | null {
	const byId = show.episodes.find((e) => e.id === watch.episodeId)
	if (byId) return byId
	const same = show.episodes.filter((e) => e.season === watch.season && e.number === watch.number)
	return same.length === 1 ? same[0] : null
}

/** The ids of the listed episodes watched in one pass. */
export function watchedIds(show: Show, member: Member, pass = member.pass): Set<string> {
	const ids = new Set<string>()
	for (const watch of member.watches) {
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

export function facts(show: Show, member: Member): Facts {
	const aired = airedRegular(show)
	const ids = watchedIds(show, member)
	const watched = aired.filter((e) => ids.has(e.id)).length
	return {
		aired: aired.length,
		watched,
		upToDate: aired.length > 0 && watched === aired.length,
		watchRemains: member.watches.some((w) => !isSpecial(w)),
	}
}

// ---------------------------------------------------------------------------------------------------------
// Guards. A guard is checked AFTER the event did its work on the watches.
// ---------------------------------------------------------------------------------------------------------

interface GuardInput {
	/** The member before the event. */
	before: Member
	facts: Facts
	factsBefore: Facts
	/** The episode of a watch or unwatch. */
	episode: Episode | null
}

export const GUARDS = {
	special: { says: "the episode is a special", test: (g: GuardInput) => !!g.episode && isSpecial(g.episode) },
	upToDate: { says: "every aired episode is now watched", test: (g: GuardInput) => g.facts.upToDate },
	notUpToDate: { says: "aired episodes are still unwatched", test: (g: GuardInput) => !g.facts.upToDate },
	watchRemains: { says: "a watch remains", test: (g: GuardInput) => g.facts.watchRemains },
	noWatchRemains: { says: "no watch remains", test: (g: GuardInput) => !g.facts.watchRemains },
	newEpisodes: { says: "episodes aired since", test: (g: GuardInput) => g.factsBefore.watched < g.factsBefore.aired },
	pressedFromSeen: { says: "the press was made on a Seen show", test: (g: GuardInput) => g.before.seenPress?.from === "seen" },
	noWatchPressedOnHold: { says: "no watch remains, pressed from On hold", test: (g: GuardInput) => !g.facts.watchRemains && g.before.seenPress?.from === "on_hold" },
	noWatchPressedDropped: { says: "no watch remains, pressed from Dropped", test: (g: GuardInput) => !g.facts.watchRemains && g.before.seenPress?.from === "dropped" },
} as const
export type Guard = keyof typeof GUARDS

// ---------------------------------------------------------------------------------------------------------
// THE TRANSITION TABLE. This is the specification. Rows are tried from the top; the first that matches is taken.
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
	/** The row exists only under this option of an open decision. */
	only?: { decision: keyof Settings; option: string }
}

const ANY = STATES
const BEFORE_SEEN: readonly State[] = ["not_started", "watching", "on_hold", "dropped"]

export const TABLE: readonly Row[] = [
	// watch
	{ id: "1", from: ANY, event: "watch", guard: "special", to: "same", says: "A special is recorded and changes nothing else." },
	{ id: "2", from: BEFORE_SEEN, event: "watch", guard: "upToDate", to: "seen", says: "That was the last aired episode: the show is Seen." },
	{ id: "3", from: BEFORE_SEEN, event: "watch", guard: "notUpToDate", to: "watching", says: "An episode is watched and more are left: Watching. This also ends On hold and Dropped." },
	{ id: "4", from: ["seen"], event: "watch", guard: "upToDate", to: "same", says: "New episodes had aired and now all of them are watched: still Seen." },
	{ id: "5", from: ["seen"], event: "watch", guard: "notUpToDate", to: "watching", says: "New episodes had aired and only some are watched: back to Watching." },
	// unwatch
	{ id: "6", from: ANY, event: "unwatch", guard: "special", to: "same", says: "Unticking a special changes nothing else." },
	{ id: "7", from: ["watching", "seen"], event: "unwatch", guard: "watchRemains", to: "watching", says: "An episode is unticked and others stay: Watching." },
	{ id: "8", from: ["watching", "seen"], event: "unwatch", guard: "noWatchRemains", to: "not_started", says: "The only watched episode is unticked: Not started." },
	{ id: "9", from: ["on_hold", "dropped"], event: "unwatch", guard: "watchRemains", to: "same", says: "Unticking an episode leaves On hold and Dropped alone." },
	{ id: "10", from: ["on_hold", "dropped"], event: "unwatch", guard: "noWatchRemains", to: "same", says: "On hold and Dropped were chosen, so they stay with nothing watched.", only: { decision: "m2", option: "keep" } },
	{ id: "10b", from: ["on_hold", "dropped"], event: "unwatch", guard: "noWatchRemains", to: "not_started", says: "Nothing watched means Not started, also from On hold and Dropped.", only: { decision: "m2", option: "not_started" } },
	// Seen, and Seen again
	{ id: "11", from: BEFORE_SEEN, event: "pressSeen", guard: null, to: "seen", says: "Seen marks every aired episode not yet watched, as one group without dates." },
	{ id: "12", from: ["seen"], event: "pressSeen", guard: "newEpisodes", to: "same", says: "On a Seen show with new episodes, Seen marks the new ones as a group of their own." },
	{ id: "13", from: ["seen"], event: "undoSeen", guard: "pressedFromSeen", to: "same", says: "The press only added new episodes; taking it back leaves the show Seen with them new again." },
	{ id: "14", from: ["seen"], event: "undoSeen", guard: "watchRemains", to: "watching", says: "The press is taken back and episodes ticked before it stay: Watching." },
	{ id: "15", from: ["seen"], event: "undoSeen", guard: "noWatchPressedOnHold", to: "on_hold", says: "The press is taken back and nothing was ticked before it: On hold, as before." },
	{ id: "16", from: ["seen"], event: "undoSeen", guard: "noWatchPressedDropped", to: "dropped", says: "The press is taken back and nothing was ticked before it: Dropped, as before." },
	{ id: "17", from: ["seen"], event: "undoSeen", guard: "noWatchRemains", to: "not_started", says: "The press is taken back and nothing else was watched: Not started." },
	// On hold, Dropped, Resume
	{ id: "18", from: ["watching"], event: "hold", guard: null, to: "on_hold", says: "Set aside, may return." },
	{ id: "19", from: ["not_started", "watching", "on_hold"], event: "drop", guard: null, to: "dropped", says: "Given up on. Clears Want to See; always hidden from recommendations." },
	{ id: "20", from: ["on_hold", "dropped"], event: "resume", guard: "watchRemains", to: "watching", says: "Back to it: Watching." },
	{ id: "21", from: ["on_hold", "dropped"], event: "resume", guard: "noWatchRemains", to: "not_started", says: "Back to it with nothing watched: Not started." },
	// Things that are not a status
	{ id: "22", from: ANY, event: "rate", guard: null, to: "same", says: "A score never changes the state. A scored show still counts as Seen for Not seen yet." },
	{ id: "23", from: ["not_started"], event: "wantToSee", guard: null, to: "same", says: "On or off the Wishlist. Not a state." },
	{ id: "24", from: ["dropped"], event: "wantToSee", guard: "noWatchRemains", to: "not_started", says: "Want to See clears Dropped. Offered only with nothing watched; otherwise Resume is the way back." },
	{ id: "25", from: ["not_started"], event: "notInterested", guard: null, to: "same", says: "Hidden from recommendations. Not a state; offered only before the first watch." },
	{ id: "26", from: ["seen"], event: "watchAgain", guard: null, to: "watching", says: "A new pass starts. Progress and the next episode count only its watches. Not built yet.", only: { decision: "m4", option: "built" } },
	// The catalog
	{ id: "27b", from: ["seen"], event: "catalog", guard: "newEpisodes", to: "watching", says: "The only transition nobody makes: a Seen show with new episodes returns to Watching by itself.", only: { decision: "m6", option: "returns" } },
	{ id: "27", from: ANY, event: "catalog", guard: null, to: "same", says: "An episode airs, a season starts, the show ends, TMDB re-adds an episode: never a transition." },
]

export const rowIsActive = (row: Row, settings: Settings) => !row.only || settings[row.only.decision] === row.only.option

// ---------------------------------------------------------------------------------------------------------
// What an event does to the record, before the table is read
// ---------------------------------------------------------------------------------------------------------

export const findEpisode = (show: Show, season: number, number: number) => show.episodes.find((e) => e.season === season && e.number === number) ?? null

function effect(show: Show, member: Member, event: MemberEvent): Member {
	switch (event.type) {
		case "watch": {
			const episode = findEpisode(show, event.season, event.number)
			if (!episode) return member
			const watch: Watch = { episodeId: episode.id, season: episode.season, number: episode.number, origin: "hand", group: null, pass: member.pass }
			// A special is only its own mark.
			if (isSpecial(episode)) return { ...member, watches: [...member.watches, watch] }
			return { ...member, watches: [...member.watches, watch], wantToSee: false, notInterested: false, seenQuestion: member.seenQuestion === "open" ? "answered" : member.seenQuestion }
		}
		case "unwatch": {
			const episode = findEpisode(show, event.season, event.number)
			if (!episode) return member
			return { ...member, watches: member.watches.filter((w) => !(w.pass === member.pass && countedEpisode(show, w)?.id === episode.id)) }
		}
		case "pressSeen": {
			const group = `seen-${member.presses + 1}`
			const have = watchedIds(show, member)
			const made: Watch[] = airedRegular(show)
				.filter((e) => !have.has(e.id))
				.map((e) => ({ episodeId: e.id, season: e.season, number: e.number, origin: "bulk", group, pass: member.pass }))
			return {
				...member,
				watches: [...member.watches, ...made],
				presses: member.presses + 1,
				seenPress: { group, from: member.state },
				wantToSee: false,
				notInterested: false,
				seenQuestion: member.seenQuestion === "open" ? "answered" : member.seenQuestion,
			}
		}
		case "undoSeen":
			return { ...member, watches: member.watches.filter((w) => w.group !== member.seenPress?.group), seenPress: null }
		case "drop":
			return { ...member, wantToSee: false, notInterested: false }
		case "rate":
			return { ...member, score: event.score, notInterested: event.score === null ? member.notInterested : false }
		case "wantToSee":
			return { ...member, wantToSee: !member.wantToSee, notInterested: false }
		case "notInterested":
			return { ...member, notInterested: !member.notInterested, wantToSee: false }
		case "watchAgain":
			return { ...member, pass: member.pass + 1 }
		default:
			return member
	}
}

// ---------------------------------------------------------------------------------------------------------
// Why an event is not possible, in member words
// ---------------------------------------------------------------------------------------------------------

function whyNot(world: World, event: MemberEvent, settings: Settings): string | null {
	const { show, member } = world
	const state = member.state
	switch (event.type) {
		case "watch": {
			const episode = findEpisode(show, event.season, event.number)
			if (!episode) return "The show lists no such episode."
			if (!episode.aired) return "It has not aired yet."
			if (watchedIds(show, member).has(episode.id)) return "Already watched in this pass."
			return null
		}
		case "unwatch": {
			const episode = findEpisode(show, event.season, event.number)
			if (!episode || !watchedIds(show, member).has(episode.id)) return "Not watched in this pass."
			return null
		}
		case "pressSeen":
			if (state !== "seen") return null
			if (facts(show, member).watched < airedRegular(show).length) return null
			return member.seenPress ? "Pressing Seen again takes the press back." : "It is Seen because every aired episode is ticked. Untick one to change that."
		case "undoSeen":
			return state === "seen" && member.seenPress ? null : "There is no Seen press to take back."
		case "hold":
			if (state === "watching") return null
			return { not_started: "Nothing is watched yet, so there is nothing to put on hold.", on_hold: "It is on hold already.", dropped: "It is dropped. Resume it first.", seen: "On hold is for a show you are in the middle of." }[state]
		case "drop":
			if (state === "dropped") return "It is dropped already."
			if (state === "seen") return "A show you have seen can't be dropped."
			return null
		case "resume":
			return state === "on_hold" || state === "dropped" ? null : "Only a show that is on hold or dropped can be resumed."
		case "wantToSee":
			if (state === "not_started") return null
			if (state === "dropped") return facts(show, member).watchRemains ? "You have started it. Resume brings it back to Watching." : null
			return state === "seen" ? "You have seen it." : "You have started it, so it lives under Watching and not in the Wishlist."
		case "notInterested":
			if (state === "not_started") return null
			if (state === "dropped") return "Dropped hides it from recommendations already."
			return state === "seen" ? "You have seen it." : "Once an episode is watched, Drop takes its place."
		case "watchAgain":
			if (settings.m4 !== "built") return "Drawn in the machine, not built yet (decision M4)."
			return state === "seen" ? null : "Only a show you have seen can be watched again."
		default:
			return null
	}
}

// ---------------------------------------------------------------------------------------------------------
// The catalog's own changes
// ---------------------------------------------------------------------------------------------------------

function catalog(world: World, event: CatalogEvent): { show: Show; refused: string | null } {
	const show = world.show
	const regular = show.episodes.filter((e) => !isSpecial(e)).sort(inOrder)
	const add = (season: number, number: number, at: number): Episode => ({ id: `${show.key}-new${at}`, season, number, aired: true })
	switch (event.type) {
		case "episodeAirs": {
			const waiting = regular.find((e) => !e.aired)
			if (waiting) return { show: { ...show, episodes: show.episodes.map((e) => (e.id === waiting.id ? { ...e, aired: true } : e)) }, refused: null }
			if (!regular.length) return { show, refused: "The show has no episode list, so no single episode can air. Try a new season." }
			if (!show.running) return { show, refused: "The show has ended and lists no further episode." }
			const last = regular[regular.length - 1]
			return { show: { ...show, made: show.made + 1, episodes: [...show.episodes, add(last.season, last.number + 1, show.made + 1)] }, refused: null }
		}
		case "seasonAirs": {
			const season = (regular.length ? regular[regular.length - 1].season : 0) + 1
			const episodes = [1, 2, 3].map((number, index) => add(season, number, show.made + 1 + index))
			return { show: { ...show, running: true, made: show.made + 3, episodes: [...show.episodes, ...episodes] }, refused: null }
		}
		case "showEnds":
			if (!show.running) return { show, refused: "TMDB lists the show as ended already." }
			return { show: { ...show, running: false }, refused: null }
		case "episodeReadded": {
			const aired = airedRegular(show)
			if (!aired.length) return { show, refused: "The show has no aired episode to remove and add again." }
			const ids = watchedIds(show, world.member)
			// The furthest watched episode shows the most; with nothing watched, the first.
			const target = [...aired].reverse().find((e) => ids.has(e.id)) ?? aired[0]
			const id = `${show.key}-readded${show.made + 1}`
			return { show: { ...show, made: show.made + 1, episodes: show.episodes.map((e) => (e.id === target.id ? { ...e, id } : e)) }, refused: null }
		}
	}
}

// ---------------------------------------------------------------------------------------------------------
// The interpreter
// ---------------------------------------------------------------------------------------------------------

export interface Step {
	world: World
	event: AnyEvent
	kind: "member" | "catalog" | "page"
	/** The row that was used; null when the event was refused or answered a prompt. */
	row: Row | null
	from: State
	to: State
	/** Why nothing happened. */
	refused: string | null
	/** What happened, in member words. */
	message: string
}

export function step(world: World, event: AnyEvent, settings: Settings = RECOMMENDED): Step {
	const from = world.member.state
	const nothing = (refused: string): Step => ({ world, event, kind: isCatalogEvent(event) ? "catalog" : isPageEvent(event) ? "page" : "member", row: null, from, to: from, refused, message: refused })

	if (isPageEvent(event)) {
		const member: Member = event.type === "dismissRatePrompt" ? { ...world.member, ratePromptDismissed: true } : { ...world.member, seenQuestion: "answered" }
		const message =
			event.type === "dismissRatePrompt"
				? "Not now: the prompt to rate will not come back for this show. No state changed."
				: event.answer === "partway"
					? "Partway: the episode list opens. Nothing changes until an episode is ticked."
					: "Just rating: nothing else changes."
		return { world: { ...world, member }, event, kind: "page", row: null, from, to: from, refused: null, message }
	}

	if (isCatalogEvent(event)) {
		const changed = catalog(world, event)
		if (changed.refused) return nothing(changed.refused)
		const factsBefore = facts(changed.show, world.member)
		const input: GuardInput = { before: world.member, facts: factsBefore, factsBefore, episode: null }
		const row = findRow(from, "catalog", input, settings)
		if (!row) return nothing("No row.")
		const to = row.to === "same" ? from : row.to
		const member = to === from ? world.member : { ...world.member, state: to, seenPress: null }
		const next: World = { show: changed.show, member }
		return { world: next, event, kind: "catalog", row, from, to, refused: null, message: catalogMessage(world, next, settings) }
	}

	const refused = whyNot(world, event, settings)
	if (refused) return nothing(refused)
	const episode = event.type === "watch" || event.type === "unwatch" ? findEpisode(world.show, event.season, event.number) : null
	const after = effect(world.show, world.member, event)
	const input: GuardInput = { before: world.member, facts: facts(world.show, after), factsBefore: facts(world.show, world.member), episode }
	const row = findRow(from, event.type, input, settings)
	if (!row) return nothing(`No row: "${EVENT_LABEL[event.type]}" is not possible from ${STATE_LABEL[from]}.`)
	const to = row.to === "same" ? from : row.to
	let member: Member = { ...after, state: to }
	// A press can be taken back only while the show is still Seen.
	if (to !== "seen") member = { ...member, seenPress: null }
	if (event.type === "rate" && event.score !== null && from === "not_started" && member.seenQuestion === "not_asked" && settings.m5 !== "never") member = { ...member, seenQuestion: "open" }
	const moved = to === from ? `Stays ${STATE_LABEL[from]}.` : `${STATE_LABEL[from]} → ${STATE_LABEL[to]}.`
	return { world: { ...world, member }, event, kind: "member", row, from, to, refused: null, message: `${moved} ${row.says}` }
}

function findRow(from: State, event: TableEvent, input: GuardInput, settings: Settings): Row | null {
	return TABLE.find((row) => row.event === event && row.from.includes(from) && rowIsActive(row, settings) && (!row.guard || GUARDS[row.guard].test(input))) ?? null
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
	hiddenByNotSeenYetWhy: string
	hiddenFromRecommendations: boolean
	hiddenFromRecommendationsWhy: string
	/** Which of Not interested and Drop the page offers. */
	offers: ("notInterested" | "drop")[]
	ratePrompt: boolean
	seenQuestion: boolean
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

/**
 * The first aired regular episode after the furthest one watched in the current pass that is not watched in this
 * pass; with nothing after it, the earliest one not watched in this pass.
 */
export function nextEpisode(show: Show, member: Member): Episode | null {
	const aired = airedRegular(show)
	const ids = watchedIds(show, member)
	let furthest = -1
	aired.forEach((e, index) => {
		if (ids.has(e.id)) furthest = index
	})
	return aired.find((e, index) => index > furthest && !ids.has(e.id)) ?? aired.find((e) => !ids.has(e.id)) ?? null
}

export function derive(world: World, settings: Settings = RECOMMENDED): Derived {
	const { show, member } = world
	const f = facts(show, member)
	const state = member.state
	const newEpisodes = state === "seen" ? f.aired - f.watched : 0
	let label = STATE_LABEL[state]
	if (state === "seen") {
		const caughtUp = show.running && settings.m1 === "caught_up"
		label = caughtUp ? "Caught up" : "Seen"
		if (newEpisodes > 0) label += caughtUp ? ` · ${newEpisodes} new` : ` · ${plural(newEpisodes, "new episode")}`
	}
	const hasNext = state === "watching" || state === "on_hold" || newEpisodes > 0
	const rated = member.score !== null
	const countsAsSeen = state === "seen" || rated
	const hasStatus = state === "watching" || state === "on_hold" || state === "dropped"
	const regularWatches = new Set(member.watches.filter((w) => !isSpecial(w)).map((w) => `${w.season}.${w.number}`)).size
	const offers: Derived["offers"] = state === "not_started" ? (settings.m3 === "both" ? ["notInterested", "drop"] : ["notInterested"]) : state === "watching" || state === "on_hold" ? ["drop"] : []
	return {
		state,
		label,
		running: show.running,
		pass: member.pass,
		watched: f.watched,
		aired: f.aired,
		newEpisodes,
		next: hasNext ? nextEpisode(show, member) : null,
		countsAsSeen,
		hiddenByNotSeenYet: countsAsSeen || hasStatus,
		hiddenByNotSeenYetWhy: state === "seen" ? "it is Seen" : hasStatus ? `it is ${STATE_LABEL[state]}` : rated ? "it has a score, and a scored show counts as Seen" : "it is not started and has no score",
		hiddenFromRecommendations: state === "dropped" || member.notInterested,
		hiddenFromRecommendationsWhy: state === "dropped" ? "it is Dropped" : member.notInterested ? "it is marked Not interested" : "only Dropped and Not interested hide a show there",
		offers,
		ratePrompt: !rated && !member.ratePromptDismissed && (regularWatches >= 3 || member.seenPress !== null),
		seenQuestion: member.seenQuestion === "open",
	}
}

/** What a catalog change did, said the way the page says it every time. */
function catalogMessage(before: World, after: World, settings: Settings): string {
	const was = derive(before, settings)
	const now = derive(after, settings)
	if (was.state !== now.state) return `Your state changed with nobody acting: ${STATE_LABEL[was.state]} → ${STATE_LABEL[now.state]}.`
	const parts: string[] = []
	const moreNew = now.newEpisodes > was.newEpisodes
	if (moreNew) parts.push(`You now have ${plural(now.newEpisodes, "new episode")}.`)
	else if (was.label !== now.label) parts.push(`The label now reads "${now.label}".`)
	if (!moreNew && (was.watched !== now.watched || was.aired !== now.aired)) parts.push(`Progress now reads ${now.watched} of ${now.aired}.`)
	const nextWas = was.next ? episodeLabel(was.next) : ""
	const nextNow = now.next ? episodeLabel(now.next) : ""
	if (nextNow && nextNow !== nextWas) parts.push(`Next episode: ${nextNow}.`)
	const readded = after.show.episodes.find((e) => !before.show.episodes.some((old) => old.id === e.id) && before.show.episodes.some((old) => old.season === e.season && old.number === e.number))
	if (readded)
		parts.push(
			watchedIds(after.show, after.member).has(readded.id)
				? `${episodeLabel(readded)} came back under a new id, and your watch still counts for it by season and number.`
				: `${episodeLabel(readded)} came back under a new id. You had not watched it.`,
		)
	return `Nothing changed your state. ${parts.length ? parts.join(" ") : "Nothing you read changed either."}`
}

// ---------------------------------------------------------------------------------------------------------
// What the page offers
// ---------------------------------------------------------------------------------------------------------

export interface Offer {
	ok: boolean
	/** Why not, or a remark on what it will do. */
	why: string
}

/** Whether the page offers an event now. The machine accepts a little more: an import can drop a never-started show. */
export function offer(world: World, event: MemberEvent | CatalogEvent, settings: Settings = RECOMMENDED): Offer {
	if (event.type === "drop" && world.member.state === "not_started" && settings.m3 !== "both")
		return { ok: false, why: "With nothing watched the page offers Not interested instead (decision M3). An import can still bring Dropped." }
	const tried = step(world, event, settings)
	return { ok: !tried.refused, why: tried.refused ?? "" }
}

/** The Seen button is one button: it presses, or it takes the press back. */
export function seenButton(world: World, settings: Settings = RECOMMENDED): { event: MemberEvent | null; label: string; why: string } {
	const { show, member } = world
	if (member.state !== "seen") return { event: { type: "pressSeen" }, label: "Seen", why: "" }
	const fresh = airedRegular(show).length - facts(show, member).watched
	if (fresh > 0) return { event: { type: "pressSeen" }, label: `Seen · mark ${fresh} new`, why: "" }
	if (member.seenPress) return { event: { type: "undoSeen" }, label: "Seen ✓ (press to take back)", why: "" }
	return { event: null, label: "Seen ✓", why: step(world, { type: "pressSeen" }, settings).refused ?? "" }
}

/** An event in member words, for the log. */
export function eventLabel(event: AnyEvent): string {
	switch (event.type) {
		case "watch":
			return `Tick ${episodeLabel(event)}`
		case "unwatch":
			return `Untick ${episodeLabel(event)}`
		case "pressSeen":
			return "Press Seen"
		case "undoSeen":
			return "Press Seen again"
		case "hold":
			return "Put on hold"
		case "drop":
			return "Drop"
		case "resume":
			return "Resume"
		case "rate":
			return event.score === null ? "Remove the score" : `Rate ${event.score}`
		case "wantToSee":
			return "Want to See"
		case "notInterested":
			return "Not interested"
		case "watchAgain":
			return "Watch again"
		case "episodeAirs":
			return "World: the next episode airs"
		case "seasonAirs":
			return "World: a new season airs"
		case "showEnds":
			return "World: the show ends"
		case "episodeReadded":
			return "World: TMDB re-adds an episode"
		case "dismissRatePrompt":
			return "Rate prompt: Not now"
		case "answerSeenQuestion":
			return event.answer === "partway" ? "Seen it all? I'm partway" : "Seen it all? Just rating"
	}
}

/** Plays events from a fresh member. The page keeps events, not results, so a flipped switch replays them. */
export function play(show: Show, events: readonly AnyEvent[], settings: Settings = RECOMMENDED): { world: World; steps: Step[] } {
	let world: World = { show, member: newMember() }
	const steps: Step[] = []
	for (const event of events) {
		const done = step(world, event, settings)
		steps.push(done)
		world = done.world
	}
	return { world, steps }
}

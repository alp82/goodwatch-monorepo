// PROTOTYPE - throwaway (#369). The episode list's state and rules, in the browser only. Nothing here is the real
// watch model; it follows the settled rules of map #365 closely enough to look at them.
import type { EpisodeGrid } from "~/server/episode-grid.server"

export interface Ep {
	id: number
	n: number
	name: string
	overview: string
	air_date: string | null
	runtime: number | null
	still_path: string | null
	type: string | null
	vote_average: number
	vote_count: number
}
export interface Season {
	number: number
	name: string
	episodes: Ep[]
}
export interface Show {
	id: number
	name: string
	year: string
	status: string
	poster_path: string | null
	backdrop_path: string | null
	tagline: string
	fetched: string
	seasons: Season[]
}

/** How exact a watch's date is (ADR 0008): a moment, a day, or unknown. */
export type When = { kind: "moment"; at: string } | { kind: "day"; day: string } | { kind: "unknown" }
/** How a watch was made: by hand, or in bulk by a season mark, "watched up to here", or the Seen button. */
export type Origin = "hand" | "season" | "upto" | "seen"
export interface Watch {
	when: When
	origin: Origin
}
export type Status = "watching" | "on_hold" | "dropped" | null

export interface State {
	watches: Record<number, Watch>
	status: Status
	/** Seen by the Seen button or by watching through. A score makes the show Seen on its own. */
	seenMarked: boolean
	want: boolean
	hidden: boolean
	score: number | null
	rateDismissed: boolean
	log: string[]
}

export const EMPTY: State = { watches: {}, status: null, seenMarked: false, want: false, hidden: false, score: null, rateDismissed: false, log: [] }

export const STATUS_LABEL = { watching: "Watching", on_hold: "On hold", dropped: "Dropped" } as const

export const isAired = (e: Ep, today: string) => !!e.air_date && e.air_date <= today
export const regularSeasons = (show: Show) => show.seasons.filter((s) => s.number > 0)
export const specialsOf = (show: Show) => show.seasons.find((s) => s.number === 0) ?? null
export const seasonOf = (show: Show, ep: Ep) => show.seasons.find((s) => s.episodes.includes(ep))?.number ?? 0
export const epCode = (show: Show, ep: Ep) => {
	const s = seasonOf(show, ep)
	return s === 0 ? `Special ${ep.n}` : `S${s} E${ep.n}`
}

export function derive(show: Show, st: State, today: string) {
	const all = regularSeasons(show).flatMap((s) => s.episodes)
	const aired = all.filter((e) => isAired(e, today))
	const watched = aired.filter((e) => st.watches[e.id])
	const ended = show.status === "Ended" || show.status === "Canceled"
	const through = aired.length > 0 && watched.length === aired.length
	const airing = all.some((e) => (e.air_date ? e.air_date > today : !ended))
	const specials = specialsOf(show)?.episodes ?? []
	return {
		aired,
		watched,
		unaired: all.length - aired.length,
		/** Next episode: the earliest aired regular episode the person has not watched. */
		next: aired.find((e) => !st.watches[e.id]) ?? null,
		upcoming: all.find((e) => e.air_date && e.air_date > today) ?? null,
		airing,
		through,
		caughtUp: through && airing,
		seen: st.seenMarked || st.score != null,
		/** A Seen show whose later episodes have aired. */
		newEpisodes: st.seenMarked && !through ? aired.length - watched.length : 0,
		started: watched.length > 0,
		specialsWatched: specials.filter((e) => st.watches[e.id]).length,
		ratePrompt: through && !airing && st.score == null && !st.rateDismissed,
	}
}
export type Derived = ReturnType<typeof derive>

export function seasonProgress(season: Season, st: State, today: string) {
	const aired = season.episodes.filter((e) => isAired(e, today))
	return { total: season.episodes.length, aired: aired.length, watched: aired.filter((e) => st.watches[e.id]).length }
}

/** The aired regular episodes up to and including `ep` that are not watched yet. */
export function unwatchedUpTo(show: Show, st: State, today: string, ep: Ep) {
	const all = regularSeasons(show).flatMap((s) => s.episodes)
	return all.slice(0, all.indexOf(ep) + 1).filter((e) => isAired(e, today) && !st.watches[e.id])
}

const log = (st: State, line: string): State => ({ ...st, log: [line, ...st.log].slice(0, 8) })

/** Brings status, Want to See, Not interested and Seen in step after watches were added or removed. */
function settle(show: Show, prev: State, next: State, today: string): State {
	const before = derive(show, prev, today)
	const after = derive(show, next, today)
	const s = { ...next }
	if (after.watched.length > before.watched.length) {
		s.want = false
		s.hidden = false
		// The first watched episode sets Watching; an episode of an On hold or Dropped show returns it to Watching.
		if (!s.seenMarked) s.status = "watching"
		// Watched through with no season still airing: Seen. Caught up mid-season stays Watching.
		if (after.through && !after.airing) {
			s.seenMarked = true
			s.status = null
		}
	} else if (after.watched.length < before.watched.length) {
		if (s.seenMarked && !after.through) s.seenMarked = false
		if (after.watched.length === 0) s.status = s.status === "dropped" ? "dropped" : null
		else if (!s.seenMarked && s.status === null) s.status = "watching"
	}
	return s
}

export function mark(show: Show, st: State, today: string, eps: Ep[], when: When, origin: Origin, line: string): State {
	const watches = { ...st.watches }
	for (const e of eps) if (isAired(e, today) && !watches[e.id]) watches[e.id] = { when, origin }
	return log(settle(show, st, { ...st, watches }, today), line)
}

export function unmark(show: Show, st: State, today: string, eps: Ep[], line: string): State {
	const watches = { ...st.watches }
	for (const e of eps) delete watches[e.id]
	return log(settle(show, st, { ...st, watches }, today), line)
}

export function redate(st: State, eps: Ep[], when: When, line: string): State {
	const watches = { ...st.watches }
	for (const e of eps) if (watches[e.id]) watches[e.id] = { ...watches[e.id], when }
	return log({ ...st, watches }, line)
}

/**
 * Seen on: every aired regular episode not yet watched becomes a bulk watch, date unknown.
 * Seen off: only bulk watches go. `allBulk` removes season and "up to here" marks too (ADR 0008 as written);
 * without it only the watches the Seen button made go.
 */
export function toggleSeen(show: Show, st: State, today: string, allBulk: boolean): State {
	const d = derive(show, st, today)
	if (!st.seenMarked) {
		const marked = mark(show, st, today, d.aired, { kind: "unknown" }, "seen", "")
		const added = Object.keys(marked.watches).length - Object.keys(st.watches).length
		return log({ ...marked, log: st.log, seenMarked: true, status: null, want: false, hidden: false }, `Seen: ${added} bulk watches, date unknown`)
	}
	const watches: Record<number, Watch> = {}
	let removed = 0
	for (const [id, w] of Object.entries(st.watches)) {
		if (w.origin === "seen" || (allBulk && w.origin !== "hand")) removed++
		else watches[Number(id)] = w
	}
	const next: State = { ...st, watches, seenMarked: false, status: null }
	const after = derive(show, next, today)
	if (after.through && !after.airing) next.seenMarked = true
	else if (after.started) next.status = "watching"
	return log(next, `Seen removed: ${removed} bulk watches removed, ${Object.keys(watches).length} kept`)
}

export function setStatus(show: Show, st: State, today: string, status: Status): State {
	const started = derive(show, st, today).started
	const s: State = { ...st, status: status ?? (started ? "watching" : null) }
	if (status === "dropped") {
		s.want = false
		s.hidden = false
	}
	return log(s, `Status: ${s.status ? STATUS_LABEL[s.status] : "none"}`)
}

export function toggleWant(show: Show, st: State, today: string): State {
	if (st.want) return log({ ...st, want: false }, "Want to See removed")
	const started = derive(show, st, today).started
	// Adding Want to See clears Not interested and Dropped.
	return log({ ...st, want: true, hidden: false, status: st.status === "dropped" ? (started ? "watching" : null) : st.status }, "Want to See")
}

export const toggleHidden = (st: State): State =>
	log({ ...st, hidden: !st.hidden, want: st.hidden ? st.want : false }, st.hidden ? "Not interested removed" : "Not interested")

/** A rating makes the show Seen and marks no episodes. */
export const rate = (st: State, score: number | null): State =>
	log({ ...st, score, hidden: score == null ? st.hidden : false }, score == null ? "Score cleared" : `Scored ${score}: Seen, no episodes marked`)

// ---- scenarios ---------------------------------------------------------------------------

export const SCENARIOS = {
	fresh: "Nothing yet",
	watching: "Watching, partway",
	on_hold: "On hold",
	dropped: "Dropped after 3",
	all: "All aired watched",
	seen_new: "Seen, new episodes since",
} as const
export type Scenario = keyof typeof SCENARIOS

const daysAgo = (today: string, n: number) => new Date(Date.parse(today) - n * 864e5).toISOString().slice(0, 10)

export function scenario(show: Show, today: string, name: Scenario): State {
	const seasons = regularSeasons(show)
	const aired = seasons.flatMap((s) => s.episodes).filter((e) => isAired(e, today))
	let st: State = EMPTY
	if (name === "fresh") return st
	if (name === "dropped") {
		st = mark(show, st, today, aired.slice(0, 3), { kind: "day", day: daysAgo(today, 40) }, "hand", "")
		return { ...st, status: "dropped", log: ["Scenario: dropped after 3 episodes"] }
	}
	if (name === "all") {
		const earlier = aired.slice(0, -1)
		st = mark(show, st, today, earlier, { kind: "unknown" }, "season", "")
		// The last one stays open so the owner can press it and see what watching through does.
		return { ...st, log: ["Scenario: every aired episode but the last. Mark it to watch through."] }
	}
	if (name === "seen_new") {
		// Seen was pressed before the latest episodes aired.
		const lastSeason = seasons[seasons.length - 1]
		const late = seasons.length > 1 ? lastSeason.episodes : aired.slice(-2)
		st = mark(show, st, today, aired.filter((e) => !late.includes(e)), { kind: "unknown" }, "seen", "")
		return { ...st, seenMarked: true, status: null, score: 8, log: ["Scenario: Seen and scored 8 before the latest episodes aired"] }
	}
	// watching / on_hold: the first season in bulk, then a few by hand with dates, with a gap after them.
	const first = seasons[0].episodes.filter((e) => isAired(e, today))
	const some = seasons.length > 1 ? first : first.slice(0, Math.max(1, Math.floor(first.length / 2)))
	st = mark(show, st, today, some, { kind: "unknown" }, "season", "")
	const rest = aired.filter((e) => !some.includes(e)).slice(0, seasons.length > 1 ? 4 : 1)
	rest.forEach((e, i) => {
		st = mark(show, st, today, [e], { kind: "day", day: daysAgo(today, (rest.length - i) * 3) }, "hand", "")
	})
	const special = specialsOf(show)?.episodes.find((e) => isAired(e, today))
	if (special) st = mark(show, st, today, [special], { kind: "day", day: daysAgo(today, 20) }, "hand", "")
	return { ...st, status: name === "on_hold" ? "on_hold" : "watching", log: [`Scenario: ${SCENARIOS[name]}`] }
}

// ---- words -------------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export const fmtDay = (day: string, today?: string) => {
	if (today && day === today) return "today"
	const [y, m, d] = day.split("-").map(Number)
	return `${MONTHS[m - 1]} ${d}, ${y}`
}
export const fmtWhen = (when: When, today: string) => {
	if (when.kind === "unknown") return "date unknown"
	if (when.kind === "day") return fmtDay(when.day, today)
	const at = new Date(when.at)
	const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`
	return `${fmtDay(day, today)}, ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`
}
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// ---- the episode grid's stand-in ---------------------------------------------------------

/**
 * The real grid reads IMDb ratings from the database, which this prototype does not touch. This feeds the real
 * component TMDB's votes from the fixture instead, so the grid sits on the page at its real size.
 */
export function standInGrid(show: Show): EpisodeGrid {
	const none = { imdb: null, tmdb: null, tomatometer: null, popcornmeter: null, metascore: null, metacriticUser: null }
	const seasons = regularSeasons(show)
		.map((s) => {
			const episodes = s.episodes.filter((e) => e.vote_count > 0).map((e) => ({ number: e.n, name: e.name, score: e.vote_average, votes: e.vote_count * 60 }))
			const mean = episodes.reduce((sum, e) => sum + e.score, 0) / (episodes.length || 1)
			return {
				number: s.number,
				episodes,
				maxEpisodeNumber: Math.max(0, ...episodes.map((e) => e.number)),
				scores: { ...none, imdb: { score: mean, count: episodes.length } },
			}
		})
		.filter((s) => s.episodes.length > 0)
	return {
		showId: show.id,
		seasons,
		specials: [],
		maxEpisodeNumber: Math.max(0, ...seasons.map((s) => s.maxEpisodeNumber)),
		hasEpisodeZero: false,
		providers: ["imdb"],
	}
}

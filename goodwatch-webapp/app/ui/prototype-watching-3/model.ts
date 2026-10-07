// PROTOTYPE - throwaway. What /prototype/watching-3 (#371, round 3) adds to rounds 1 and 2: the Wishlist variants that
// switch to what the member has already watched, the made-up Seen histories of 30 and 1,500 titles, a watch as the
// watch log prototype defines it (day-precise, moment-precise or without a date; imports marked), and the order of the
// shows list. The store and the rules of #365 are round 1's, the picks and the movie list are round 2's, unchanged.
import { type Entry, type Show, type Store, type Title, code } from "~/ui/prototype-watching/model"
import { type Facts, type Fixture2, continueOf, startsOf } from "~/ui/prototype-watching-2/model"
import { seededRandomSin } from "~/utils/random"

export type SeenTitle = Pick<Title, "key" | "type" | "title" | "year" | "poster" | "score">
export type Fixture3 = Fixture2 & { /** Well-known titles a sample member could have Seen. */ pool: SeenTitle[] }

// ---- The pieces

export type Surface = "home" | "shows" | "movies" | "wishlist" | "title"
export const SURFACES: Record<Exclude<Surface, "title">, string> = { home: "Home", shows: "My shows", movies: "My movies", wishlist: "Wishlist" }

export const WISHLISTS = {
	switch: "A · Want to see | Seen",
	diary: "B · Wishlist and a diary",
	library: "C · My library",
	page: "D · Seen as its own page",
} as const
export type WishlistKey = keyof typeof WISHLISTS

/** What the Wishlist area shows. A, B and D know "want" and "seen"; C's chips use all of them. */
export type Side = "want" | "watching" | "onhold" | "dropped" | "seen" | "unrated"
export const SIDES: Record<Side, string> = { want: "Want to see", watching: "Watching", onhold: "On hold", dropped: "Dropped", seen: "Seen", unrated: "Not rated" }

export type SeenSize = "30" | "1500" | "0"
export const SEEN_SIZES: Record<SeenSize, string> = { "30": "30 Seen", "1500": "1,500 Seen (importer)", "0": "Nothing Seen" }

export type Go = (surface: Surface, extra?: Record<string, string>) => void
export type Nav = {
	store: Store
	facts: Record<string, Facts>
	variant: WishlistKey
	surface: Surface
	side: Side
	go: Go
	/** Changes what the Wishlist area shows, without leaving the place on the page. */
	setSide: (side: Side) => void
	seen: SeenItem[]
	/** Opens the bar a score is given in. */
	askRate: (item: SeenItem) => void
	/** The quiet tick at the end of a row of the shows list. */
	tick: boolean
}

/** What the page that holds the Wishlist is called under each variant, by side. */
export function pageName(variant: WishlistKey, side: Side): string {
	if (variant === "library") return "My library"
	if (side === "want") return "Wishlist"
	return variant === "diary" ? "Diary" : "Seen"
}

// ---- A watch, as the watch log prototype shows it

export interface Watch {
	/** Days before today. Null: the date is unknown. */
	days: number | null
	/** "21:40" for a watch recorded at the moment; null for a day-precise one. */
	time: string | null
	origin: "manual" | "import"
	source?: string
}

export interface SeenItem {
	id: string
	t: SeenTitle
	/** The member's score, 1 to 10, or null: Seen and not rated. */
	mine: number | null
	/** Dated watches newest first, then the ones without a date. */
	watches: Watch[]
	/** Days since the latest dated watch, or null when no watch has a date. */
	last: number | null
	/** A tracked show: Seen, or for C's other chips Watching, On hold or Dropped. */
	entry?: Entry
}

const DAY = 86_400_000
export const dateOf = (today: string, days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * DAY)
const DMY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" })

/** "Today, 21:40", "27 Sep 2026", "Date unknown". The time only for a watch that has one. */
export function whenOf(today: string, w: Watch): string {
	if (w.days == null) return "Date unknown"
	const day = w.days === 0 ? "Today" : w.days === 1 ? "Yesterday" : DMY.format(dateOf(today, w.days))
	return w.time ? `${day}, ${w.time}` : day
}
/** The second line of an imported watch. */
export const importLine = (w: Watch) => (w.origin === "import" ? `Imported from ${w.source}` : null)

/** "Watched 3 times, last 27 Sep 2026". */
export function watchesLine(today: string, item: SeenItem): string {
	const n = item.watches.length
	const first = item.watches[0]
	if (!first) return ""
	if (n === 1) return whenOf(today, first)
	return `Watched ${n} times, ${first.days == null ? "dates unknown" : `last ${whenOf(today, first).replace(/, \d\d:\d\d$/, "")}`}`
}

// ---- The made-up Seen histories

const rnd = (i: number, salt: number) => seededRandomSin(i * 12.9898 + salt * 78.233 + 0.5)
const byDate = (a: Watch, b: Watch) => (a.days ?? 9e9) - (b.days ?? 9e9)
const item = (id: string, t: SeenTitle, mine: number | null, watches: Watch[], entry?: Entry): SeenItem => {
	const sorted = [...watches].sort(byDate)
	return { id, t, mine, watches: sorted, last: sorted[0]?.days ?? null, entry }
}
const clock = (i: number) => `${19 + Math.floor(rnd(i, 2) * 4)}:${["00", "10", "25", "40", "55"][Math.floor(rnd(i, 3) * 5)]}`

/**
 * A member who marks what they watch: 30 Seen titles over about two years. The latest are recorded at the moment,
 * older ones on a day, four came with a Letterboxd import and three with an IMDb import that has no dates. Three have
 * a second watch, five have no score.
 */
function small(pool: SeenTitle[]): SeenItem[] {
	const movies = pool.filter((t) => t.type === "movie")
	const shows = pool.filter((t) => t.type === "show")
	if (movies.length < 40 || shows.length < 10) return []
	const out: SeenItem[] = []
	for (let i = 0; i < 30; i++) {
		const t = i % 4 === 3 ? shows[(Math.floor(i / 4) * 9 + 1) % shows.length] : movies[(i * 11 + 3) % movies.length]
		const days = Math.round(1 + i * i * 0.9 + i * 3 + rnd(i, 1) * 3)
		const first: Watch =
			i < 14
				? { days, time: clock(i), origin: "manual" }
				: i < 23
					? { days, time: null, origin: "manual" }
					: i < 27
						? { days, time: null, origin: "import", source: "Letterboxd" }
						: { days: null, time: null, origin: "import", source: "IMDb" }
		const watches = [first]
		if (i === 2 || i === 9) watches.push({ days: days + 380 + i * 40, time: null, origin: "manual" })
		if (i === 5) watches.push({ days: null, time: null, origin: "import", source: "IMDb" })
		const mine = [0, 4, 11, 19, 27].includes(i) ? null : Math.min(10, 5 + Math.floor(rnd(i, 4) * 6))
		out.push(item(t.key, t, mine, watches))
	}
	return out
}

/**
 * An importer: 1,500 Seen titles. About 38 in 100 came from an IMDb ratings import and have no date, about half from
 * Letterboxd or Trakt with a day, the rest were marked here. About 14 in 100 have no score, 7 in 100 a second watch.
 * The pool holds about 500 titles, so each appears three times; the size is what this member is for.
 */
function large(pool: SeenTitle[]): SeenItem[] {
	const n = pool.length
	if (!n) return []
	const out: SeenItem[] = []
	for (let i = 0; i < 1500; i++) {
		const round = Math.floor(i / n)
		const t = pool[(i * 7919 + round * 131) % n]
		const p = rnd(i, 1)
		let first: Watch
		if (p < 0.38) first = { days: null, time: null, origin: "import", source: "IMDb" }
		else if (p < 0.9) first = { days: 30 + Math.floor(rnd(i, 2) ** 1.5 * 4400), time: null, origin: "import", source: rnd(i, 6) < 0.6 ? "Letterboxd" : "Trakt" }
		else {
			const days = Math.floor(rnd(i, 2) ** 2 * 700)
			first = { days, time: days < 400 ? clock(i) : null, origin: "manual" }
		}
		const watches = [first]
		if (rnd(i, 5) < 0.07) watches.push({ days: (first.days ?? 600) + 200 + Math.floor(rnd(i, 7) * 2000), time: null, origin: "import", source: "Letterboxd" })
		const mine = rnd(i, 3) < 0.14 ? null : Math.min(10, 3 + Math.floor(rnd(i, 4) * 8))
		out.push(item(round ? `${t.key}#${round}` : t.key, t, mine, watches))
	}
	return out
}

export const seenHistory = (pool: SeenTitle[], size: SeenSize): SeenItem[] => (size === "30" ? small(pool) : size === "1500" ? large(pool) : [])

/**
 * Everything the member has Seen: the made-up history, the tracked shows that are Seen (one that is watched through
 * during the visit joins them, not rated), and the movies marked "I watched it" during the visit.
 */
export function seenOf(history: SeenItem[], store: Store, finished: string[], ratings: Record<string, number | null>): SeenItem[] {
	const shows = store.entries
		.filter((e) => e.kind === "seen" || e.kind === "seenNew" || e.kind === "comingBack")
		.map((e) => item(e.show.key, e.show, e.track.lastWatch === 0 ? null : 8, [{ days: e.track.lastWatch, time: null, origin: "manual" }], e))
	const now = finished.map((key) => store.titles[key]).filter(Boolean).map((t) => item(t.key, t, null, [{ days: 0, time: "just now", origin: "manual" }]))
	return [...now, ...shows, ...history].map((s) => (s.id in ratings ? { ...s, mine: ratings[s.id] } : s))
}

/** The tracked shows the member has not watched through: Watching, On hold, Dropped. */
export function inProgress(store: Store, status?: "watching" | "onhold" | "dropped"): SeenItem[] {
	const want = (e: Entry) => (e.track.status === "watching" ? "watching" : e.track.status === "on-hold" ? "onhold" : e.track.status === "dropped" ? "dropped" : null)
	return store.entries
		.filter((e) => (status ? want(e) === status : want(e) !== null))
		.map((e) => item(e.show.key, e.show, null, e.track.lastWatch == null ? [] : [{ days: e.track.lastWatch, time: null, origin: "manual" }], e))
}

export const statusWord = (e: Entry) => (e.track.status === "on-hold" ? "On hold" : e.track.status === "dropped" ? "Dropped" : e.track.status === "seen" ? "Seen" : e.kind === "caughtUp" ? "Caught up" : "Watching")

// ---- Sorting and grouping the Seen side

export type SeenSort = "last" | "score" | "title"
export const SEEN_SORTS: Record<SeenSort, string> = { last: "Last watched", score: "My score", title: "Title" }

const name = (s: SeenItem) => s.t.title.replace(/^(The|A|An) /, "")
const SORT: Record<SeenSort, (a: SeenItem, b: SeenItem) => number> = {
	last: (a, b) => (a.last ?? 9e9) - (b.last ?? 9e9),
	// Not rated goes last under My score; the nudge is how those are found.
	score: (a, b) => (b.mine ?? -1) - (a.mine ?? -1) || (a.last ?? 9e9) - (b.last ?? 9e9),
	title: (a, b) => name(a).localeCompare(name(b)),
}
export const sortSeen = (list: SeenItem[], sort: SeenSort) => [...list].sort(SORT[sort])

export type Group<T> = { key: string; label: string; items: T[] }
function grouped<T>(list: T[], of: (t: T) => [key: string, label: string]): Group<T>[] {
	const out: Group<T>[] = []
	for (const t of list) {
		const [key, label] = of(t)
		const last = out[out.length - 1]
		if (last?.key === key) last.items.push(t)
		else out.push({ key, label, items: [t] })
	}
	return out
}

/** The sorted list in the groups the sort implies: years watched, scores, or first letters. */
export function groupSeen(today: string, list: SeenItem[], sort: SeenSort): Group<SeenItem>[] {
	const sorted = sortSeen(list, sort)
	if (sort === "last")
		return grouped(sorted, (s) => {
			if (s.last == null) return ["unknown", "Date unknown"]
			const y = String(dateOf(today, s.last).getUTCFullYear())
			return [y, y]
		})
	if (sort === "score") return grouped(sorted, (s) => (s.mine == null ? ["none", "Not rated"] : [String(s.mine), `Scored ${s.mine}`]))
	return grouped(sorted, (s) => {
		const c = name(s)[0]?.toUpperCase() ?? "#"
		const letter = /[A-Z]/.test(c) ? c : "#"
		return [letter, letter]
	})
}

// ---- The diary: one row per watch

export interface DiaryRow {
	id: string
	t: SeenTitle
	watch: Watch
	/** The Seen title the watch belongs to; null for an episode of a show that is not Seen. */
	item: SeenItem | null
	/** "Watch 2 of 3", "Earlier watch", "S2 E3 · Half Loop", "Watched through". */
	note: string | null
	rewatch: boolean
}

export function diaryOf(seen: SeenItem[], store: Store, episodes: boolean): DiaryRow[] {
	const rows: DiaryRow[] = []
	for (const s of seen) {
		const n = s.watches.length
		const dated = s.watches.filter((w) => w.days != null).length
		s.watches.forEach((watch, i) => {
			// Watches without a date count as the earliest.
			const nth = watch.days == null ? null : n - i
			const again = n > 1 && nth != null && nth > 1
			const note = again ? `Watch ${nth} of ${n}` : n > 1 && watch.days == null && dated ? "An earlier watch" : s.t.type === "show" ? "Watched through" : null
			rows.push({ id: `${s.id}/${i}`, t: s.t, watch, item: s, note, rewatch: again })
		})
	}
	if (episodes)
		for (const e of store.entries) {
			const st = e.track.status
			if ((st !== "watching" && st !== "on-hold" && st !== "dropped") || e.track.lastWatch == null || e.track.watched < 1) continue
			const ep = e.show.episodes[e.track.watched - 1]
			rows.push({ id: `${e.show.key}/ep`, t: e.show, watch: { days: e.track.lastWatch, time: null, origin: "manual" }, item: null, note: ep ? `${code(ep)} · ${ep.name}` : null, rewatch: false })
		}
	return rows.sort((a, b) => byDate(a.watch, b.watch))
}

/** The diary's rows under month heads; the rows without a date in one last group. */
export function monthsOf(today: string, rows: DiaryRow[]): Group<DiaryRow>[] {
	return grouped(rows, (r) => {
		if (r.watch.days == null) return ["unknown", "Date unknown"]
		const d = dateOf(today, r.watch.days)
		return [`${d.getUTCFullYear()}-${d.getUTCMonth()}`, MONTH.format(d)]
	})
}
export const yearOf = (today: string, w: Watch) => (w.days == null ? null : dateOf(today, w.days).getUTCFullYear())
export const dayParts = (today: string, w: Watch) => {
	if (w.days == null) return null
	const d = dateOf(today, w.days)
	return { day: d.getUTCDate(), weekday: WEEKDAY.format(d) }
}

// ---- The shows list

/**
 * The order of the shows list. One rule, in two parts:
 * 1. Continue: every show with a Next episode watched in the last 30 days, the one watched last on top; after them
 *    the Seen shows with new episodes.
 * 2. Start: the Want to See shows, best taste match first.
 * Nothing is interleaved, so a place in the list can be explained by its group and one fact on the row.
 */
export function tonightOf(store: Store, facts: Record<string, Facts>) {
	const c = continueOf(store)
	return { continues: c.lively, starts: startsOf(store, facts) }
}

/** The shows that have an episode list in /prototype/episode-list-2, by TMDB id. The others get a stub. */
const EPISODE_LISTS: Record<number, string> = { 95480: "slow-horses", 87108: "chernobyl", 19885: "sherlock", 1622: "supernatural" }
export const titlePage = (show: Show) => (EPISODE_LISTS[show.id] ? `/prototype/episode-list-2?variant=B&show=${EPISODE_LISTS[show.id]}` : null)

// PROTOTYPE - throwaway. What /prototype/watching-2 (#371, round 2) adds to round 1's model: the four pieces and their
// variants, the facts a choice rests on, the picks, and the film list under its controls. The store, the rules of
// #365 and the sample members are round 1's (ui/prototype-watching/model.ts), unchanged.
import {
	type Entry,
	type Fixture,
	QUIET_DAYS,
	type Show,
	type Store,
	type Title,
	code,
	entryOf,
	isShow,
} from "~/ui/prototype-watching/model"

export interface Facts {
	genres: string[]
	/** Mood keys, made up from genres. */
	moods: string[]
	seasons: number
	episodes: number
	ended: boolean
	/** A show's whole running time. */
	hours: number | null
	/** Days since Want to See, made up. */
	added: number
	/** Streams on one of the sample member's services. */
	mine: boolean
}
export type Fixture2 = Fixture & { facts: Record<string, Facts> }

// ---- The four pieces and their variants

export type Surface = "home" | "shows" | "films" | "wishlist"
export const SURFACES: Record<Surface, string> = { home: "Home", shows: "My shows", films: "My films", wishlist: "Wishlist" }

export const VARIANTS = {
	home: {
		doors: "A · Three doors",
		rail: "B · One pick, three intents",
		nav: "C · Home as shipped, paths in the navigation",
	},
	shows: {
		lead: "A · Continue leads",
		switch: "B · Continue | Start",
		ranked: "C · One list for tonight",
	},
	films: {
		hero: "A · Hero and tiers",
		time: "B · By the time you have",
		compare: "C · Side by side",
	},
	wishlist: {
		behind: "A · Behind both pages",
		dissolved: "B · Dissolved into the two",
	},
} as const satisfies Record<Surface, Record<string, string>>

export type Choice = { [S in Surface]: keyof (typeof VARIANTS)[S] }
export type Go = (surface: Surface, extra?: Record<string, string>) => void

export function choiceOf(params: URLSearchParams): Choice {
	const pick = <S extends Surface>(s: S) => {
		const v = params.get(s) ?? ""
		return (v in VARIANTS[s] ? v : Object.keys(VARIANTS[s])[0]) as Choice[S]
	}
	return { home: pick("home"), shows: pick("shows"), films: pick("films"), wishlist: pick("wishlist") }
}

// ---- Words

export const hm = (minutes: number | null) => (minutes ? (minutes < 60 ? `${minutes} min` : (minutes % 60 ? `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes / 60}h`)) : "")
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** What starting a show costs: "2 seasons · 12 episodes · about 6 h". */
export const costLine = (f: Facts | undefined) =>
	f ? [plural(f.seasons, "season"), plural(f.episodes, "episode"), f.hours ? `about ${f.hours} h` : null].filter(Boolean).join(" · ") : ""

// ---- Shows

/** A Wishlist show the member has not started, as an entry, so its first episode can be marked from the card. */
export const unstarted = (store: Store, show: Show): Entry => entryOf(show, { status: null, watched: 0, lastWatch: null }, store.today)

export type StartSort = "match" | "short" | "top"
export const START_SORTS: Record<StartSort, string> = { match: "Best match", short: "Shortest first", top: "Top rated" }

/** The shows a member could start: their Want to See shows, under a sort. */
export function startsOf(store: Store, facts: Record<string, Facts>, sort: StartSort = "match"): Entry[] {
	const shows = store.later(store.wishlist.filter(isShow))
	const by: Record<StartSort, (s: Show) => number> = {
		match: (s) => -s.match,
		short: (s) => facts[s.key]?.hours ?? 9e9,
		top: (s) => -(s.score ?? 0),
	}
	const passed = (s: Show) => (store.passed.includes(s.key) ? 1 : 0)
	return [...shows].sort((a, b) => passed(a) - passed(b) || by[sort](a) - by[sort](b)).map((s) => unstarted(store, s))
}

const recent = (e: Entry) => (e.track.lastWatch ?? 9e9) <= QUIET_DAYS

/** What a member can continue tonight, in the order the pages lead with it. */
export function continueOf(store: Store) {
	const next = store.later(store.groups.next.map((e) => ({ ...e, key: e.show.key })))
	const lively = next.filter(recent)
	return {
		/** Watched in the last 30 days, most recent first, then Seen shows with new episodes. */
		lively: [...lively, ...store.groups.seenNew] as Entry[],
		/** Watching, with a Next episode, not watched for 30 days. */
		quiet: next.filter((e) => !recent(e)) as Entry[],
		waiting: [...store.groups.caughtUp, ...store.groups.comingBack],
		onHold: store.groups.onHold,
	}
}

/** Everything with a Next episode: the lively shows, then the quiet ones. */
export const allNext = (store: Store) => {
	const c = continueOf(store)
	return [...c.lively, ...c.quiet]
}

// ---- Films

export type FilmSort = "match" | "short" | "top" | "added" | "waiting"
export const FILM_SORTS: Record<FilmSort, string> = {
	match: "Best match",
	short: "Shortest first",
	top: "Top rated",
	added: "Last added",
	waiting: "Waiting longest",
}
export type FilmControls = { sort: FilmSort; moods: string[]; mine: boolean; /** Minutes the person has, or null. */ time: number | null }
export const FILM_DEFAULTS: FilmControls = { sort: "match", moods: [], mine: true, time: null }

/** The Want to See films under the controls: those that fit first, then the rest, each in the chosen sort. */
export function filmsOf(store: Store, facts: Record<string, Facts>, c: FilmControls) {
	const by: Record<FilmSort, (t: Title) => number> = {
		match: (t) => -t.match,
		short: (t) => t.runtime ?? 9e9,
		top: (t) => -(t.score ?? 0),
		added: (t) => facts[t.key]?.added ?? 0,
		waiting: (t) => -(facts[t.key]?.added ?? 0),
	}
	const all = store.later(store.wishlist.filter((t) => t.type === "movie")).sort((a, b) => {
		const pa = store.passed.includes(a.key) ? 1 : 0
		const pb = store.passed.includes(b.key) ? 1 : 0
		return pa - pb || by[c.sort](a) - by[c.sort](b)
	})
	const onMine = (t: Title) => !c.mine || !!facts[t.key]?.mine
	const inMood = (t: Title) => !c.moods.length || c.moods.some((m) => facts[t.key]?.moods.includes(m))
	const inTime = (t: Title) => !c.time || (t.runtime ?? 0) <= c.time
	const fits = all.filter((t) => onMine(t) && inMood(t) && inTime(t))
	const rest = all.filter((t) => !fits.includes(t))
	const why = (t: Title) => (!inTime(t) ? `${hm((t.runtime ?? 0) - (c.time ?? 0))} over` : !inMood(t) ? "Another mood" : "Not on your services")
	return { all, fits, rest, why }
}

// ---- The picks

export type Pick = { kind: "episode" | "film" | "start"; title: Title; entry: Entry | null }

export function picksOf(store: Store, facts: Record<string, Facts>) {
	const c = continueOf(store)
	const e = c.lively[0] ?? c.quiet[0] ?? null
	const film = filmsOf(store, facts, FILM_DEFAULTS)
	const f = film.fits[0] ?? film.all[0] ?? null
	const s = startsOf(store, facts)[0] ?? null
	const episode: Pick | null = e ? { kind: "episode", title: e.show, entry: e } : null
	const filmPick: Pick | null = f ? { kind: "film", title: f, entry: null } : null
	const start: Pick | null = s ? { kind: "start", title: s.show, entry: s } : null
	/**
	 * Tonight's pick as round 1 recommended it: the Next episode of the Watching show watched most recently in the
	 * last 30 days; without one, the first film; without one, the first show to start.
	 */
	const tonight: Pick | null = (c.lively[0] && c.lively[0].kind === "next" ? episode : null) ?? filmPick ?? start ?? episode
	return { episode, film: filmPick, start, tonight }
}

export const pickLine = (p: Pick | null) => (!p ? "Nothing yet" : p.kind === "episode" && p.entry?.next ? `${p.title.title} · ${code(p.entry.next)}` : p.title.title)
export const surfaceOf = (p: Pick | null): Surface => (p?.kind === "film" ? "films" : "shows")

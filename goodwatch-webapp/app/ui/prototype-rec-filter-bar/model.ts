// PROTOTYPE - throwaway. Filter state and fake filtering for /prototype/rec-filter-bar.
// All filtering runs on the loaded catalog in memory. "Seen", match scores, vibes, and people are
// derived deterministically from the title key, so they look plausible and stay stable across renders.
import { useMemo, useState } from "react"
import type { ProtoTitle } from "~/server/prototype-rec-filter-bar.server"
import { seededRandomFromString } from "~/utils/random"

export type Sort = "for-you" | "popular" | "top" | "newest"
export type MediaType = "all" | "movie" | "show"
export type Release = "any" | "recent" | "2010s" | "2000s" | "older"
export type Viewer = "member" | "no-services" | "guest"

export type Filters = {
	mine: boolean
	notSeen: boolean
	sort: Sort
	type: MediaType
	genres: string[]
	minScore: number
	release: Release
	providers: number[] // Streaming detail: specific services, only when "Everywhere"
	similar: string | null
	vibes: string[]
	people: string[]
}

export const SORTS: { key: Sort; label: string; hint: string }[] = [
	{ key: "for-you", label: "For you", hint: "Your taste match first" },
	{ key: "popular", label: "Popular", hint: "What people watch now" },
	{ key: "top", label: "Top rated", hint: "Highest GoodWatch score" },
	{ key: "newest", label: "Newest", hint: "Latest releases first" },
]

export const TYPES: { key: MediaType; label: string; plural: string }[] = [
	{ key: "all", label: "Movies & shows", plural: "Movies and shows" },
	{ key: "movie", label: "Movies", plural: "Movies" },
	{ key: "show", label: "Shows", plural: "Shows" },
]

export const RELEASES: { key: Release; label: string; test: (y: number) => boolean }[] = [
	{ key: "any", label: "Any year", test: () => true },
	{ key: "recent", label: "Last 3 years", test: (y) => y >= 2024 },
	{ key: "2010s", label: "2010s", test: (y) => y >= 2010 && y < 2020 },
	{ key: "2000s", label: "2000s", test: (y) => y >= 2000 && y < 2010 },
	{ key: "older", label: "Before 2000", test: (y) => y < 2000 },
]

export const SCORES = [0, 60, 70, 80]

// A handful of title analysis vibes, with the colors the fingerprint UI already uses.
export const VIBES: { key: string; label: string; color: string; genres: string[] }[] = [
	{ key: "adrenaline", label: "Adrenaline", color: "rgb(255, 99, 71)", genres: ["Action", "Action & Adventure"] },
	{ key: "tension", label: "Tension", color: "rgb(255, 87, 34)", genres: ["Thriller", "Crime"] },
	{ key: "scare", label: "Scare", color: "rgb(183, 28, 28)", genres: ["Horror"] },
	{ key: "wonder", label: "Wonder", color: "rgb(33, 150, 243)", genres: ["Adventure", "Science Fiction", "Sci-Fi & Fantasy", "Fantasy"] },
	{ key: "pathos", label: "Pathos", color: "rgb(156, 39, 176)", genres: ["Drama"] },
	{ key: "wit", label: "Wit", color: "rgb(255, 214, 0)", genres: ["Comedy"] },
	{ key: "wholesome", label: "Wholesome", color: "rgb(129, 199, 132)", genres: ["Family", "Animation", "Kids"] },
	{ key: "mystery", label: "Mystery", color: "rgb(106, 27, 154)", genres: ["Mystery"] },
	{ key: "romance", label: "Romance", color: "rgb(233, 30, 99)", genres: ["Romance"] },
]

export const PEOPLE = [
	"Pedro Pascal",
	"Zendaya",
	"Denis Villeneuve",
	"Florence Pugh",
	"Christopher Nolan",
	"Jenna Ortega",
	"Greta Gerwig",
	"Cillian Murphy",
]

export const defaultFilters = (viewer: Viewer): Filters => ({
	mine: viewer === "member",
	notSeen: viewer !== "guest",
	sort: "for-you",
	type: "all",
	genres: [],
	minScore: 0,
	release: "any",
	providers: [],
	similar: null,
	vibes: [],
	people: [],
})

// Deterministic fake per-title facts.
const rnd = (t: ProtoTitle, salt: string) => seededRandomFromString(`${t.key}:${salt}`)
export const isSeen = (t: ProtoTitle) => rnd(t, "seen") < 0.24
export const matchOf = (t: ProtoTitle) => {
	const score = t.goodwatch_overall_score_normalized_percent ?? 60
	return Math.round(Math.min(98, 48 + score * 0.35 + rnd(t, "match") * 22))
}
export const vibesOf = (t: ProtoTitle) => VIBES.filter((v) => v.genres.some((g) => t.genres.includes(g))).map((v) => v.key)
export const peopleOf = (t: ProtoTitle) => {
	const r = rnd(t, "people")
	return r < 0.4 ? [PEOPLE[Math.floor(r * 20) % PEOPLE.length]] : []
}

export type Tester = (t: ProtoTitle) => boolean
export type FilterKey = "mine" | "notSeen" | "type" | "genres" | "minScore" | "release" | "providers" | "similar" | "vibes" | "people"

export function testers(f: Filters, mine: number[], catalog: ProtoTitle[]): Partial<Record<FilterKey, Tester>> {
	const out: Partial<Record<FilterKey, Tester>> = {}
	if (f.mine) out.mine = (t) => t.offers.some((o) => mine.includes(o.id))
	else if (f.providers.length) out.providers = (t) => t.offers.some((o) => f.providers.includes(o.id))
	if (f.notSeen) out.notSeen = (t) => !isSeen(t)
	if (f.type !== "all") out.type = (t) => t.media_type === f.type
	if (f.genres.length) out.genres = (t) => f.genres.some((g) => t.genres.includes(g))
	if (f.minScore) out.minScore = (t) => (t.goodwatch_overall_score_normalized_percent ?? 0) >= f.minScore
	if (f.release !== "any") {
		const r = RELEASES.find((x) => x.key === f.release)!
		out.release = (t) => r.test(Number(t.release_year))
	}
	if (f.similar) {
		const base = catalog.find((t) => t.key === f.similar)
		if (base) out.similar = (t) => t.key !== base.key && t.genres.filter((g) => base.genres.includes(g)).length >= 2
	}
	if (f.vibes.length) out.vibes = (t) => f.vibes.every((v) => vibesOf(t).includes(v))
	if (f.people.length) out.people = (t) => peopleOf(t).some((p) => f.people.includes(p))
	return out
}

export const sorters: Record<Sort, (a: ProtoTitle, b: ProtoTitle) => number> = {
	"for-you": (a, b) => matchOf(b) - matchOf(a),
	popular: (a, b) => b.popularity - a.popularity,
	top: (a, b) => (b.goodwatch_overall_score_normalized_percent ?? 0) - (a.goodwatch_overall_score_normalized_percent ?? 0),
	newest: (a, b) => String(b.release_date).localeCompare(String(a.release_date)),
}

export type Recovery = { key: FilterKey; count: number; label: string }

export const RECOVERY_LABEL: Record<FilterKey, string> = {
	mine: "on other services",
	notSeen: "you've already seen",
	type: "of the other type",
	genres: "in other genres",
	minScore: "below your score floor",
	release: "from other years",
	providers: "on other services",
	similar: "less similar",
	vibes: "with other vibes",
	people: "without those people",
}

export function useFilterBar(catalog: ProtoTitle[], mine: number[], viewer: Viewer) {
	const [filters, setFilters] = useState<Filters>(() => defaultFilters(viewer))
	const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
	const reset = () => setFilters(defaultFilters(viewer))
	const toggle = <K extends "genres" | "vibes" | "people" | "providers">(k: K, v: Filters[K][number]) =>
		setFilters((f) => {
			const list = f[k] as (typeof v)[]
			return { ...f, [k]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] }
		})

	const derived = useMemo(() => {
		const tests = testers(filters, mine, catalog)
		const entries = Object.entries(tests) as [FilterKey, Tester][]
		const pass = (t: ProtoTitle, skip?: FilterKey) => entries.every(([k, fn]) => k === skip || fn(t))
		const results = catalog.filter((t) => pass(t)).sort(sorters[filters.sort])
		// For every active filter: how many more titles show up if only that one goes away.
		const recoveries: Recovery[] = entries
			.map(([k]) => ({ key: k, count: catalog.filter((t) => !pass(t) && pass(t, k)).length, label: RECOVERY_LABEL[k] }))
			.filter((r) => r.count > 0)
			.sort((a, b) => b.count - a.count)
		return { results, hidden: catalog.length - results.length, recoveries, active: entries.map(([k]) => k) }
	}, [filters, mine, catalog])

	const moreCount =
		(filters.type !== "all" ? 1 : 0) +
		filters.genres.length +
		(filters.minScore ? 1 : 0) +
		(filters.release !== "any" ? 1 : 0) +
		(!filters.mine && filters.providers.length ? 1 : 0) +
		(filters.similar ? 1 : 0) +
		filters.vibes.length +
		filters.people.length

	const drop = (k: FilterKey) => {
		const patch: Partial<Filters> = {
			mine: { mine: false },
			notSeen: { notSeen: false },
			type: { type: "all" as MediaType },
			genres: { genres: [] },
			minScore: { minScore: 0 },
			release: { release: "any" as Release },
			providers: { providers: [] },
			similar: { similar: null },
			vibes: { vibes: [] },
			people: { people: [] },
		}[k]
		set(patch)
	}

	return { filters, set, reset, toggle, drop, moreCount, catalog, mine, viewer, ...derived }
}

export type Bar = ReturnType<typeof useFilterBar>

export const allGenres = (catalog: ProtoTitle[]) => {
	const counts = new Map<string, number>()
	for (const t of catalog) for (const g of t.genres) counts.set(g, (counts.get(g) ?? 0) + 1)
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g)
}

export const allServices = (catalog: ProtoTitle[]) => {
	const counts = new Map<number, { id: number; name: string; logo: string; n: number }>()
	for (const t of catalog) for (const o of t.offers) counts.set(o.id, { ...o, n: (counts.get(o.id)?.n ?? 0) + 1 })
	return [...counts.values()].sort((a, b) => b.n - a.n)
}

// Short phrases for the sentence bar and the at-a-glance summary.
export function phrases(bar: Bar, serviceNames: string) {
	const f = bar.filters
	const out: { key: string; text: string }[] = []
	out.push({ key: "type", text: TYPES.find((t) => t.key === f.type)!.label })
	out.push({ key: "mine", text: f.mine ? `on ${serviceNames}` : f.providers.length ? `on ${f.providers.length} picked services` : "everywhere" })
	if (f.notSeen) out.push({ key: "notSeen", text: "not seen" })
	if (f.genres.length) out.push({ key: "genres", text: f.genres.join(" or ") })
	if (f.vibes.length) out.push({ key: "vibes", text: f.vibes.map((v) => VIBES.find((x) => x.key === v)!.label).join(" + ") })
	if (f.minScore) out.push({ key: "minScore", text: `${f.minScore}+ score` })
	if (f.release !== "any") out.push({ key: "release", text: RELEASES.find((r) => r.key === f.release)!.label })
	if (f.similar) out.push({ key: "similar", text: `like ${bar.catalog.find((t) => t.key === f.similar)?.title}` })
	if (f.people.length) out.push({ key: "people", text: `with ${f.people.join(", ")}` })
	out.push({ key: "sort", text: SORTS.find((s) => s.key === f.sort)!.label.toLowerCase() })
	return out
}

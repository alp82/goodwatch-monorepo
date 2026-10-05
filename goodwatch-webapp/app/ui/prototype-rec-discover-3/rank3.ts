// PROTOTYPE - throwaway. State for /prototype/rec-discover-3 (#179, round 3): Discover and Search as one page.
// Owner decisions after round 2: no Discover/Search tabs. A query turns browsing into searching on the same page:
// the same grid re-ranks by relevance, the filters stay, "Relevance" joins the sort only while there's a query, and
// clearing the query returns to the browse sort the person had. "For you" is one standing switch (round 2's `motion`
// rule): on Discover it leans the chosen order toward taste, on Search it moves a result at most 5 places.
// Search results are round 1's captured lists; typed text maps to the nearest captured query (no paid queries).
import { useSearchParams } from "@remix-run/react"
import { useMemo, useRef, useState } from "react"
import { rank } from "~/ui/prototype-rec-discover-2/rank2"
import type { Payload, SearchList } from "~/ui/prototype-rec-discover/types"
import { useFilterBar } from "~/ui/prototype-rec-filter-bar/model"

export type Mode = "browse" | "search"
export type Sort = "relevance" | "popular" | "top" | "newest"
export type BrowseSort = Exclude<Sort, "relevance">

export const SORT_OPTS: { key: Sort; label: string; hint: string }[] = [
	{ key: "relevance", label: "Relevance", hint: "Closest to your search" },
	{ key: "popular", label: "Popular", hint: "What people watch now" },
	{ key: "top", label: "Top rated", hint: "Highest GoodWatch score" },
	{ key: "newest", label: "Newest", hint: "Latest releases first" },
]
export const sortsFor = (mode: Mode) => SORT_OPTS.filter((s) => mode === "search" || s.key !== "relevance")

// Rank rule from round 2: search taste moves a result fewer than 6 places, so 5 at most.
export const SEARCH_MAX_MOVE = 5

// ---------------------------------------------------------------- typed text to a captured query

const SYN: Record<string, string[]> = {
	heist: ["heist", "robbery", "caper", "steal", "con", "bank"],
	comedy: ["comedy", "funny", "laugh", "comedies", "humor", "humour"],
	"slow burn": ["slow", "burn", "brooding", "patient"],
	crime: ["crime", "criminal", "gangster", "mob", "detective", "cop"],
	drama: ["drama", "dramatic"],
	"mind-bending": ["mind", "bending", "twist", "trippy", "puzzle", "cerebral"],
	"sci-fi": ["sci", "fi", "scifi", "science", "fiction", "space", "future", "time"],
	cozy: ["cozy", "cosy", "comfort", "gentle"],
	mystery: ["mystery", "mysteries", "whodunit", "whodunnit", "murder", "sleuth"],
	series: ["series", "show", "shows", "tv"],
	"feel-good": ["feel", "good", "feelgood", "uplifting", "happy", "wholesome", "warm"],
	revenge: ["revenge", "vengeance", "payback", "avenge"],
	thriller: ["thriller", "thrillers", "tense", "suspense"],
	batman: ["batman", "bruce", "wayne", "gotham", "joker", "dark", "knight"],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 -]+/g, " ").replace(/\s+/g, " ").trim()
const words = (s: string) => norm(s).split(/[ -]/).filter((w) => w.length > 1)

// Each captured query gets the vocabulary of the synonym groups its words belong to.
function vocab(q: string) {
	const out = new Set(words(q))
	for (const [head, syns] of Object.entries(SYN)) if (norm(q).includes(head)) for (const s of syns) out.add(s)
	return out
}

export type QueryMatch = { hit: SearchList | null; exact: boolean }

export function matchQuery(text: string, lists: SearchList[]): QueryMatch {
	const t = norm(text)
	if (!t) return { hit: null, exact: false }
	const exact = lists.find((l) => norm(l.q) === t)
	if (exact) return { hit: exact, exact: true }
	const typed = words(t)
	let best: SearchList | null = null
	let bestScore = 0
	for (const l of lists) {
		const v = vocab(l.q)
		let s = 0
		for (const w of typed) if ([...v].some((x) => x === w || (w.length >= 3 && (x.startsWith(w) || w.startsWith(x)) && x.length >= 3))) s += 1
		const score = s / Math.max(typed.length, 1)
		if (score > bestScore) (best = l), (bestScore = score)
	}
	return bestScore >= 0.5 ? { hit: best, exact: false } : { hit: null, exact: false }
}

// ---------------------------------------------------------------- the page state

export function useDiscover3(data: Payload) {
	const [params, setParams] = useSearchParams()
	const q = params.get("q")
	const query = q ? (data.search.find((s) => s.q === q) ?? null) : null
	const mode: Mode = query ? "search" : "browse"
	// What the person actually typed, when it was mapped to a different captured query.
	const [typed, setTyped] = useState<string | null>(null)
	const list = query ? query.titles : data.discover
	const bar = useFilterBar(list, data.mine, "member")
	const initialSort = params.get("sort") as Sort | null
	const [browseSort, setBrowseSort] = useState<BrowseSort>(initialSort && initialSort !== "relevance" && SORT_OPTS.some((s) => s.key === initialSort) ? (initialSort as BrowseSort) : "popular")
	const [searchSort, setSearchSort] = useState<Sort>("relevance")
	const sort: Sort = mode === "search" ? searchSort : browseSort
	const [forYou, setForYouState] = useState(params.get("foryou") !== "0")
	const results = bar.results as Payload["discover"]
	const ranked = useMemo(() => rank(results, mode === "search" ? "search" : "discover", sort, forYou), [results, mode, sort, forYou])
	const before = useRef<Map<string, number> | null>(null)
	const [flipAt, setFlipAt] = useState(0)
	const moves = useMemo(() => ranked.filter((r) => r.moved > 0).length, [ranked])
	const maxMove = useMemo(() => ranked.reduce((m, r) => Math.max(m, Math.abs(r.moved)), 0), [ranked])

	const setQ = (next: string | null) => {
		const p = new URLSearchParams(params)
		if (next) p.set("q", next)
		else p.delete("q")
		setParams(p, { replace: true, preventScrollReset: true })
	}
	// Commit typed text. Returns the match so the caller can show the prototype hint when nothing fits.
	const submit = (text: string): QueryMatch => {
		const m = matchQuery(text, data.search)
		if (!m.hit) return m
		setTyped(m.exact ? null : text.trim())
		// A new query starts on Relevance; the browse sort is remembered for when the query is cleared.
		if (m.hit.q !== q) setSearchSort("relevance")
		setQ(m.hit.q)
		return m
	}
	const pick = (s: SearchList) => {
		setTyped(null)
		if (s.q !== q) setSearchSort("relevance")
		setQ(s.q)
	}
	const clear = () => {
		setTyped(null)
		setQ(null)
	}

	return {
		data,
		mode,
		query,
		typed,
		submit,
		pick,
		clear,
		bar,
		sort,
		setSort: (k: Sort) => (mode === "search" ? setSearchSort(k) : k !== "relevance" && setBrowseSort(k)),
		forYou,
		setForYou: (on: boolean) => {
			before.current = new Map(ranked.map((r, i) => [r.t.ref, i]))
			setFlipAt(Date.now())
			setForYouState(on)
		},
		ranked,
		moves,
		maxMove,
		before,
		flipAt,
	}
}

export type D3 = ReturnType<typeof useDiscover3>

export const sortLabel = (d: D3) => SORT_OPTS.find((s) => s.key === d.sort)?.label ?? ""

// What the reading of a query wants, as plain words: "crime, wit and wordplay and fast pace".
export const wantWords = (s: SearchList, n = 4) =>
	s.reading
		.filter((r) => r.kind === "want" || r.kind === "attribute")
		.slice(0, n)
		.map((r) => r.text.toLowerCase().replace(/ & /g, " and "))

// Suggested searches for the empty state. Queries whose reading shares words with the person's top taste lead.
export function suggestions(d: D3) {
	const taste = d.data.top.flatMap((a) => words(`${a.label} ${a.phrase}`))
	return [...d.data.search]
		.map((s, i) => ({ s, i, fit: words(s.reading.map((r) => r.text).join(" ")).filter((w) => w.length > 3 && taste.includes(w)).length }))
		.sort((a, b) => b.fit - a.fit || a.i - b.i)
		.map((x) => ({ s: x.s, forYou: x.fit > 0 }))
}

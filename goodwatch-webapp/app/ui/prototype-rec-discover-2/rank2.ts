// PROTOTYPE - throwaway. State and ordering for /prototype/rec-discover-2 (#179, round 2).
// Owner decision after round 1: "For you" is not a sort and not a strength. It is one on/off switch, on by
// default, that leans whichever sort is chosen toward the person's taste:
// - Discover: round 1's `blend` rule on the chosen order, at round 1's default strength (Strong, 0.6).
// - Search: taste moves a result fewer than SEARCH_SHIFT places within the chosen order, so relevance stays in charge.
import { useSearchParams } from "@remix-run/react"
import { useMemo, useRef, useState } from "react"
import type { DiscTitle, Payload } from "~/ui/prototype-rec-discover/types"
import { useFilterBar } from "~/ui/prototype-rec-filter-bar/model"

export type Surface = "discover" | "search"
export type Sort = "relevance" | "popular" | "top" | "newest"

export const SORTS: Record<Surface, { key: Sort; label: string; hint: string }[]> = {
	discover: [
		{ key: "popular", label: "Popular", hint: "What people watch now" },
		{ key: "top", label: "Top rated", hint: "Highest GoodWatch score" },
		{ key: "newest", label: "Newest", hint: "Latest releases first" },
	],
	search: [
		{ key: "relevance", label: "Relevance", hint: "Closest to your search" },
		{ key: "popular", label: "Popular", hint: "What people watch now" },
		{ key: "top", label: "Top rated", hint: "Highest GoodWatch score" },
		{ key: "newest", label: "Newest", hint: "Latest releases first" },
	],
}

export const DISCOVER_WEIGHT = 0.6
export const SEARCH_SHIFT = 6

export type Ranked = { t: DiscTitle; moved: number }

const plainOrder = (list: DiscTitle[], sort: Sort) => {
	const base = [...list].sort((a, b) => a.rel - b.rel)
	if (sort === "popular") return base.sort((a, b) => b.popularity - a.popularity)
	if (sort === "top") return base.sort((a, b) => (b.goodwatch_overall_score_normalized_percent ?? 0) - (a.goodwatch_overall_score_normalized_percent ?? 0))
	if (sort === "newest") return base.sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)))
	return base
}

const lean = (t: DiscTitle) => (t.pct == null ? 0 : Math.max(-1, Math.min(1, (t.pct - 50) / 50)))

export function rank(results: DiscTitle[], surface: Surface, sort: Sort, forYou: boolean): Ranked[] {
	const plain = plainOrder(results, sort)
	if (!forYou) return plain.map((t) => ({ t, moved: 0 }))
	const n = plain.length || 1
	const score =
		surface === "search"
			? (t: DiscTitle, i: number) => -(i - (SEARCH_SHIFT / 2) * lean(t)) // half each way, so no title moves SEARCH_SHIFT places or more
			: (t: DiscTitle, i: number) => (1 - DISCOVER_WEIGHT) * (1 - i / n) + DISCOVER_WEIGHT * ((t.pct ?? 50) / 100)
	const out = plain
		.map((t, i) => ({ t, i, v: score(t, i) }))
		.sort((a, b) => b.v - a.v || a.i - b.i)
	return out.map((x, j) => ({ t: x.t, moved: x.i - j }))
}

export function useDiscover2(data: Payload) {
	const [params, setParams] = useSearchParams()
	const surface: Surface = params.get("surface") === "search" ? "search" : "discover"
	const qi = Math.max(0, data.search.findIndex((s) => s.q === params.get("q")))
	const query = data.search[qi]
	const list = surface === "discover" ? data.discover : query.titles
	const bar = useFilterBar(list, data.mine, "member")
	const [sorts, setSorts] = useState<Record<Surface, Sort>>(() => {
		const s = params.get("sort") as Sort | null
		const ok = (x: Surface) => (s && SORTS[x].some((o) => o.key === s) ? s : null)
		return { discover: ok("discover") ?? "popular", search: ok("search") ?? "relevance" }
	})
	// One switch for both surfaces: it's a standing preference, not a per-list setting. ?foryou=0 starts it off.
	const [forYou, setForYouState] = useState(params.get("foryou") !== "0")
	const results = bar.results as DiscTitle[]
	const sort = sorts[surface]
	const ranked = useMemo(() => rank(results, surface, sort, forYou), [results, surface, sort, forYou])
	// Positions before the last switch flip, so a variant can show what moved.
	const before = useRef<Map<string, number> | null>(null)
	const [flipAt, setFlipAt] = useState(0)
	const go = (patch: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(patch)) p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const moves = useMemo(() => ranked.filter((r) => r.moved > 0).length, [ranked])
	return {
		data,
		surface,
		setSurface: (s: Surface) => go({ surface: s }),
		query,
		setQuery: (q: string) => go({ surface: "search", q }),
		bar,
		sort,
		setSort: (k: Sort) => setSorts((s) => ({ ...s, [surface]: k })),
		forYou,
		setForYou: (on: boolean) => {
			before.current = new Map(ranked.map((r, i) => [r.t.ref, i]))
			setFlipAt(Date.now())
			setForYouState(on)
		},
		ranked,
		moves, // titles taste lifted above their plain position
		before,
		flipAt,
	}
}

export type D2 = ReturnType<typeof useDiscover2>

export const sortLabel = (d: D2) => SORTS[d.surface].find((s) => s.key === d.sort)?.label ?? ""
export const TUNED = "tuned to you"
export const PLAIN = "for everyone"

// "Popular, tuned to you" / "Relevance, for everyone"
export const orderPhrase = (d: D2) => `${sortLabel(d)}, ${d.forYou ? TUNED : PLAIN}`

export const forYouHint = (d: D2) =>
	!d.forYou ? "Same order for everyone" : d.surface === "search" ? `Moves a result ${SEARCH_SHIFT - 1} places at most` : "Titles you'd rate highly rise"

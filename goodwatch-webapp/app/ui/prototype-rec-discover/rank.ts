// PROTOTYPE - throwaway. Surface state and taste-aware ordering for /prototype/rec-discover (#179).
// The chosen filter bar (#175) filters the list; this module decides the order within what's left.
// Rule for Search: taste reorders within relevance and never overrides it. A title moves at most
// `maxShift` places from its relevance position, so "heist comedy" stays about heist comedies.
import { useSearchParams } from "@remix-run/react"
import { useMemo, useState } from "react"
import { useFilterBar } from "~/ui/prototype-rec-filter-bar/model"
import type { DiscTitle, Payload } from "./types"

export type Surface = "discover" | "search"
export type SortKey = "taste" | "popular" | "top" | "newest" | "relevance"

export const SORTS: Record<Surface, { key: SortKey; label: string; hint: string }[]> = {
	discover: [
		{ key: "taste", label: "For you", hint: "Your taste match first" },
		{ key: "popular", label: "Popular", hint: "What people watch now" },
		{ key: "top", label: "Top rated", hint: "Highest GoodWatch score" },
		{ key: "newest", label: "Newest", hint: "Latest releases first" },
	],
	search: [
		{ key: "relevance", label: "Best match", hint: "Closest to your search" },
		{ key: "taste", label: "For you", hint: "Your taste, among the closest matches" },
		{ key: "top", label: "Top rated", hint: "Highest GoodWatch score" },
		{ key: "newest", label: "Newest", hint: "Latest releases first" },
	],
}

// How far taste may move a search result at full strength, and on the "For you" sort.
export const SEARCH_MAX_SHIFT = 6
export const SEARCH_TASTE_SHIFT = 10

export type Ranked = { t: DiscTitle; moved: number }

const lean = (t: DiscTitle) => (t.pct == null ? 0 : Math.max(-1, Math.min(1, (t.pct - 50) / 50)))

function nudge(list: DiscTitle[], maxShift: number) {
	return list
		.map((t, i) => ({ t, v: i - maxShift * lean(t) }))
		.sort((a, b) => a.v - b.v)
		.map((x) => x.t)
}

export function rank(results: DiscTitle[], surface: Surface, sort: SortKey, strength: number): Ranked[] {
	const base = [...results].sort((a, b) => a.rel - b.rel)
	const n = base.length || 1
	let out: DiscTitle[]
	if (sort === "top") out = [...base].sort((a, b) => (b.goodwatch_overall_score_normalized_percent ?? 0) - (a.goodwatch_overall_score_normalized_percent ?? 0))
	else if (sort === "newest") out = [...base].sort((a, b) => String(b.release_date).localeCompare(String(a.release_date)))
	else if (surface === "search") out = nudge(base, sort === "taste" ? SEARCH_TASTE_SHIFT : Math.round(strength * SEARCH_MAX_SHIFT))
	else if (sort === "taste") out = [...base].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.rel - b.rel)
	else if (strength > 0) {
		// Taste blended into the popularity order: position within the list against the person's percentile.
		const v = (t: DiscTitle, i: number) => (1 - strength) * (1 - i / n) + strength * ((t.pct ?? 50) / 100)
		out = base
			.map((t, i) => ({ t, v: v(t, i) }))
			.sort((a, b) => b.v - a.v)
			.map((x) => x.t)
	} else out = base
	const pos = new Map(base.map((t, i) => [t.ref, i]))
	return out.map((t, i) => ({ t, moved: (pos.get(t.ref) ?? i) - i }))
}

export function useDiscover(data: Payload, defaults: { discover: SortKey; search: SortKey; strength?: number }) {
	const [params, setParams] = useSearchParams()
	const surface: Surface = params.get("surface") === "search" ? "search" : "discover"
	const qi = Math.max(0, data.search.findIndex((s) => s.q === params.get("q")))
	const query = data.search[qi]
	const list = surface === "discover" ? data.discover : query.titles
	const bar = useFilterBar(list, data.mine, "member")
	const [sorts, setSorts] = useState<Record<Surface, SortKey>>({ discover: defaults.discover, search: defaults.search })
	const [strength, setStrength] = useState(defaults.strength ?? 0)
	const results = bar.results as DiscTitle[]
	const ranked = useMemo(() => rank(results, surface, sorts[surface], strength), [results, surface, sorts, strength])
	const go = (patch: Record<string, string>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(patch)) p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	return {
		data,
		surface,
		setSurface: (s: Surface) => go({ surface: s }),
		query,
		setQuery: (q: string) => go({ surface: "search", q }),
		bar,
		sort: sorts[surface],
		setSort: (k: SortKey) => setSorts((s) => ({ ...s, [surface]: k })),
		strength,
		setStrength,
		ranked,
		// Search order is relevance unless the person picked a plain sort.
		tasteOrdered: sorts[surface] === "taste" || strength > 0,
	}
}

export type Disc = ReturnType<typeof useDiscover>

// Words for a match, for variants that don't show a number.
export const matchWord = (m: number | null) => (m == null ? null : m >= 85 ? "Your kind" : m >= 70 ? "Likely yours" : m >= 58 ? "Maybe" : "Not your thing")
export const matchTone = (m: number | null) => (m == null ? "text-gray-500" : m >= 85 ? "text-amber-300" : m >= 70 ? "text-amber-200/80" : m >= 58 ? "text-gray-300" : "text-gray-500")

export const posterUrl = (p: string, size = "w342") => `https://image.tmdb.org/t/p/${size}${p}`
export const titleHref = (t: DiscTitle) => `/${t.media_type}/${t.tmdb_id}-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`
export const listSentence = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""))

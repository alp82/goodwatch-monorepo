// PROTOTYPE (Discover lab, section "titles"): what every titles variant shares.
// - useTitleUses: the three ways a found title narrows the list (Similar to, Loved, Disliked), read from and written to
//   d.filters. Loved and Disliked exclude each other (as in the sheet's pickers); Similar to is independent.
// - useKnown: names and posters for picked titles (what a pick told us, else the names lookup).
// - useSearchPreview: what "Search: <text>" would return, before running it. The same request and query keys as
//   kit.tsx, so running the search afterwards is instant and the preview is exactly what the grid will show.
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { searchEligibility, searchText } from "~/domain/discover-search"
import type { DiscoverResults } from "~/server/discover-results.server"
import { runDiscoverSearch } from "~/ui/discover/discover-search-request"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import { type TitleKey } from "~/utils/title-key"
import { type ProtoDiscover } from "../../../kit"
import { type FoundTitle, POSTER_SM, liveTitleUrl } from "../../shell-parts"

export const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

// ---------------------------------------------------------------------------------------------------------------
// Ways to use a title

export type Use = "similarTo" | "loved" | "disliked"
const USE_ORDER: Use[] = ["similarTo", "loved", "disliked"]

export function useTitleUses(d: ProtoDiscover) {
	const s = d.filters.state
	const listOf = (u: Use): TitleKey[] => s[u] ?? []
	const has = (u: Use, k: TitleKey) => listOf(u).includes(k)
	const usesOf = (k: TitleKey) => USE_ORDER.filter((u) => has(u, k))
	const toggle = (u: Use, k: TitleKey) =>
		d.filters.update((st) => {
			const list = st[u] ?? []
			const on = list.includes(k)
			const next = on ? list.filter((x) => x !== k) : [...list, k]
			const out = { ...st, [u]: next.length ? next : undefined }
			if (!on && u !== "similarTo") {
				const other = u === "loved" ? "disliked" : "loved"
				const rest = (st[other] ?? []).filter((x) => x !== k)
				out[other] = rest.length ? rest : undefined
			}
			return out
		})
	const picked = USE_ORDER.flatMap((u) => listOf(u).map((k) => ({ use: u, key: k })))
	return { has, usesOf, toggle, picked, listOf }
}
export type TitleUses = ReturnType<typeof useTitleUses>

/** Names and posters for picked titles: what a pick told us first, the names lookup after. */
export function useKnown(keys: TitleKey[]) {
	const names = useTitleNames(keys, "")
	const [seen, setSeen] = useState(() => new Map<TitleKey, FoundTitle>())
	const remember = (t: FoundTitle) => setSeen((m) => (m.has(t.key) ? m : new Map(m).set(t.key, t)))
	const known = (k: TitleKey): { title: string; year: string; poster: string | null } | undefined => {
		const s = seen.get(k)
		if (s) return s
		const n = names.byKey.get(k)
		return n ? { title: n.title, year: String(n.year ?? ""), poster: n.poster ?? null } : undefined
	}
	return { known, remember }
}

// ---------------------------------------------------------------------------------------------------------------
// The search preview

function useDebounced<T>(value: T, ms: number): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

/**
 * What running `text` as the search would show with the current filters: its first posters, the count, and how the
 * search reads it. Starts 0.6 s after typing stops, three letters or more.
 */
export function useSearchPreview(d: ProtoDiscover, text: string) {
	const now = searchText(text)
	const term = useDebounced(now, 600)
	const active = term !== null && term.length >= 3 && term !== d.q
	const eligibility = useMemo(() => searchEligibility(d.filters.state, { country: "US", services: [] }), [d.filters.state])
	const search = useQuery({
		queryKey: ["proto-discover-search", term, JSON.stringify(eligibility)],
		enabled: active,
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) => runDiscoverSearch(term ?? "", eligibility, true, signal, () => {}),
	})
	const ranked = active ? search.data?.ranked : undefined
	const fq = d.filters.query
	const baseQuery = ranked ? `${fq}${fq ? "&" : ""}ranked=${ranked.join(",")}` : null
	const results = useQuery<DiscoverResults[]>({
		// Its own key: the grid's entries hold one list per length request (kit.tsx), this one a single page.
		queryKey: ["proto-discover-preview", baseQuery ?? "", 1],
		enabled: baseQuery !== null,
		staleTime: 60_000,
		queryFn: async ({ signal }) => {
			const response = await fetch(`/api/discover/results?${baseQuery}${baseQuery ? "&" : ""}page=1`, { signal })
			if (!response.ok) throw new Error(`Results ${response.status}`)
			return [(await response.json()) as DiscoverResults]
		},
	})
	const first = baseQuery !== null ? results.data?.[0] : undefined
	const fresh = now !== null && now === term
	return {
		/** True while the preview isn't for the text as typed yet. */
		busy: now !== null && now.length >= 3 && (!fresh || search.isFetching || results.isFetching || (!!ranked && !first)),
		ready: fresh && active && !!first,
		failed: fresh && active && !!(search.error || results.error),
		cards: first?.cards ?? [],
		total: first?.total ?? null,
		reading: (fresh && active && search.data?.reading) || [],
	}
}
type SearchPreview = ReturnType<typeof useSearchPreview>

// ---------------------------------------------------------------------------------------------------------------
// Pieces

export function LaneHead({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
	return (
		<h3 className={`${SECTION_LABEL} mb-3 flex h-5 items-center gap-1.5 px-1 text-gray-400`}>
			{icon && <span className="text-gray-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
			{children}
			{right && <span className="ml-auto normal-case tracking-normal font-normal">{right}</span>}
		</h3>
	)
}

/** The preview's posters, a fixed-height strip: placeholders while it loads. */
export function PreviewPosters({ p, n, w = 46 }: { p: SearchPreview; n: number; w?: number }) {
	const h = Math.round(w * 1.5)
	const cards = p.ready ? p.cards.slice(0, n) : []
	return (
		<div className="flex items-center gap-2 overflow-hidden" style={{ height: h }}>
			{p.ready && cards.length === 0 && <span className="px-1 text-[13px] text-gray-500">Nothing fits the current filters</span>}
			{p.failed && !p.ready && <span className="px-1 text-[13px] text-gray-500">No preview right now</span>}
			{cards.map((c) => (
				<a
					key={c.key}
					href={liveTitleUrl({ mediaType: c.media_type === "movie" ? "movie" : "show", tmdbId: c.tmdb_id, title: c.title })}
					target="_blank"
					rel="noreferrer"
					title={c.title}
					className="block shrink-0 overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					style={{ width: w, height: h }}
				>
					{c.poster_path ? (
						<img src={`${POSTER_SM}${c.poster_path}`} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
					) : (
						<span className="grid h-full place-items-center p-0.5 text-center text-[8px] leading-tight text-gray-500">{c.title}</span>
					)}
				</a>
			))}
			{!p.ready &&
				!p.failed &&
				Array.from({ length: n }, (_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
						key={i}
						className={`shrink-0 rounded-md bg-white/[0.05] ${p.busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
						style={{ width: w, height: h }}
					/>
				))}
		</div>
	)
}


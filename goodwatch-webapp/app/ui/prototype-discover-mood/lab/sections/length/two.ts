// PROTOTYPE (Discover lab, round 10 length): movie length and episode length as two values. The real `runtime`
// param holds the movie range, the lab-only `eruntime` the episode range ("any" for none). Without `eruntime` the one
// runtime holds for both kinds, as in production (Length a, b, c write it that way).
// Production has one range per request, so with Movies and shows and two different ranges the kit asks twice (movies
// with theirs, shows with theirs), sums the totals and merges the lists (lengthRequests, mergeKinds, sumCounts).
import type { FilterRange, FilterState, SortKey } from "~/domain/filter-state"
import type { TitleCard } from "~/server/title-cards.server"
import type { FilterBarCounts } from "~/ui/filter-bar"
import type { ActiveChip } from "~/ui/filter-bar/labels"
import type { TitleKey } from "~/utils/title-key"

export const EP_PARAM = "eruntime"
const MAX = 240

/** Discover's state plus the episode range: null for any length, undefined for "same as runtime". */
export type LabState = FilterState & { episodeRuntime?: FilterRange | null }

const isSet = (r: FilterRange | null | undefined): r is FilterRange =>
	!!r && ((r.min !== undefined && r.min > 0) || r.max !== undefined)

export function parseEpisode(params: URLSearchParams): FilterRange | null | undefined {
	const v = params.get(EP_PARAM)
	if (v === null) return undefined
	const [a, b] = v.split("-")
	const min = a ? Number(a) : undefined
	const max = b ? Number(b) : undefined
	const r = { ...(min !== undefined && Number.isFinite(min) ? { min } : {}), ...(max !== undefined && Number.isFinite(max) ? { max } : {}) }
	return isSet(r) ? r : null
}

export const encodeEpisode = (r: FilterRange | null | undefined) =>
	r === undefined ? null : isSet(r) ? `${r.min ?? ""}-${r.max ?? ""}` : "any"

export const episodeRange = (s: LabState): FilterRange | undefined =>
	s.episodeRuntime === undefined ? s.runtime : (s.episodeRuntime ?? undefined)

const sameRange = (a?: FilterRange, b?: FilterRange) =>
	(isSet(a) ? (a.min ?? 0) : 0) === (isSet(b) ? (b.min ?? 0) : 0) && (isSet(a) ? a.max : undefined) === (isSet(b) ? b.max : undefined)

export const stripLab = ({ episodeRuntime: _, ...s }: LabState): FilterState => s

/** The states to ask the results endpoint for: one, or movies and shows apart when their ranges differ. */
export function lengthRequests(s: LabState): FilterState[] {
	const base = stripLab(s)
	const movie = s.runtime
	const episode = episodeRange(s)
	if (s.type === "movie") return [{ ...base, runtime: movie }]
	if (s.type === "show") return [{ ...base, runtime: episode }]
	if (sameRange(movie, episode)) return [{ ...base, runtime: movie }]
	return [
		{ ...base, type: "movie", runtime: movie },
		{ ...base, type: "show", runtime: episode },
	]
}

/** Two sorted lists as one. Score sorts merge by the card's value; Popular alternates (cards carry no popularity). */
export function mergeKinds(lists: TitleCard[][], sort: SortKey, ranked?: TitleKey[]): TitleCard[] {
	const at = ranked ? new Map(ranked.map((k, i) => [k, i])) : null
	const value = (c: TitleCard, i: number): number => {
		if (sort === "relevance" && at) return -(at.get(c.key) ?? 1e9)
		if (sort === "top") return c.goodwatch_overall_score_normalized_percent ?? -1
		if (sort === "match") return c.match ?? -1
		if (sort === "newest") return c.release_year ?? -1
		return -i
	}
	return lists
		.flatMap((list, kind) => list.map((c, i) => ({ c, v: value(c, i), i, kind })))
		.sort((a, b) => b.v - a.v || a.i - b.i || a.kind - b.kind)
		.map((x) => x.c)
}

const deepSum = (a: unknown, b: unknown): unknown => {
	if (typeof a === "number" && typeof b === "number") return a + b
	if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
		const out: Record<string, unknown> = { ...(b as object) }
		for (const [k, v] of Object.entries(a)) out[k] = k in out ? deepSum(v, out[k]) : v
		return out
	}
	return a ?? b
}

/**
 * Counts of the two lists (disjoint), so totals and option counts add up exactly. Hidden is the catalog (each
 * request's total + hidden) less the sum; the type filter's own recovery is dropped (each request hides the other kind).
 */
export function sumCounts(parts: FilterBarCounts[]): FilterBarCounts {
	const [a, ...rest] = parts
	if (!rest.length) return a
	const all = a.total + a.hidden
	return rest.reduce<FilterBarCounts>((x, y) => {
		const rec = new Map<string, number>()
		for (const r of [...x.recoveries, ...y.recoveries])
			if (r.filter !== "type") rec.set(r.filter, (rec.get(r.filter) ?? 0) + r.titles)
		return {
			total: x.total + y.total,
			hidden: Math.max(0, all - x.total - y.total),
			recoveries: [...rec].map(([filter, titles]) => ({ filter, titles }) as FilterBarCounts["recoveries"][number]).sort((p, q) => q.titles - p.titles),
			optionCounts: deepSum(x.optionCounts, y.optionCounts) as FilterBarCounts["optionCounts"],
			approximate: x.approximate || y.approximate,
			ladder: x.ladder ?? y.ladder,
		}
	}, a)
}

const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`)

/** "under 2 h", "3 h or more", "35 min to 55 min". */
export function lengthWords(r: FilterRange): string {
	const lo = r.min ?? 0
	const hi = r.max ?? MAX
	if (lo <= 0) return `under ${fmt(hi)}`
	if (hi >= MAX) return `${fmt(lo)} or more`
	return `${fmt(lo)} to ${fmt(hi)}`
}

/** The status line's Length chips: one per kind that has a range and is in the list. */
export function lengthChips(s: LabState): ActiveChip[] {
	const out: ActiveChip[] = []
	const movie = s.runtime
	const episode = episodeRange(s)
	if (s.type !== "show" && isSet(movie))
		out.push({
			key: "runtime",
			group: "runtime",
			label: `Movies ${lengthWords(movie)}`,
			remove: (x) => ({ ...x, runtime: undefined, episodeRuntime: episodeRange(x as LabState) ?? null }) as FilterState,
		})
	if (s.type !== "movie" && isSet(episode))
		out.push({
			key: EP_PARAM,
			group: "runtime",
			label: `Episodes ${lengthWords(episode)}`,
			remove: (x) => ({ ...x, episodeRuntime: null }) as FilterState,
		})
	return out
}

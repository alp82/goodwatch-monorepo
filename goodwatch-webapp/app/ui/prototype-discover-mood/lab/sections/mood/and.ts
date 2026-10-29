// PROTOTYPE (Discover lab, mood i): every pick ANDed, also within a group, counted exactly from Discover's own
// results endpoint, which only matches ANY within a group.
//
// Counts: inclusion-exclusion. A query with a subset S_g of each group's picks gives |U(S_1) ∩ … ∩ U(S_m)| (its
// total) and, per other choice u, the same with u added to its group (its option counts). An AND over a group is the
// signed sum of its subsets' unions, so every exact AND count (the list and each row with one more choice) comes from
// the 2^N queries over the subsets of the N picks, with every other Discover filter as it is (services, scores, a
// running search's ranked list). Genre pairs (Action = Action or Action & Adventure) add their two names' counts, which
// is exact while no title has both (the movie name and the show name).
//
// The list (round 9, the grid and Show N titles): the AND list is a subset of the list with each group cut to its
// rarest pick. The cut is read 400 at a time (ten pages); each chunk goes back as `ranked` (100 at a time) with each
// other pick alone, and the titles all of those keep are the AND list in Discover's order. Load more reads the next
// chunk, so once the cut is read to its end the list is exactly the AND list.
//
// Round 13 (k): a group can be "any of" (`anyof=themes,genres`): its picks go to Discover as they are (its own OR), so
// every query holds the whole group (or the group less one pick, for "Without X"); inclusion-exclusion runs only over
// the "all of" groups. Across groups it is always AND.
import { useSearchParams } from "@remix-run/react"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { searchEligibility } from "~/domain/discover-search"
import type { DiscoverResults } from "~/server/discover-results.server"
import type { TitleCard } from "~/server/title-cards.server"
import { runDiscoverSearch } from "~/ui/discover/discover-search-request"
import type { ProtoDiscover } from "../../../kit"
import type { ResultsView } from "../../types"
import { genreUnits } from "./parts"

export type AndGroup = "moods" | "themes" | "styles" | "genres"
const GROUPS: AndGroup[] = ["moods", "themes", "styles", "genres"]

/** One condition: a filter tag, or a genre unit (its names). */
export interface Cond {
	group: AndGroup
	id: string
	values: string[]
}

/** The URL param for the groups that match any of their picks. */
export const ANY_PARAM = "anyof"
export type AnyOf = ReadonlySet<AndGroup>
const NONE: AnyOf = new Set()

/** The "any of" groups, and a setter that keeps them in the URL. */
export function useAnyOf(): { any: AnyOf; set: (g: AndGroup, any: boolean) => void } {
	const [params, setParams] = useSearchParams()
	const raw = params.get(ANY_PARAM) ?? ""
	const any = new Set(raw.split(",").filter((g): g is AndGroup => (GROUPS as string[]).includes(g)))
	const set = (g: AndGroup, on: boolean) =>
		setParams(
			(prev) => {
				const next = new URLSearchParams(prev)
				const now = new Set((next.get(ANY_PARAM) ?? "").split(",").filter((x): x is AndGroup => (GROUPS as string[]).includes(x)))
				if (on) now.add(g)
				else now.delete(g)
				const list = GROUPS.filter((x) => now.has(x))
				if (list.length) next.set(ANY_PARAM, list.join(","))
				else next.delete(ANY_PARAM)
				return next
			},
			{ replace: true, preventScrollReset: true },
		)
	return { any, set }
}

/** At most this many picks AND together (2^5 = 32 queries); "any of" groups don't count. */
export const MAX_AND = 5
/** The picks in "all of" groups, the ones the cap counts. */
export const andCount = (picks: Cond[], any: AnyOf = NONE) => picks.filter((c) => !any.has(c.group)).length

export function picksOf(d: ProtoDiscover): Cond[] {
	return [
		...d.picked.map((t) => ({ group: t.group, id: t.key, values: [t.key] })),
		...genreUnits(d)
			.filter((u) => u.on)
			.map((u) => ({ group: "genres" as const, id: u.label, values: u.names })),
	]
}

/** The search's ranked list (the kit runs the same query; this shares its cache). */
function useRanked(d: ProtoDiscover): { ranked: string | null; waiting: boolean } {
	const eligibility = searchEligibility(d.filters.state, { country: "US", services: [] })
	const search = useQuery({
		queryKey: ["proto-discover-search", d.q, JSON.stringify(eligibility)],
		enabled: d.q !== null,
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) => runDiscoverSearch(d.q ?? "", eligibility, true, signal, () => {}),
	})
	if (d.q === null) return { ranked: null, waiting: false }
	return { ranked: search.data ? search.data.ranked.join(",") : null, waiting: !search.data }
}

type Subsets = Partial<Record<AndGroup, Cond[]>>

function queryFor(base: string, ranked: string | null, s: Subsets) {
	const p = new URLSearchParams(base)
	for (const g of GROUPS) {
		const values = (s[g] ?? []).flatMap((c) => c.values)
		if (values.length) p.set(g, values.join(","))
		else p.delete(g)
	}
	if (ranked) p.set("ranked", ranked)
	return p.toString()
}

/** Every subset of a list (the empty one first). */
const subsets = <T>(list: T[]): T[][] => list.reduce<T[][]>((all, x) => [...all, ...all.map((s) => [...s, x])], [[]])

const keyOf = (s: Subsets) => GROUPS.map((g) => (s[g] ?? []).map((c) => c.id).sort().join("|")).join("/")

async function results(query: string, signal: AbortSignal) {
	const response = await fetch(`/api/discover/results?${query}&page=1`, { signal })
	if (!response.ok) throw new Error(`Results ${response.status}`)
	return (await response.json()) as DiscoverResults
}

export interface AndCounts {
	/** Titles with every pick. */
	total: number
	/** Titles with every pick and this one more (a row not picked); null when it can't be counted. */
	adding: (c: Cond) => number | null
	/** Titles with every pick but this one. */
	without: (c: Cond) => number
	/** Titles with every pick and this option of a group no pick is in (Movies or shows). */
	option: (group: string, key: string) => number | null
}

/**
 * Exact AND counts, or the last ones while new ones load (so rows don't jump to "no count" and back). `busy` while
 * the shown counts are for an earlier state.
 */
export function useAndCounts(d: ProtoDiscover, picks: Cond[], any: AnyOf = NONE): { counts: AndCounts | null; busy: boolean } {
	const { ranked, waiting } = useRanked(d)
	const base = d.filters.query
	const groups = GROUPS.filter((g) => picks.some((c) => c.group === g))
	const of = (g: AndGroup) => picks.filter((c) => c.group === g)
	// An "any of" group: the whole group, or the group less one pick (Without X).
	const choices = (g: AndGroup) => (any.has(g) ? [of(g), ...of(g).map((c) => of(g).filter((x) => x !== c))] : subsets(of(g)))
	// Every combination of subsets, one per group with picks.
	const combos = groups.reduce<Subsets[]>((all, g) => all.flatMap((s) => choices(g).map((sub) => ({ ...s, [g]: sub }))), [{}])
	const queries = useQueries({
		queries: combos.map((s) => {
			const q = queryFor(base, ranked, s)
			return {
				queryKey: ["lab-mood-and", q],
				enabled: !waiting && andCount(picks, any) <= MAX_AND,
				staleTime: 60_000,
				queryFn: ({ signal }: { signal: AbortSignal }) => results(q, signal),
			}
		}),
	})
	const last = useRef<AndCounts | null>(null)
	const ready = !waiting && andCount(picks, any) <= MAX_AND && queries.every((q) => q.data)
	if (!ready) return { counts: last.current, busy: true }

	const at = new Map<string, DiscoverResults>()
	combos.forEach((s, i) => at.set(keyOf(s), queries[i].data as DiscoverResults))
	const get = (s: Subsets) => at.get(keyOf(s)) as DiscoverResults

	/** Signed sum over the non-empty subsets of each group's set; `term` reads one combination. */
	const expand = (sets: Partial<Record<AndGroup, Cond[]>>, term: (s: Subsets) => number) => {
		const gs = GROUPS.filter((g) => (sets[g] ?? []).length)
		let sum = 0
		const walk = (i: number, s: Subsets, sign: number) => {
			if (i === gs.length) {
				sum += sign * term(s)
				return
			}
			// An "any of" group is one term: all of its set, as Discover reads it.
			if (any.has(gs[i])) {
				walk(i + 1, { ...s, [gs[i]]: sets[gs[i]] ?? [] }, sign)
				return
			}
			for (const sub of subsets(sets[gs[i]] ?? [])) if (sub.length) walk(i + 1, { ...s, [gs[i]]: sub }, sign * (sub.length % 2 ? 1 : -1))
		}
		walk(0, {}, 1)
		return sum
	}
	const setsOf = (list: Cond[]) => Object.fromEntries(GROUPS.map((g) => [g, list.filter((c) => c.group === g)])) as Record<AndGroup, Cond[]>

	const counts: AndCounts = {
		total: picks.length ? expand(setsOf(picks), (s) => get(s).total) : (get({})?.total ?? 0),
		without: (c) => {
			const rest = picks.filter((p) => p !== c)
			return rest.length ? expand(setsOf(rest), (s) => get(s).total) : get({}).total
		},
		option: (group, key) => {
			const read = (s: Subsets) => (get(s).optionCounts as unknown as Record<string, Record<string, number> | undefined>)[group]?.[key] ?? Number.NaN
			const n = picks.length ? expand(setsOf(picks), read) : read({})
			return Number.isNaN(n) ? null : n
		},
		adding: (u) => {
			const sets = setsOf([...picks, u])
			return expand(sets, (s) => {
				const sub = s[u.group] ?? []
				if (!sub.includes(u)) return get(s).total
				const without = { ...s, [u.group]: sub.filter((c) => c !== u) }
				const r = get(without)
				const oc = r.optionCounts?.[u.group] as Record<string, number> | undefined
				if (!oc) return Number.NaN
				// A genre pair: both names' counts, less the list each already holds.
				const extra = u.values.length - 1
				return u.values.reduce((a, v) => a + (oc[v] ?? 0), 0) - (without[u.group]?.length ? extra * r.total : 0)
			})
		},
	}
	const safe: AndCounts = {
		...counts,
		adding: (u) => {
			const n = andCount(picks, any) >= MAX_AND && !any.has(u.group) ? null : counts.adding(u)
			return n === null || Number.isNaN(n) ? null : Math.max(0, n)
		},
	}
	last.current = safe
	return { counts: safe, busy: false }
}

/** One chunk of the cut list: ten pages. */
const CHUNK = 10

async function page(query: string, n: number, signal: AbortSignal) {
	const response = await fetch(`/api/discover/results?${query}&page=${n}`, { signal })
	if (!response.ok) throw new Error(`Results ${response.status}`)
	return (await response.json()) as DiscoverResults
}

/** Pages `from`..`to` of a query, stopping at its last page. */
async function pages(query: string, from: number, to: number, signal: AbortSignal) {
	const first = await page(query, from, signal)
	const last = Math.min(to, Math.ceil(first.total / first.pageSize))
	const rest = await Promise.all(Array.from({ length: Math.max(0, last - from) }, (_, i) => page(query, from + 1 + i, signal)))
	return [first, ...rest]
}

/** True when an "all of" group holds two picks or more: only then the AND list differs from Discover's own. */
export const needsAnd = (picks: Cond[], any: AnyOf = NONE) => GROUPS.some((g) => !any.has(g) && picks.filter((c) => c.group === g).length > 1)

/** The AND list in Discover's order, read a chunk at a time (see the header). */
export function useAndList(d: ProtoDiscover, picks: Cond[], on: boolean, any: AnyOf = NONE) {
	const { ranked, waiting } = useRanked(d)
	const base = d.filters.query
	const groups = GROUPS.filter((g) => picks.some((c) => c.group === g))
	// Each pick's own count (the no-pick query, shared with the counts) picks the rarest of each group for the cut.
	const plainQ = queryFor(base, ranked, {})
	const plain = useQuery({
		queryKey: ["lab-mood-and", plainQ],
		enabled: on && !waiting,
		staleTime: 60_000,
		queryFn: ({ signal }) => results(plainQ, signal),
	})
	const own = (c: Cond) => {
		const oc = plain.data?.optionCounts?.[c.group] as Record<string, number> | undefined
		return c.values.reduce((a, v) => a + (oc?.[v] ?? 0), 0)
	}
	// An "any of" group goes whole into the cut (Discover's OR); an "all of" group by its rarest pick.
	const firsts: Subsets = Object.fromEntries(
		groups.map((g) => {
			const list = picks.filter((c) => c.group === g)
			return [g, any.has(g) ? list : [...list].sort((a, b) => own(a) - own(b)).slice(0, 1)]
		}),
	)
	const others = picks.filter((c) => !(firsts[c.group] ?? []).includes(c))
	const cut = queryFor(base, ranked, firsts)
	const [read, setRead] = useState({ cut: "", chunks: 1 })
	const chunks = read.cut === cut ? read.chunks : 1
	const ready = on && !waiting && Boolean(plain.data) && andCount(picks, any) <= MAX_AND
	const pool = useQueries({
		queries: Array.from({ length: chunks }, (_, i) => ({
			queryKey: ["lab-mood-and-pool", cut, i],
			enabled: ready,
			staleTime: 60_000,
			queryFn: ({ signal }: { signal: AbortSignal }) => pages(cut, i * CHUNK + 1, (i + 1) * CHUNK, signal),
		})),
	})
	const keysOf = (i: number) => (pool[i]?.data ?? []).flatMap((r) => r.keys)
	const checks = useQueries({
		queries: Array.from({ length: chunks }, (_, i) =>
			others.map((c) => {
				const q = queryFor(base, null, { ...firsts, [c.group]: [c] })
				const keys = keysOf(i)
				return {
					queryKey: ["lab-mood-and-check", q, keys.join(",")],
					enabled: ready && keys.length > 0,
					staleTime: 60_000,
					queryFn: async ({ signal }: { signal: AbortSignal }) => {
						const kept = new Set<number>()
						// The ranked list takes 100 keys; each batch is three pages at most.
						const batches = Array.from({ length: Math.ceil(keys.length / 100) }, (_, b) => keys.slice(b * 100, b * 100 + 100))
						await Promise.all(
							batches.map(async (batch) => {
								for (const r of await pages(`${q}&ranked=${batch.join(",")}`, 1, 3, signal)) for (const k of r.keys) kept.add(k)
							}),
						)
						return kept
					},
				}
			}),
		).flat(),
	})
	const last = useRef<TitleCard[]>([])
	const cutTotal = pool[0]?.data?.[0]?.total ?? 0
	const more = () => setRead({ cut, chunks: chunks + 1 })
	const done = on && pool.every((p) => p.data) && checks.every((c) => c.data)
	const cards = done
		? pool.flatMap((p, i) => {
				const byKey = new Map((p.data ?? []).flatMap((r) => r.cards).map((c) => [c.key, c]))
				const kept = checks.slice(i * others.length, (i + 1) * others.length)
				return keysOf(i)
					.filter((k) => kept.every((c) => c.data?.has(k)))
					.flatMap((k) => byKey.get(k) ?? [])
			})
		: last.current
	if (done) last.current = cards
	const hasMore = done && chunks * CHUNK * DISCOVER_PAGE < cutTotal
	// A sparse cut: read on by itself until a page of titles shows (five chunks, 2,000 titles, at most).
	const thin = hasMore && cards.length < DISCOVER_PAGE && chunks < 5
	// biome-ignore lint/correctness/useExhaustiveDependencies: reads on once per finished chunk
	useEffect(() => {
		if (thin) more()
	}, [thin, chunks, cut])
	if (!on) return { cards: [] as TitleCard[], busy: false, hasMore: false, more }
	return { cards, busy: !done || thin, hasMore: hasMore && !thin, more }
}

/** The page size of Discover's results endpoint. */
const DISCOVER_PAGE = 40

/**
 * The grid's and the footer's list for a mood variant with AND picks (SectionVariant.useResults): the exact AND
 * count, and the AND list in Discover's order. Null while no "all of" group holds two picks (then Discover's list is it).
 */
export function useAndResults(d: ProtoDiscover): ResultsView | null {
	const picks = picksOf(d)
	const { any } = useAnyOf()
	const on = needsAnd(picks, any) && andCount(picks, any) <= MAX_AND
	const { counts, busy } = useAndCounts(d, on ? picks : [], any)
	const list = useAndList(d, picks, on, any)
	if (!on) return null
	return { total: counts?.total ?? null, cards: list.cards, loading: busy || list.busy, hasMore: list.hasMore, loadMore: list.more }
}

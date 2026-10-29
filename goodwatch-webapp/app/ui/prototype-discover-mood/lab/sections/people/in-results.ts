// PROTOTYPE (Discover lab, people): who is in a running search's results, counted by Discover's own results endpoint.
// No endpoint returns the credits of a list, so a pool of well-known people (pool.ts) is counted against the list:
// - pass 1: the pool in chunks of 20 (filter-state keeps 20 people), each as `people=` on the grid's own query. For a
//   picked person the endpoint answers what the list would hold without them, so total minus that is how many titles
//   only they bring within the chunk (a floor of their count).
// - pass 2: the best of those in pairs; with two people each answer is the other's exact count.
// People who only share titles with others of their chunk are missed. Every count is real.
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { searchEligibility } from "~/domain/discover-search"
import type { DiscoverResults } from "~/server/discover-results.server"
import { runDiscoverSearch } from "~/ui/discover/discover-search-request"
import type { ProtoDiscover } from "../../../kit"
import { POOL } from "./pool"
import type { Role } from "./roles"
import type { Person } from "./shared"

const CHUNK = 20
/** People per side counted exactly (one cache for every variant). */
const PER = 10

export interface CountedPerson extends Person {
	role: Role
	/** Titles of the current results they're credited on. */
	count: number
}

const DEPT: Record<Role, string> = { actors: "Acting", directors: "Directing", writers: "Writing", crew: "Crew" }

/** The pool, roles interleaved so a chunk rarely holds two people of one show. */
const POOLED: CountedPerson[] = (() => {
	const lists = (Object.keys(POOL) as Role[]).map((role) =>
		POOL[role].map(([id, name, profile, dept]) => ({ id, name, profile, department: dept ?? DEPT[role], popularity: 0, role, count: 0 })),
	)
	const out: CountedPerson[] = []
	for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) out.push(l[i])
	return out
})()

/** The search's ranked list (the kit runs the same query; this shares its cache). */
function useRanked(d: ProtoDiscover): string | null {
	const eligibility = searchEligibility(d.filters.state, { country: "US", services: [] })
	const search = useQuery({
		queryKey: ["proto-discover-search", d.q, JSON.stringify(eligibility)],
		enabled: d.q !== null,
		staleTime: 5 * 60_000,
		queryFn: ({ signal }) => runDiscoverSearch(d.q ?? "", eligibility, true, signal, () => {}),
	})
	return d.q !== null && search.data ? search.data.ranked.join(",") : null
}

/**
 * While a search runs: the pool's people in its results, most titles first, split into in front of and behind the
 * camera (ten each). Empty without a search.
 */
export function useResultPeople(d: ProtoDiscover) {
	const ranked = useRanked(d)
	const base = useMemo(() => {
		const p = new URLSearchParams(d.filters.query)
		p.delete("people")
		if (ranked) p.set("ranked", ranked)
		return p.toString()
	}, [d.filters.query, ranked])
	const on = d.q !== null && ranked !== null
	const q = useQuery({
		queryKey: ["lab-result-people", base],
		enabled: on,
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async ({ signal }) => {
			const counts = async (ids: number[]) => {
				const p = new URLSearchParams(base)
				p.set("people", ids.join(","))
				p.set("page", "1")
				const r = await fetch(`/api/discover/results?${p}`, { signal })
				if (!r.ok) throw new Error(`Results ${r.status}`)
				const j = (await r.json()) as DiscoverResults
				return { total: j.total, without: (j.optionCounts.people ?? {}) as Record<string, number> }
			}
			const chunks: CountedPerson[][] = []
			for (let i = 0; i < POOLED.length; i += CHUNK) chunks.push(POOLED.slice(i, i + CHUNK))
			const first = await Promise.all(chunks.map((c) => counts(c.map((x) => x.id))))
			const floor = chunks.flatMap((c, i) =>
				c.map((x) => ({ ...x, count: first[i].total - (first[i].without[String(x.id)] ?? first[i].total) })).filter((x) => x.count > 0),
			)
			floor.sort((a, b) => b.count - a.count)
			const front = floor.filter((x) => x.role === "actors").slice(0, PER)
			const behind = floor.filter((x) => x.role !== "actors").slice(0, PER)
			const best = [...front, ...behind]
			const exact = new Map<number, number>()
			const pairs: CountedPerson[][] = []
			for (let i = 0; i < best.length; i += 2) pairs.push(best.slice(i, i + 2))
			await Promise.all(
				pairs.map(async (pair) => {
					const r = await counts(pair.map((x) => x.id))
					if (pair.length === 1) exact.set(pair[0].id, r.total)
					else {
						exact.set(pair[0].id, r.without[String(pair[1].id)] ?? 0)
						exact.set(pair[1].id, r.without[String(pair[0].id)] ?? 0)
					}
				}),
			)
			const final = (list: CountedPerson[]) =>
				list.map((x) => ({ ...x, count: exact.get(x.id) ?? x.count })).sort((a, b) => b.count - a.count)
			return { actors: final(front), behind: final(behind) }
		},
	})
	return {
		/** A search is running (the lists are for its results). */
		active: d.q !== null,
		loading: d.q !== null && (!ranked || q.isLoading),
		failed: !!q.error,
		actors: q.data?.actors ?? [],
		behind: q.data?.behind ?? [],
	}
}

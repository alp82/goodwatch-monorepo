// The filter of a search, twice: as a Qdrant filter for the store queries, and as a row test on the title table for
// what the ranker computes in memory (reference titles, peers, the non-English mix statistics). Keep both halves in
// step with each other and with the current search's filter (qdrantFilter in reading-retrieval.server.ts).
import type {
	Eligibility,
	ReadingFlag,
} from "../combined-search/reading-retrieval.server.ts"
import {
	titlePointId,
	toQdrantMust,
} from "../combined-search/search-filters.ts"
import type { TitleTable } from "./search-index.server.ts"

// Mood-based discovery requires this many votes. The name index also includes recent and upcoming titles regardless
// of votes; apply the discovery threshold to both Qdrant and the in-memory rows. A lesser-known search removes it.
export const ELIGIBLE_VOTES = 2000
const SHOW_POINT_IDS = 2_000_000_000_000

export interface SearchFilter {
	/** The Qdrant filter. */
	qdrant: { must: unknown[]; must_not: unknown[] }
	/** Title table rows that pass: every condition the title table can check (not genres or streaming). */
	rows: Uint8Array
	/** The era's years, when the query names a decade or year that leaves titles. */
	era: { from: number; to: number } | null
}

type RowTest = (row: number) => boolean

/** The search's own filters that the title table can check, by Discover's names for them, and their hidden total. */
export interface FilterHides {
	/** The topic's titles that any of these filters keeps out. */
	hidden: number
	years?: number
	type?: number
	anime?: number
}

/**
 * For a topic search (search-reblend's discoverTopic), how many of the topic's titles each of the search's own
 * filters alone keeps out: they pass everything else the search requires (the eligibility line, the reading's flags,
 * the era, the other filters) and fail this one. Discover applies these filters in the search, so its own counts
 * can't see what they hide (ui/discover-bar/FilterMix.tsx). Null when the search sets none of them, or also a filter
 * the title table can't check (genres, services, people): a title it keeps out would be counted wrongly.
 */
export function filterHides(
	table: TitleTable,
	topic: ReadonlySet<number>,
	eligibility: Eligibility,
	flags: ReadingFlag[],
	era: { from: number; to: number } | null,
): FilterHides | null {
	const filters = eligibility.filters
	if (filters?.genres?.length || filters?.streaming || filters?.people?.length)
		return null
	const isShow = (row: number) => table.pointIds[row] >= SHOW_POINT_IDS
	const animeBit = table.flagNames.indexOf("is_anime")
	const tests: [Exclude<keyof FilterHides, "hidden">, RowTest][] = []
	if (filters?.type)
		tests.push(["type", (row) => isShow(row) === (filters.type === "show")])
	if (filters?.anime) {
		const only = filters.anime === "only"
		tests.push([
			"anime",
			(row) =>
				(animeBit >= 0 && ((table.flags[row] >> animeBit) & 1) === 1) === only,
		])
	}
	if (filters?.minYear !== undefined || filters?.maxYear !== undefined) {
		const min = filters.minYear ?? 0
		const max = filters.maxYear ?? Number.POSITIVE_INFINITY
		tests.push([
			"years",
			(row) =>
				table.years[row] > 0 &&
				table.years[row] >= min &&
				table.years[row] <= max,
		])
	}
	if (!tests.length) return null
	// Everything else the search requires, as searchFilter checks it without these filters.
	const others = searchFilter(
		table,
		flags,
		{
			...eligibility,
			filters: {
				...filters,
				type: undefined,
				anime: undefined,
				minYear: undefined,
				maxYear: undefined,
			},
		},
		era,
	).withEra.rows
	const out: FilterHides = { hidden: 0 }
	for (const [name] of tests) out[name] = 0
	for (const id of topic) {
		const row = table.rowOf.get(id)
		if (row === undefined || !others[row]) continue
		let failed: Exclude<keyof FilterHides, "hidden"> | null = null
		let fails = 0
		for (const [name, test] of tests)
			if (!test(row)) {
				failed = name
				fails++
			}
		if (fails) out.hidden++
		if (fails === 1 && failed) out[failed] = (out[failed] ?? 0) + 1
	}
	return out
}

/** The search's filter; the era applies only when some indexed title passes it. */
export function searchFilter(
	table: TitleTable,
	flags: ReadingFlag[],
	eligibility: Eligibility,
	era: { from: number; to: number } | null,
): { base: SearchFilter; withEra: SearchFilter } {
	const must: unknown[] = [
		...(eligibility.lesserKnown
			? []
			: [
					{
						key: "goodwatch_overall_score_voting_count",
						range: { gte: ELIGIBLE_VOTES },
					},
				]),
		...toQdrantMust(eligibility.filters),
	]
	const mustNot: unknown[] = [{ key: "adult", match: { value: true } }]
	const tests: RowTest[] = []
	if (!eligibility.lesserKnown)
		tests.push((row) => table.votes[row] >= ELIGIBLE_VOTES)
	const isShow = (row: number) => table.pointIds[row] >= SHOW_POINT_IDS
	const filters = eligibility.filters
	if (filters?.type)
		tests.push((row) => isShow(row) === (filters.type === "show"))
	if (filters?.anime) {
		const bit = table.flagNames.indexOf("is_anime")
		const only = filters.anime === "only"
		tests.push(
			(row) => (bit >= 0 && ((table.flags[row] >> bit) & 1) === 1) === only,
		)
	}
	if (filters?.minYear !== undefined) {
		const min = filters.minYear
		tests.push((row) => table.years[row] > 0 && table.years[row] >= min)
	}
	if (filters?.maxYear !== undefined) {
		const max = filters.maxYear
		tests.push((row) => table.years[row] > 0 && table.years[row] <= max)
	}
	if (filters?.onlyTitles) {
		const only = new Set(filters.onlyTitles.map(titlePointId))
		tests.push((row) => only.has(table.pointIds[row]))
	}
	for (const flag of flags) {
		if (!flag.decision) continue
		const wanted = flag.decision === "required"
		if (!wanted && flag.kind === "soft") continue
		if (flag.kind === "media" && filters?.type) continue
		// The anime filter decides anime, as the type filter decides movie or show: the reading's anime flag is left out.
		if (flag.condition.key === "is_anime" && filters?.anime) continue
		const { key, value } = flag.condition
		;(wanted ? must : mustNot).push({ key, match: { value } })
		let has: RowTest
		if (key === "media_type") has = (row) => isShow(row) === (value === "show")
		else if (key === "production_method")
			has = (row) => table.productionMethods[row] === value
		else {
			const bit = table.flagNames.indexOf(key)
			has =
				bit < 0 ? () => false : (row) => ((table.flags[row] >> bit) & 1) === 1
		}
		tests.push(wanted ? has : (row) => !has(row))
	}
	const rows = new Uint8Array(table.size)
	for (let row = 0; row < table.size; row++)
		rows[row] = tests.every((test) => test(row)) ? 1 : 0
	const base: SearchFilter = {
		qdrant: { must, must_not: mustNot },
		rows,
		era: null,
	}
	if (!era) return { base, withEra: base }
	const eraRows = new Uint8Array(table.size)
	let any = false
	for (let row = 0; row < table.size; row++) {
		const y = table.years[row]
		if (rows[row] && y >= era.from && y <= era.to) {
			eraRows[row] = 1
			any = true
		}
	}
	if (!any) return { base, withEra: base }
	return {
		base,
		withEra: {
			qdrant: {
				must: [
					...must,
					{ key: "release_year", range: { gte: era.from, lte: era.to } },
				],
				must_not: mustNot,
			},
			rows: eraRows,
			era,
		},
	}
}

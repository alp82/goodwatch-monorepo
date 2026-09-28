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

// The indexed titles: at least this many votes and not adult. A normal search ranks only these. A lesser-known search
// ranks every title that isn't adult; the title table still holds only the indexed ones, so the row test below covers
// those, and the ranker reads the other titles' facts from Qdrant (rank-search.server.ts).
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
	const isShow = (row: number) => table.pointIds[row] >= SHOW_POINT_IDS
	const filters = eligibility.filters
	if (filters?.type)
		tests.push((row) => isShow(row) === (filters.type === "show"))
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

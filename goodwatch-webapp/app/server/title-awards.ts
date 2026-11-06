import type { TitleAwardResult } from "../domain/title-award-list.ts"

/** Source-independent reported observations; partial coverage cannot establish historical totals. */
export type AwardSource = "TVDB" | "Wikidata"
export interface AwardResult {
	sources?: AwardSource[]
	references?: string[]
	ceremony?: string
	award: string
	category: string
	year: string
}

export interface TitleAwards {
	coverage: "partial"
	note: string
	source: AwardSource | "multiple"
	sources?: AwardSource[]
	wins: AwardResult[]
	nominations: AwardResult[]
	truncated?: true
}

export interface AwardDisplayRow {
	source_names?: string[]
	reference_urls?: string[]
	ceremony_label?: string | null
	award_name: string
	category_name: string
	ceremony_year: string
	has_win: boolean
	has_nomination: boolean
}

const prestige = [
	"Academy Awards",
	"Primetime Emmy Awards",
	"Golden Globe Awards",
	"BAFTA Awards",
]
const rank = (name: string) => {
	const index = prestige.indexOf(name)
	return index < 0 ? prestige.length : index
}
const compareName = (a: string, b: string) => a.localeCompare(b, "en")

export function summarizeTitleAwards(
	rows: readonly AwardDisplayRow[],
): TitleAwards | undefined {
	if (!rows.length) return undefined
	const ordered = rows
		.map((row) => ({
			...row,
			award_name: String(row.award_name ?? ""),
			category_name: String(row.category_name ?? ""),
			ceremony_year: String(row.ceremony_year ?? ""),
		}))
		.sort(
			(a, b) =>
				compareName(b.ceremony_year, a.ceremony_year) ||
				rank(a.award_name) - rank(b.award_name) ||
				compareName(a.award_name, b.award_name) ||
				compareName(a.category_name, b.category_name),
		)
	const sourcesOf = (row: AwardDisplayRow): AwardSource[] =>
		row.source_names
			? row.source_names.filter(
					(s): s is AwardSource => s === "TVDB" || s === "Wikidata",
				)
			: ["TVDB"]
	const sources = [...new Set(ordered.flatMap(sourcesOf))].sort()
	const metadata = ordered.some((r) => r.source_names !== undefined)
	const safeReference = (value: string) => {
		try {
			const url = new URL(value)
			return (
				["https:", "http:"].includes(url.protocol) &&
				!url.username &&
				!url.password
			)
		} catch {
			return false
		}
	}
	const entry = (row: AwardDisplayRow): AwardResult => ({
		award: row.award_name,
		category: row.category_name,
		year: row.ceremony_year,
		...(row.source_names
			? {
					sources: sourcesOf(row),
					references: (row.reference_urls ?? []).filter(safeReference),
					...(row.ceremony_label ? { ceremony: row.ceremony_label } : {}),
				}
			: {}),
	})
	const wins = ordered.filter((row) => row.has_win)
	const nominations = ordered.filter(
		(row) => !row.has_win && row.has_nomination,
	)
	return {
		coverage: "partial",
		note: `Reported results from ${sources.join(" and ") || "available sources"}. Coverage is incomplete, so these results don't establish award totals.`,
		source: sources.length === 1 ? sources[0] : "multiple",
		...(metadata ? { sources } : {}),
		wins: wins.slice(0, 25).map(entry),
		nominations: nominations.slice(0, 25).map(entry),
		...(wins.length > 25 || nominations.length > 25 ? { truncated: true } : {}),
	}
}

/**
 * Every reported result of the title, uncapped (the view holds at most about 100 per title), for the title page's
 * "N awards" link and At a glance's Awards row. Rows reported as neither won nor nominated are left out.
 */
export function awardResults(
	rows: readonly AwardDisplayRow[],
): TitleAwardResult[] {
	return rows
		.filter((row) => row.has_win || row.has_nomination)
		.map((row) => ({
			award: String(row.award_name ?? ""),
			category: String(row.category_name ?? ""),
			year: String(row.ceremony_year ?? ""),
			won: Boolean(row.has_win),
		}))
}

/** Title page loader data: only the wins its JSON-LD lists, so the page payload stays small. */
export const pageAwards = (
	awards: TitleAwards | undefined,
): TitleAwards | undefined =>
	awards?.wins.length
		? { ...awards, wins: awards.wins.slice(0, 20), nominations: [] }
		: undefined

export const jsonLdAwards = (awards: TitleAwards | undefined): string[] =>
	(awards?.wins ?? [])
		.slice(0, 20)
		.map(({ award, category, year }) => `${award} – ${category} (${year})`)

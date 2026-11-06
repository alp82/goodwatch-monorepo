/** Title-level observations only; TVDB coverage cannot establish historical totals. */
export interface AwardResult {
	award: string
	category: string
	year: string
}

export interface TitleAwards {
	coverage: "partial"
	note: string
	source: "TVDB"
	wins: AwardResult[]
	nominations: AwardResult[]
	truncated?: true
}

export interface AwardDisplayRow {
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
	const ordered = [...rows].sort(
		(a, b) =>
			compareName(b.ceremony_year, a.ceremony_year) ||
			rank(a.award_name) - rank(b.award_name) ||
			compareName(a.award_name, b.award_name) ||
			compareName(a.category_name, b.category_name),
	)
	const entry = (row: AwardDisplayRow): AwardResult => ({
		award: row.award_name,
		category: row.category_name,
		year: row.ceremony_year,
	})
	const wins = ordered.filter((row) => row.has_win)
	const nominations = ordered.filter(
		(row) => !row.has_win && row.has_nomination,
	)
	return {
		coverage: "partial",
		note: "Reported results from TVDB. Coverage is incomplete, so these results don't establish award totals.",
		source: "TVDB",
		wins: wins.slice(0, 25).map(entry),
		nominations: nominations.slice(0, 25).map(entry),
		...(wins.length > 25 || nominations.length > 25 ? { truncated: true } : {}),
	}
}

export const jsonLdAwards = (awards: TitleAwards | undefined): string[] =>
	(awards?.wins ?? [])
		.slice(0, 20)
		.map(({ award, category, year }) => `${award} – ${category} (${year})`)

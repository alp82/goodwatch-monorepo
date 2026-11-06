import {
	type AwardDisplayRow,
	type TitleAwards,
	summarizeTitleAwards,
} from "./title-awards.ts"

export interface AwardWork {
	name: string
	kind: string
	media_type?: "movie" | "show"
	media_tmdb_id?: number
}
export interface PersonAwardRow extends AwardDisplayRow {
	result_id: string
	works_json: string | null
	portrayals_json?: string | null
}
export interface PersonAwards {
	results: (NonNullable<TitleAwards>["wins"][number] & {
		won: boolean
		works: AwardWork[]
		portrayals: {
			character_name?: string
			credit_id: string
			media_type: "movie" | "show"
			media_tmdb_id: number
		}[]
	})[]
	coverage: "partial"
	note: string
}

export function summarizePersonAwards(
	rows: readonly PersonAwardRow[],
): PersonAwards | undefined {
	if (!rows.length) return undefined
	const ordered = [...rows].sort(
		(a, b) =>
			Number(b.has_win) - Number(a.has_win) ||
			String(b.ceremony_year).localeCompare(String(a.ceremony_year)),
	)
	const results = ordered.slice(0, 20).flatMap((row) => {
		const summary = summarizeTitleAwards([row])
		const result = summary?.wins[0] ?? summary?.nominations[0]
		if (!result) return []
		let works: AwardWork[] = []
		try {
			const parsed: unknown = JSON.parse(row.works_json ?? "[]")
			if (Array.isArray(parsed))
				works = parsed.filter(
					(work): work is AwardWork =>
						!!work &&
						typeof work === "object" &&
						typeof work.name === "string" &&
						typeof work.kind === "string",
				)
		} catch {
			/* The award remains usable when its optional work context is unavailable. */
		}
		let portrayals: PersonAwards["results"][number]["portrayals"] = []
		try {
			const parsed: unknown = JSON.parse(row.portrayals_json ?? "[]")
			if (Array.isArray(parsed))
				portrayals = parsed
					.filter(
						(p) =>
							p?.link_status === "verified" &&
							typeof p.credit_id === "string" &&
							(p.media_type === "movie" || p.media_type === "show") &&
							Number.isSafeInteger(p.media_tmdb_id),
					)
					.map((p) => ({
						credit_id: p.credit_id,
						media_type: p.media_type,
						media_tmdb_id: p.media_tmdb_id,
						...(typeof p.character_name === "string"
							? { character_name: p.character_name }
							: {}),
					}))
		} catch {
			/* Optional character evidence cannot erase an award. */
		}
		return [{ ...result, won: row.has_win, works, portrayals }]
	})
	return results.length
		? {
				results,
				coverage: "partial",
				note: "Reported results for this person. Coverage is incomplete; these results don't establish award totals.",
			}
		: undefined
}

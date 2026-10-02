// Decides what an import does with each row of the file. Pure: the caller supplies what the catalog and the
// member's ratings hold. Every row gets exactly one outcome, so the counts add up to the number of rows.
import {
	IMDB_IMPORT_OUTCOMES,
	type ImdbImportCounts,
	type ImdbImportOutcome,
} from "~/domain/imdb-import"
import type { FileRow, ImportMediaType } from "./file.server"

/** `movie:603`. Identifies a GoodWatch title in the lookups below. */
export const titleRef = (mediaType: ImportMediaType, tmdbId: number) => `${mediaType}:${tmdbId}`
/** `movie:tt0133093`. An IMDb ID is looked up in the table its title type belongs to. */
export const catalogRef = (mediaType: ImportMediaType, imdbId: string) => `${mediaType}:${imdbId}`

export interface ClassifyContext {
	/** The canonical TMDB IDs the catalog holds for an IMDb ID, by catalogRef. More than one is ambiguous. */
	catalog: Map<string, number[]>
	/** The member's GoodWatch ratings, by titleRef. */
	scores: Map<string, number>
	/** The score the member's latest IMDb import wrote for a title, by titleRef. Undone imports don't count. */
	lastApplied: Map<string, number>
}

export interface ClassifiedRow extends FileRow {
	outcome: ImdbImportOutcome
	reason: string | null
	tmdbId: number | null
	/** The member's GoodWatch rating now. */
	currentScore: number | null
}

export function classifyRows(rows: FileRow[], context: ClassifyContext): ClassifiedRow[] {
	const classified = rows.map((row): ClassifiedRow => {
		const base = { ...row, tmdbId: null, currentScore: null }
		if (row.problem || !row.mediaType) return { ...base, outcome: row.problem?.outcome ?? "invalid", reason: row.problem?.reason ?? null }
		const found = context.catalog.get(catalogRef(row.mediaType, row.imdbId)) ?? []
		if (found.length === 0) return { ...base, outcome: "unmatched", reason: "This title isn't in the GoodWatch catalog." }
		if (found.length > 1)
			return { ...base, outcome: "unmatched", reason: "This IMDb ID belongs to more than one GoodWatch title, so it can't be matched safely." }
		// Decided below, once rows that share a title are known.
		return { ...base, tmdbId: found[0], outcome: "new", reason: null }
	})

	const byTitle = new Map<string, ClassifiedRow[]>()
	for (const row of classified) {
		if (row.tmdbId === null || !row.mediaType) continue
		const ref = titleRef(row.mediaType, row.tmdbId)
		byTitle.set(ref, [...(byTitle.get(ref) ?? []), row])
	}

	for (const [ref, group] of byTitle) {
		if (new Set(group.map((row) => row.score)).size > 1) {
			for (const row of group) {
				row.outcome = "invalid"
				row.reason = "This title is in the file more than once with different ratings."
			}
			continue
		}
		// The same title with the same rating counts once.
		for (const extra of group.slice(1)) {
			extra.outcome = "invalid"
			extra.reason = "This title is in the file more than once. The first row is used."
		}

		const row = group[0]
		const current = context.scores.get(ref) ?? null
		const applied = context.lastApplied.get(ref) ?? null
		row.currentScore = current
		if (current === null) {
			if (applied !== null) {
				row.outcome = "conflict"
				row.reason = "You removed this rating in GoodWatch after an earlier import."
			}
		} else if (current === row.score) {
			row.outcome = "unchanged"
		} else if (current === applied) {
			row.outcome = "update"
		} else {
			row.outcome = "conflict"
			row.reason = `You rated this ${current} in GoodWatch.`
		}
	}
	return classified
}

export function countOutcomes(rows: { outcome: ImdbImportOutcome }[]): ImdbImportCounts {
	const counts = { rows: rows.length } as ImdbImportCounts
	for (const outcome of IMDB_IMPORT_OUTCOMES) counts[outcome] = 0
	for (const row of rows) counts[row.outcome]++
	return counts
}

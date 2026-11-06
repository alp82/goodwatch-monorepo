import { optionalTitlePart } from "./title-page-budget.ts"
import { summarizeTitleAwards, type AwardDisplayRow } from "./title-awards.ts"

type AwardQuery = (
	sql: string,
	args: (string | number)[],
	signal: AbortSignal,
) => Promise<AwardDisplayRow[]>

/** One indexed title scope, inside the details cache fill. Bound even a reader that ignores abort. */
export async function readTitleAwards(
	query: AwardQuery,
	mediaType: "movie" | "show",
	tmdbId: number,
	budgetMs = 200,
) {
	const result = await optionalTitlePart(
		"awards",
		(signal) =>
			query(
				`SELECT award_name, category_name, ceremony_year, has_win, has_nomination
		 FROM doc.tvdb_award_display WHERE media_type = ? AND media_tmdb_id = ?`,
				[mediaType, tmdbId],
				signal,
			),
		budgetMs,
	)
	return result.complete ? summarizeTitleAwards(result.value) : undefined
}

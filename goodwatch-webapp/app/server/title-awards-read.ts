import { optionalTitlePart } from "./title-page-budget.ts"
import type { TitleAwardResult } from "../domain/title-award-list.ts"
import {
	type AwardDisplayRow,
	type TitleAwards,
	awardResults,
	summarizeTitleAwards,
} from "./title-awards.ts"

type AwardQuery = (
	sql: string,
	args: (string | number)[],
	signal: AbortSignal,
) => Promise<AwardDisplayRow[]>

export interface TitleAwardData {
	/** The bounded summary that JSON-LD and MCP read. */
	awards: TitleAwards
	/** Every result, for the title page and At a glance. */
	results: TitleAwardResult[]
}

/**
 * One indexed title scope, inside the details cache fill. Bound even a reader that ignores abort. A title without
 * rows reads undefined; a read that missed its budget or failed is "late", so the cache can keep the title for less
 * than its lifetime and fill the awards in on a later refresh (title-details-cache.ts).
 */
export async function readTitleAwardData(
	query: AwardQuery,
	mediaType: "movie" | "show",
	tmdbId: number,
	budgetMs = 200,
): Promise<TitleAwardData | undefined | "late"> {
	const result = await optionalTitlePart(
		"awards",
		(signal) =>
			query(
				`SELECT award_name, category_name, ceremony_year, has_win, has_nomination, source_names, reference_urls, ceremony_label
		 FROM doc.award_title_display WHERE media_type = ? AND media_tmdb_id = ?`,
				[mediaType, tmdbId],
				signal,
			).then((rows): TitleAwardData | undefined => {
				const awards = summarizeTitleAwards(rows)
				return awards ? { awards, results: awardResults(rows) } : undefined
			}),
		budgetMs,
	)
	return result.complete ? result.value : "late"
}

/** The bounded summary alone; a late read is no summary. */
export const readTitleAwards = (
	...args: Parameters<typeof readTitleAwardData>
): Promise<TitleAwards | undefined> =>
	readTitleAwardData(...args).then((data) =>
		data === "late" ? undefined : data?.awards,
	)

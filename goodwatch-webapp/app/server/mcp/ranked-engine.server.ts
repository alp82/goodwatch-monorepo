import { combinedSearch } from "../combined-search/search.server"
import { RESULT_LENGTH } from "../search-ranking/ranking.server"
import { BASIC_SEARCH_MESSAGE } from "../search-runtime/runtime.server"
import type { RankedBatch } from "./ranked.server.ts"

/** Invoked only after the member quota and the process's shared admission have accepted the search. */
export async function runRankedSearch(
	query: string,
	userId: string,
	signal: AbortSignal,
): Promise<RankedBatch> {
	const batch = await combinedSearch(
		query,
		{ includeAdult: false, lesserKnown: false },
		{ accountId: userId, networkIdentity: "mcp-authenticated" },
		signal,
		undefined,
		{ allTitles: true, rows: RESULT_LENGTH },
	)
	return {
		titles: batch.rows.slice(0, RESULT_LENGTH).map((row) => {
			const [type, id] = row.key.split(":")
			return {
				media_type: type === "show" ? "show" : "movie",
				tmdb_id: Number(id),
				title: row.title,
				release_year: row.year ? Number(row.year) : null,
			}
		}),
		ranked: !batch.errors.includes(BASIC_SEARCH_MESSAGE),
		messages: batch.errors,
		chargedNano: batch.chargedNano,
	}
}

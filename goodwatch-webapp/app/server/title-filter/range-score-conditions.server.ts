// These facts are absent from the published snapshot. In particular, releaseDays is a show's last air date,
// not its release year. Keep each SQL predicate separate so each group has its own recovery.
import {
	SOURCE_KEYS,
	type FilterState,
	type SourceKey,
} from "~/domain/filter-state"

export const RANGE_SCORE_FILTERS = [
	"years",
	"runtime",
	"sourceScores",
	"scoreGap",
] as const
export type RangeScoreFilter = (typeof RANGE_SCORE_FILTERS)[number]
const SOURCE_COLUMNS: Record<SourceKey, string> = {
	imdb: "imdb_user_score_normalized_percent",
	rtCritics: "rotten_tomatoes_tomato_score_normalized_percent",
	rtAudience: "rotten_tomatoes_audience_score_normalized_percent",
	metacritic: "metacritic_meta_score_normalized_percent",
	metacriticUsers: "metacritic_user_score_normalized_percent",
}

export function rangeScoreConditions(
	state: FilterState,
	name: RangeScoreFilter,
	type: "movie" | "show",
) {
	const conditions: string[] = []
	const params: number[] = []
	if (name === "years" || name === "runtime") {
		const range = state[name]
		const column =
			name === "years"
				? "release_year"
				: type === "movie"
					? "runtime"
					: "episode_runtime[1]"
		if (range?.min !== undefined) {
			conditions.push(`${column} >= ?`)
			params.push(range.min)
		}
		if (range?.max !== undefined) {
			conditions.push(`${column} <= ?`)
			params.push(range.max)
		}
	} else if (name === "sourceScores") {
		for (const key of SOURCE_KEYS) {
			const min = state.sourceScores?.[key]
			if (min !== undefined) {
				conditions.push(`${SOURCE_COLUMNS[key]} >= ?`)
				params.push(min)
			}
		}
	} else if (state.scoreGap) {
		// SQL NULL comparisons fail, including when both fallback sources on either side are absent.
		const critics = `COALESCE(${SOURCE_COLUMNS.rtCritics}, ${SOURCE_COLUMNS.metacritic})`
		const audiences = `COALESCE(${SOURCE_COLUMNS.imdb}, ${SOURCE_COLUMNS.rtAudience})`
		conditions.push(
			state.scoreGap === "agree"
				? `ABS(${critics} - ${audiences}) <= 5 AND ${critics} >= 70`
				: state.scoreGap === "critics"
					? `${critics} - ${audiences} >= 15`
					: `${audiences} - ${critics} >= 15`,
		)
	}
	return { conditions, params }
}

import type { CardTitle } from "~/ui/MovieTvCard"
import type { RecTitle } from "./api"

/** A pick in the shape the poster card reads. */
export const cardTitle = (pick: RecTitle): CardTitle => ({
	tmdb_id: Number(pick.id.slice(pick.id.indexOf("-") + 1)),
	title: pick.name,
	release_year: pick.year,
	poster_path: pick.poster,
	goodwatch_overall_score_normalized_percent: pick.gwScore,
})

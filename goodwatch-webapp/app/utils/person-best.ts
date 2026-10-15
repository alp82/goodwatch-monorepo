import {
	copyMediaPresentation,
	type PresentedMedia,
} from "./media-presentation.ts"

/** Preserve the winning credit's field language and canonical URL identity in the compact stats projection. */
export function personBestCredit(
	best:
		| (PresentedMedia & {
				title: string
				score: number | null
				poster_path: string | null
				media_type: "movie" | "show"
				tmdb_id: number
				release_year: number | null
		  })
		| undefined,
) {
	return best
		? {
				...copyMediaPresentation(best),
				title: best.title,
				score: best.score ?? 0,
				poster_path: best.poster_path,
				media_type: best.media_type,
				tmdb_id: best.tmdb_id,
				release_year: best.release_year,
			}
		: null
}

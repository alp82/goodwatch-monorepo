import { useMemo } from "react"
import { useMovieCollection } from "~/routes/api.movie.collection"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { type CollectionMovie, titleQuestions } from "~/ui/details/titleQuestions"

/**
 * The title's questions, with a movie's collection as the collection section reads it. The document carries the
 * collection, so the server and the first render on the client ask the same questions.
 */
export function useTitleQuestions(media: MovieResult | ShowResult, country: string) {
	const series = media.mediaType === "movie" ? media.movie_series : undefined
	const collection = useMovieCollection({
		collectionId: series?.id ? String(series.id) : "",
		movieIds: (series?.movie_ids ?? []).join(","),
	}).data?.movies as CollectionMovie[] | undefined
	return useMemo(() => titleQuestions(media, country, { collection }), [media, country, collection])
}

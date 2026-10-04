// Puts what a title page used to request after load into the document: the genre links of its header and, for a
// movie in a collection, the collection's movies. A lookup that fails or outlasts the budget is left out, and the
// browser requests it as before.
import {
	type DehydratedState,
	QueryClient,
	dehydrate,
} from "@tanstack/react-query"
import {
	type GenreLink,
	HEADER_GENRE_COUNT,
	genreLinksOf,
	genreLinksQueryKey,
	movieCollectionQueryKey,
} from "~/utils/title-extras"

export interface TitleExtrasParams {
	/** The title's genre names. */
	genres: readonly string[] | null | undefined
	/** A movie's collection, when it is part of one. */
	movieSeries?: { id: number; movie_ids: number[] } | null
	/** How long the document waits for the lookups. */
	budgetMs: number
	/** Where the data comes from. */
	lookups: {
		genres: () => Promise<GenreLink[]>
		collection: (params: {
			collectionId: string
			movieIds: string
		}) => Promise<unknown>
	}
}

export async function prefetchTitleExtras({
	genres: names,
	movieSeries,
	budgetMs,
	lookups,
}: TitleExtrasParams): Promise<DehydratedState> {
	const client = new QueryClient()
	const work: Promise<unknown>[] = []
	const report = (what: string) => (error: unknown) =>
		console.error(`Title page ${what} prefetch failed`, {
			error: error instanceof Error ? error.message : error,
		})

	const headerGenres = (names ?? []).slice(0, HEADER_GENRE_COUNT)
	if (headerGenres.length)
		work.push(
			Promise.resolve()
				.then(lookups.genres)
				.then((list) =>
					client.setQueryData(
						genreLinksQueryKey(headerGenres),
						genreLinksOf(list, headerGenres),
					),
				)
				.catch(report("genres")),
		)

	const collectionId = movieSeries?.id ? String(movieSeries.id) : ""
	const movieIds = (movieSeries?.movie_ids ?? []).join(",")
	if (collectionId && movieIds)
		work.push(
			Promise.resolve()
				.then(() => lookups.collection({ collectionId, movieIds }))
				.then((collection) =>
					client.setQueryData(
						movieCollectionQueryKey(collectionId, movieIds),
						collection,
					),
				)
				.catch(report("collection")),
		)

	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		await Promise.race([
			Promise.all(work),
			new Promise<void>((resolve) => {
				// As in related-prefetch.ts: answers that arrived while a late timer waited win over the timer.
				timer = setTimeout(() => setImmediate(resolve), budgetMs)
			}),
		])
	} finally {
		clearTimeout(timer)
	}
	// Holds what finished within the budget.
	return dehydrate(client)
}

// The genre links in a title page's header and the movies of a movie's collection. Both come with the document: the
// title loader puts them into the query cache (see server/title-extras.server.ts), so a title page sends no request
// for them. The hooks below fetch only when the loader left one out, for example after its time budget ran out.
import type { DehydratedState } from "@tanstack/react-query"

export interface GenreLink {
	id: number
	name: string
}

/** A title page's header links this many of the title's genres. */
export const HEADER_GENRE_COUNT = 2

/** The genres of the full list that a title names, in the list's order. */
export const genreLinksOf = (
	allGenres: readonly GenreLink[],
	names: readonly string[],
): GenreLink[] => allGenres.filter((genre) => names.includes(genre.name))

export const genreLinksQueryKey = (names: readonly string[]) =>
	["genre-links", ...names] as const

export const movieCollectionQueryKey = (
	collectionId: string,
	movieIds: string,
) => ["movie-collection", collectionId, movieIds] as const

// Genre names and a collection's movies don't depend on the viewer, and the server keeps both for a day. Data that
// came with the document is never requested again: not on window focus, and not when the document itself came from
// a cache and its embedded data is older than the default stale time.
export const TITLE_EXTRAS_STALE_TIME = Number.POSITIVE_INFINITY

/** One state for the hydration boundary from the states of several prefetches. */
export const mergeDehydratedStates = (
	...states: (DehydratedState | null | undefined)[]
): DehydratedState => ({
	mutations: states.flatMap((state) => state?.mutations ?? []),
	queries: states.flatMap((state) => state?.queries ?? []),
})

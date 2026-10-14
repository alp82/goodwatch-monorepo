import type { LoaderFunction } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getGenresUnique } from "~/server/genres.server"
import {
	type GenreLink,
	TITLE_EXTRAS_STALE_TIME,
	genreLinksOf,
	genreLinksQueryKey,
} from "~/utils/title-extras"

export const loader: LoaderFunction = async () => {
	return await getGenresUnique()
}

// Query hook

/** The genre links of a title page's header. They come with the document; see utils/title-extras.ts. */
export const useGenreLinks = (names: readonly string[]) =>
	useQuery<GenreLink[]>({
		queryKey: genreLinksQueryKey(names),
		enabled: names.length > 0,
		queryFn: async () =>
			genreLinksOf(await (await fetch("/api/genres/all")).json(), names),
		// See TITLE_EXTRAS_STALE_TIME for the reason.
		staleTime: TITLE_EXTRAS_STALE_TIME,
	})


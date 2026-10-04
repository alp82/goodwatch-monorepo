// The title page's extras from the data cache and Crate. See title-extras-prefetch.ts for what they are.
import { getMoviesInCollection } from "~/server/collection.server"
import { getGenresUnique } from "~/server/genres.server"
import {
	type TitleExtrasParams,
	prefetchTitleExtras,
} from "~/server/title-extras-prefetch"
import type { GenreLink } from "~/utils/title-extras"

// The genre list is the same for every title and changes a few times a year, so the process keeps it and title
// pages don't each read it from the data cache.
const GENRES_KEEP_MS = 60 * 60 * 1000
let genres: { at: number; list: Promise<GenreLink[]> } | null = null

const allGenres = (now: number): Promise<GenreLink[]> => {
	if (!genres || now - genres.at > GENRES_KEEP_MS) {
		const list = getGenresUnique()
		const entry = { at: now, list }
		genres = entry
		// A failed read isn't kept, so the next page tries again.
		list.catch(() => {
			if (genres === entry) genres = null
		})
	}
	return genres.list
}

export const prefetchTitleExtrasState = (
	params: Omit<TitleExtrasParams, "lookups">,
) =>
	prefetchTitleExtras({
		...params,
		lookups: {
			genres: () => allGenres(Date.now()),
			collection: getMoviesInCollection,
		},
	})

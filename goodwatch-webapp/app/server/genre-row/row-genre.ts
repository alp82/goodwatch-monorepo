// The genre of a title page's genre row. Usually the breadcrumb's, but a title for children or families gets a row of
// its own kind: Kids or Family wins when the sitemap lists its genre page for the media type, so the row reads
// "More kids shows" or "More family movies" and links there. A Kids or Family title never gets a row of other titles:
// whichever genre the row shows, it takes only Kids or Family titles.
import {
	type TitleGenrePage,
	genrePage,
	titleGenrePage,
} from "~/server/title-breadcrumb.server"
import {
	FLAG_ADULT,
	FLAG_POSTER,
	type TitleColumns,
} from "~/server/title-snapshot/index.server"
import { type TitleKey, titleKey } from "~/utils/title-key"
import type { GenreRowCandidate } from "./pick"

/** The TMDB genres of titles for children or families, the narrower first. */
export const YOUNG_GENRES: readonly string[] = ["Kids", "Family"]

export interface RowGenre {
	page: TitleGenrePage
	/** The row takes only titles with a Kids or Family genre. */
	young: boolean
}

/**
 * The genre row's genre page: Kids, then Family, when the sitemap lists its page for the media type, else the
 * breadcrumb's genre (the first in TMDB's order with a page).
 */
export function rowGenre(
	mediaType: "movie" | "show",
	genres: readonly string[] | null | undefined,
	listed: ReadonlySet<string>,
): RowGenre | null {
	const young = (genres ?? []).some((genre) => YOUNG_GENRES.includes(genre))
	// Kids before Family: a title with both is for children, and TMDB tags family sitcoms Family too.
	for (const genre of YOUNG_GENRES) {
		if (!genres?.includes(genre)) continue
		const page = genrePage(mediaType, genre)
		if (page && listed.has(page.path)) return { page, young }
	}
	const page = titleGenrePage(mediaType, genres)
	return page ? { page, young } : null
}

/** The paths a sitemap file lists on goodwatch.app, such as `/shows/genres/kids`. */
export function sitemapPaths(xml: string): Set<string> {
	return new Set(
		[...xml.matchAll(/<loc>https:\/\/goodwatch\.app(\/[^<]*)<\/loc>/g)].map(
			(match) => match[1],
		),
	)
}

/** The titles a genre row picks from: the sitemap's first, the genre's most voted others to fill a short row. */
export interface Pool {
	preferred: GenreRowCandidate[]
	fallback: GenreRowCandidate[]
}

/**
 * The genre's titles of the media type with a poster and no adult flag, from one pass over the snapshot's columns.
 * Young keeps only titles with a Kids or Family genre, in both parts.
 */
export function genrePool(
	columns: Pick<
		TitleColumns,
		"pointIds" | "genres" | "genreNames" | "votes" | "flags"
	>,
	options: {
		mediaType: "movie" | "show"
		genre: string
		young: boolean
		/** The sitemap's titles. */
		preferred: ReadonlySet<TitleKey>
		fallbackSize: number
	},
): Pool {
	const { pointIds, genres, genreNames, votes, flags } = columns
	const pool: Pool = { preferred: [], fallback: [] }
	const bit = genreNames.indexOf(options.genre)
	if (bit < 0) return pool
	const youngBits = YOUNG_GENRES.reduce((bits, youngGenre) => {
		const at = genreNames.indexOf(youngGenre)
		return at >= 0 ? bits | (1 << at) : bits
	}, 0)
	const low = titleKey(options.mediaType, 0)
	const high =
		options.mediaType === "movie"
			? titleKey("show", 0)
			: Number.POSITIVE_INFINITY
	const others: GenreRowCandidate[] = []
	for (let row = 0; row < pointIds.length; row++) {
		const key = pointIds[row]
		if (key < low || key >= high) continue
		if (!(genres[row] & (1 << bit))) continue
		if (options.young && !(genres[row] & youngBits)) continue
		if (!(flags[row] & FLAG_POSTER) || flags[row] & FLAG_ADULT) continue
		const title = { key, votes: votes[row] }
		;(options.preferred.has(key) ? pool.preferred : others).push(title)
	}
	pool.fallback = others
		.sort((a, b) => b.votes - a.votes || a.key - b.key)
		.slice(0, options.fallbackSize)
	return pool
}

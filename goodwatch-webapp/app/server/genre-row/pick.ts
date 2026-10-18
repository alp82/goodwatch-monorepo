// Which titles a title page's genre row ("More drama movies") shows. Pure, so tests can run it without the title
// snapshot: genre-row.server.ts hands it the genre's titles.
//
// Titles in the sitemap come first, so that the links reach the pages Google is asked to index. A hash of the page
// and the candidate picks among them, so that every candidate gets about the same number of links across pages and a
// page always gets the same row: the page cache and Google see one row. The row then lists its picks by votes.
import { seededRandomMixed } from "~/utils/random"
import type { TitleKey } from "~/utils/title-key"

export const GENRE_ROW_SIZE = 8

export interface GenreRowCandidate {
	key: TitleKey
	votes: number
}

export interface GenreRowPick {
	/** The page's title. Never in its own row. */
	page: TitleKey
	/** The genre's titles in the sitemap, of the page's media type. */
	preferred: readonly GenreRowCandidate[]
	/** The genre's other titles, to fill a row the sitemap leaves short. */
	fallback: readonly GenreRowCandidate[]
	/** Titles the page already shows elsewhere: the related map and the movie's collection. */
	exclude: ReadonlySet<TitleKey>
	size?: number
}

/** The page's place for a candidate: the same for the same page and candidate, spread evenly between pages. */
const draw = (page: TitleKey, key: TitleKey) =>
	seededRandomMixed(`${page}:${key}`)

/**
 * The candidates in the order the row takes them, up to `size`: the sitemap titles by the page's draw, then the
 * others. Taking the first few that a later exclusion leaves gives the same titles as ranking with that exclusion.
 */
export function rankGenreRow({
	page,
	preferred,
	fallback,
	exclude,
	size = GENRE_ROW_SIZE,
}: GenreRowPick): GenreRowCandidate[] {
	const taken = new Set<TitleKey>([page])
	const ranked: GenreRowCandidate[] = []
	for (const tier of [preferred, fallback]) {
		if (ranked.length >= size) break
		const open = tier
			.filter((title) => !taken.has(title.key) && !exclude.has(title.key))
			.map((title) => ({ title, at: draw(page, title.key) }))
			.sort((a, b) => a.at - b.at || a.title.key - b.title.key)
		for (const { title } of open) {
			if (ranked.length >= size) break
			if (taken.has(title.key)) continue
			taken.add(title.key)
			ranked.push(title)
		}
	}
	return ranked
}

/** Up to `size` titles for the page's row, most voted first. */
export function pickGenreRow(input: GenreRowPick): GenreRowCandidate[] {
	return rankGenreRow(input).sort((a, b) => b.votes - a.votes || a.key - b.key)
}

/**
 * The titles a sitemap file lists, from its `goodwatch-selection` comment (scripts/sitemap_selection.py writes it):
 * the core titles and this month's attention titles. Empty when the file has no such comment.
 */
export function sitemapSelection(xml: string): number[] {
	const match = /<!--goodwatch-selection (.*?)-->/s.exec(xml)
	if (!match) return []
	const state = JSON.parse(match[1]) as { core?: unknown; attention?: unknown }
	return [state.core, state.attention]
		.flatMap((ids) => (Array.isArray(ids) ? ids : []))
		.filter((id): id is number => Number.isSafeInteger(id))
}

// Genre page labels that don't read well as "<label> movies" or "<label> shows".
const PLURAL: Record<string, (type: string) => string> = {
	Animation: (type) => `animated ${type}`,
	Documentary: () => "documentaries",
	Soap: () => "soaps",
	"Talk Shows": () => "talk shows",
	"TV Movie": () => "TV movies",
}

/** The row's heading from the breadcrumb's genre page label: "More drama movies", "More talk shows". */
export function genreRowHeading(label: string, mediaType: "movie" | "show") {
	const type = mediaType === "movie" ? "movies" : "shows"
	const plural = PLURAL[label]?.(type) ?? `${label.toLowerCase()} ${type}`
	return `More ${plural}`
}

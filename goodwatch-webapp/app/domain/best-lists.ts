// The best-of lists (`/movies/best`, `/shows/best`) and the people list (`/people`): what they hold, in what order,
// on which page, and what their copy says.
//
// They hold exactly the sitemap cohort, read from the committed sitemap files: the movie and show sitemaps carry the
// selection state (`goodwatch-selection`: core and attention IDs) and every title's address, the people sitemap every
// person's address. The weekly sitemap job commits new files to main, and the deploy that ships them ships these lists
// too, so the two never disagree. Each link is the sitemap's own address. See
// docs/research/discovery-search/best-of-lists/proposal.md.

export type ListKind = "movies" | "shows"
export type TitleKind = "movie" | "show"

export const LIST_KINDS: readonly ListKind[] = ["movies", "shows"]
export const titleKindOf = (kind: ListKind): TitleKind =>
	kind === "movies" ? "movie" : "show"

/** Titles per page of a best-of list. */
export const PER_PAGE = 250

const SITE = "https://goodwatch.app"

/** A sitemap's addresses, in its order, as paths keyed by TMDB ID. */
function sitemapPaths(xml: string, segment: string): Map<number, string> {
	const paths = new Map<number, string>()
	const pattern = new RegExp(
		`<loc>${SITE.replace(/\./g, "\\.")}(/${segment}/(\\d+)(?:-[^<]*)?)</loc>`,
		"g",
	)
	for (const match of xml.matchAll(pattern)) {
		paths.set(Number(match[2]), match[1])
	}
	return paths
}

export interface TitleCohort {
	/** Each title's address, keyed by TMDB ID, in the sitemap's order. */
	paths: Map<number, string>
	/** The titles chosen because they are popular right now, not for their number of ratings. */
	attention: Set<number>
}

/** The cohort of a movie or show sitemap. Throws when the file has no selection state, so a broken file fails loudly. */
export function parseTitleSitemap(xml: string, kind: TitleKind): TitleCohort {
	const state = /<!--goodwatch-selection (.*?)-->/.exec(xml)
	if (!state) throw new Error(`The ${kind} sitemap has no selection state`)
	const { attention } = JSON.parse(state[1]) as { attention: number[] }
	return { paths: sitemapPaths(xml, kind), attention: new Set(attention) }
}

/** Each person's address in the people sitemap, keyed by TMDB ID, in the sitemap's order. */
export const parsePeopleSitemap = (xml: string) => sitemapPaths(xml, "person")

export interface RankableTitle {
	tmdb_id: number
	goodwatch_overall_score_normalized_percent: number | null
	goodwatch_overall_score_voting_count: number | null
}

/** Best first: by GoodWatch score, then by number of ratings, then by TMDB ID, so the order is stable. */
export function rankTitles<T extends RankableTitle>(titles: readonly T[]): T[] {
	const score = (t: T) => t.goodwatch_overall_score_normalized_percent ?? -1
	const votes = (t: T) => t.goodwatch_overall_score_voting_count ?? 0
	return [...titles].sort(
		(a, b) =>
			score(b) - score(a) || votes(b) - votes(a) || a.tmdb_id - b.tmdb_id,
	)
}

export const pageCount = (total: number) =>
	Math.max(1, Math.ceil(total / PER_PAGE))

/** The page a URL asks for, read the way `pagedUrl` reads it: a missing or unusable number is the first page. */
export function requestedPage(search: string): number {
	const page = Number.parseInt(
		new URLSearchParams(search).get("page") || "",
		10,
	)
	return page > 1 ? page : 1
}

/** The first and last rank on a page, counted from 1. */
export const pageRange = (page: number, total: number) => ({
	first: (page - 1) * PER_PAGE + 1,
	last: Math.min(page * PER_PAGE, total),
})

/** A page's own address: the list's path, and `?page=N` after the first page. */
export const pagePath = (kind: ListKind, page: number) =>
	page > 1 ? `/${kind}/best?page=${page}` : `/${kind}/best`

// In a sentence, at its start, and in a title-case page title.
const nouns: Record<ListKind, { noun: string; Lead: string; Noun: string }> = {
	movies: { noun: "movies", Lead: "Movies", Noun: "Movies" },
	shows: { noun: "TV shows", Lead: "TV shows", Noun: "TV Shows" },
}

/** What a list holds, inside a sentence: "movies" or "TV shows". */
export const listNoun = (kind: ListKind) => nouns[kind].noun

/** The name of a list in a breadcrumb and a link. */
export const listName = (kind: ListKind) => `Best ${nouns[kind].noun}`

const SCORE_SOURCES =
	"ranked by one score from IMDb, Rotten Tomatoes, Metacritic and TMDB"

export interface ListCopy {
	title: string
	heading: string
	intro: string
	description: string
}

export function listCopy(
	kind: ListKind,
	{ total, popular, page }: { total: number; popular: number; page: number },
): ListCopy {
	const { noun, Lead, Noun } = nouns[kind]
	const { first, last } = pageRange(page, total)
	const later = page > 1
	return {
		title: later
			? `The Best ${Noun} of All Time, Ranked ${first} to ${last} | GoodWatch`
			: `The Best ${Noun} of All Time, Ranked | GoodWatch`,
		heading: later
			? `The best ${noun} of all time, ${first} to ${last}`
			: `The best ${noun} of all time`,
		intro: `${total} well-known ${noun}, ranked by GoodWatch score: the most-rated ${noun} on GoodWatch${popular ? `, plus ${popular} that are popular right now` : ""}. Updated monthly.`,
		description: later
			? `${Lead} ${first} to ${last} of the ${total} best-known ${noun}, ${SCORE_SOURCES}. See every score and where to stream it.`
			: `The ${total} best-known ${noun}, ${SCORE_SOURCES}. See every score and where to stream it.`,
	}
}

/** How a person's department reads on their card. */
export const roleLabel = (department: string | null | undefined) =>
	department === "Acting"
		? "Actor"
		: department === "Directing"
			? "Director"
			: (department ?? "")

/**
 * The people list's copy, from who is on it. The sitemap takes leads and directors; the copy names only what the
 * list holds, so it says "actors" while no director is on it.
 */
export function peopleCopy(
	departments: readonly (string | null | undefined)[],
): ListCopy {
	const directors = departments.filter((d) => d === "Directing").length
	const others = departments.length - directors
	const who =
		directors && others
			? "actors and directors"
			: directors
				? "directors"
				: "actors"
	const Who = who.charAt(0).toUpperCase() + who.slice(1)
	const did =
		directors && others
			? "led or directed"
			: directors
				? "directed"
				: "has a leading role in"
	return {
		title: `Popular ${Who}: Their Best Movies and TV Shows | GoodWatch`,
		heading: `Popular ${who}`,
		intro: `${departments.length} ${who} from the best-known movies and TV shows on GoodWatch. Each one ${did} several of them. Open a person to see all their titles, each with its score.`,
		description: `${departments.length} popular ${who} and their best-known movies and TV shows, each with its GoodWatch score.`,
	}
}

// How a pack of the related map is shaped from Qdrant's answers. No lookups here (see related-map.server.ts): these
// are the rules, so that they can be tested without a database.
//
// A pack is one title's neighborhood, small enough to prefetch: the title, and the titles around it in the order of
// their similarity, each with what a poster needs and its levels on the map's twenty traits as one character each.
import type { RawPack, RawTitle } from "~/ui/related-map/engine"
import {
	TRAIT_KEYS,
	type TraitToken,
	parseToken,
} from "~/ui/related-map/traits"
import { titleToDashed } from "~/utils/helpers"

/** What a pack reads of a title in Qdrant. */
export interface PackSource {
	tmdb_id: number
	media_type: "movie" | "show"
	title?: string | string[]
	release_year?: number
	poster_path?: string | string[]
	fingerprint_scores_v1?: Record<string, number>
}
export interface PackHit {
	payload: PackSource
	score: number
}

/** The nearest titles of a pack: what the server draws the section's first picture from. */
export const NEAR_TITLES = 80
/** How many titles the filtered lists of a title's chips add to its pack, all lists together. */
export const CHIP_LIST_TITLES = 72
/** A chip's list is never shorter than this, however many chips a title has. */
export const MIN_CHIP_LIST = 8
/** A further page of a filter. Its first page is as long as the nearest titles. */
export const PAGE_TITLES = 240
export const MAX_PAGE = 6
/** The plain title links in the section's HTML. */
export const LINKS = 64

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value

const CODE = "0123456789a"
/** A title's levels on the map's traits, one character each: "0" to "9", "a" for 10, "-" for unknown. */
export const levelsOf = (scores: Record<string, number> | undefined) =>
	TRAIT_KEYS.map((key) => {
		const value = scores?.[key]
		return value === undefined || value < 0 || value > 10
			? "-"
			: CODE[Math.round(value)]
	}).join("")

export const packKey = (title: Pick<PackSource, "media_type" | "tmdb_id">) =>
	`${title.media_type === "movie" ? "m" : "s"}${title.tmdb_id}`

/** Qdrant's similarity as a pack carries it: in thousandths, with one decimal. */
export const nearOf = (score: number) => Math.round(score * 10000) / 10

export const packTitle = (title: PackSource, near: number): RawTitle => [
	packKey(title),
	first(title.title) ?? "",
	String(title.release_year ?? ""),
	(first(title.poster_path) ?? "").replace(/^\/+/, ""),
	near,
	levelsOf(title.fingerprint_scores_v1),
]

/** A title the map can show: it has levels and a poster. */
export const usable = (hit: PackHit) =>
	Boolean(hit.payload.fingerprint_scores_v1 && first(hit.payload.poster_path))

/**
 * Down to which similarity a list is complete: the similarity of its last title, rounded down, so that the browser
 * shows no title from below it until the next page is there and nothing is pushed aside by a late arrival. 0 means
 * Qdrant had no more than it gave.
 */
export const floorOf = (hits: { score: number }[], asked: number) =>
	hits.length < asked ? 0 : Math.floor(hits[hits.length - 1].score * 10000) / 10

/** Which titles of a filter's order a page holds: how many, and after how many. Page 0 is the filter's first. */
export const pageWindow = (page: number): [number, number] =>
	page <= 0
		? [NEAR_TITLES, 0]
		: [PAGE_TITLES, NEAR_TITLES + (page - 1) * PAGE_TITLES]

/** How long each chip's list is when a title has `chips` of them. */
export const chipListLength = (chips: number) =>
	chips ? Math.max(MIN_CHIP_LIST, Math.floor(CHIP_LIST_TITLES / chips)) : 0

/** A token as a condition on Qdrant's stored levels. */
export const tokenCondition = (token: TraitToken) => ({
	key: `fingerprint_scores_v1.${token.key}`,
	range: token.op === ">" ? { gte: token.value } : { lte: token.value },
})

/** A filter's name as its tokens. The name is checked before (see `filterName`). */
export const tokensOf = (filter: string): TraitToken[] =>
	filter
		.split(",")
		.map(parseToken)
		.filter((token): token is TraitToken => token !== null)

/**
 * The titles of several lists as one, each title once, most alike first, without the pack's own title and without
 * titles the map can't show. `have` are titles that are in already.
 */
export function packTitles(
	center: string,
	lists: PackHit[][],
	have: RawTitle[] = [],
): RawTitle[] {
	const chosen = [...have]
	const taken = new Set<string>([center, ...have.map((title) => title[0])])
	for (const hits of lists)
		for (const hit of hits) {
			const key = packKey(hit.payload)
			if (taken.has(key) || !usable(hit)) continue
			taken.add(key)
			chosen.push(packTitle(hit.payload, nearOf(hit.score)))
		}
	return chosen.sort((a, b) => b[4] - a[4])
}

/** A level of a pack's level string, as a number. An unknown level counts as none of the trait. */
export const levelIn = (levels: string, key: string) => {
	const code = levels.charCodeAt(TRAIT_KEYS.indexOf(key))
	return code === 97 ? 10 : code >= 48 && code <= 57 ? code - 48 : 0
}

/** The plain links of the section: the most alike titles of a pack, with the address of each one's page. */
export const packLinks = (pack: RawPack): { href: string; text: string }[] =>
	pack.n.slice(0, LINKS).map(([key, title, year]) => ({
		href: `/${key.charAt(0) === "m" ? "movie" : "show"}/${key.slice(1)}-${titleToDashed(title)}`,
		text: year ? `${title} (${year})` : title,
	}))

/**
 * Whether a loader's answer is rendered into a document now, and not sent to a browser as data (a navigation inside
 * the app). The loader sees the same address for both, so the request's headers decide: a browser says what a
 * request is for (`Sec-Fetch-Dest`), and a client that doesn't say asks for HTML when it wants a document. In doubt
 * the answer is "data", which costs bytes and never a missing map.
 */
export function isDocumentRequest(request: Request): boolean {
	const dest = request.headers.get("Sec-Fetch-Dest")
	if (dest) return dest === "document" || dest === "iframe"
	return (request.headers.get("Accept") ?? "").includes("text/html")
}

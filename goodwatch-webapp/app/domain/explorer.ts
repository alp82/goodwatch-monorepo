// Explorer: the islands map. A grouping (Mood, Theme, Style, Occasion, Genre, Decade, Country, Your taste) splits the
// Explorer's pool of titles into islands; islands can be combined into bridges. These are the shapes the server's
// `/api/explorer/*` endpoints return and the browser draws. Pure and shared by the server and the browser.
import type { TitleKey } from "~/utils/title-key"
import type { TitleTypeFilter } from "./title-type"

export const GROUPINGS = [
	"mood",
	"theme",
	"style",
	"occasion",
	"genre",
	"decade",
	"country",
	"taste",
] as const

export type Grouping = (typeof GROUPINGS)[number]

export const GROUPING_NAMES: Record<Grouping, string> = {
	mood: "Mood",
	theme: "Theme",
	style: "Style",
	occasion: "Occasion",
	genre: "Genre",
	decade: "Decade",
	country: "Country",
	taste: "Your taste",
}

/** The grouping a visit starts with, and the one shown when the requested one needs taste the viewer doesn't have. */
export const DEFAULT_GROUPING: Grouping = "mood"

export const isGrouping = (value: unknown): value is Grouping =>
	GROUPINGS.includes(value as Grouping)

/** No grouping has more islands than this; with a bridge the renderer holds 15. */
export const MAX_ISLANDS = 14

/** Children per title in each generation of a tree after the first posters: 6 around each first poster, then 2 and 2. */
export const DEFAULT_BRANCHING = [6, 2, 2]

/** How many first posters a tree starts with, by how many titles it holds. */
export const firstPosters = (count: number) =>
	count < 40 ? 2 : count < 220 ? 3 : count < 800 ? 4 : 5

/** The three match bands an island's titles fall into (matches run from 50 to 99). */
export const MATCH_BANDS = [
	{ key: "near", name: "Near you", min: 85 },
	{ key: "step", name: "A step out", min: 68 },
	{ key: "far", name: "Unexplored", min: 0 },
] as const

export const matchBandOf = (match: number): 0 | 1 | 2 =>
	match >= MATCH_BANDS[0].min ? 0 : match >= MATCH_BANDS[1].min ? 1 : 2

/** The filters of the Explorer. All of them hide titles; they never dim them. */
export interface ExplorerFilters {
	onMyServices: boolean
	notSeenYet: boolean
	type: TitleTypeFilter
}

export interface ExplorerService {
	id: number
	name: string
	/** TMDB logo path, for example "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg". */
	logo: string | null
	/** One of the viewer's services. */
	mine: boolean
}

/** A title as the map, trees, bridges, and cards show it, with the viewer's personal part. */
export interface ExplorerTitle {
	key: TitleKey
	mediaType: "movie" | "show"
	anime: boolean
	tmdbId: number
	title: string
	year: number | null
	/** TMDB image paths. */
	poster: string
	backdrop: string | null
	/** Up to two genres. */
	genres: string[]
	/** GoodWatch score, 0 to 100. */
	score: number | null
	/** Taste match, 50 to 99; null without taste. */
	match: number | null
	/** The viewer's services that carry it in the viewer's country; empty while the country's availability loads. */
	services: number[]
	seen: boolean
	wantToSee: boolean
	/** The viewer's score, 1 to 10. */
	rating: number | null
}

export interface ExplorerIsland {
	id: string
	name: string
	color: string
	/** Titles on the island that pass the filters. */
	count: number
	/** Median taste match of those titles; null without taste. */
	medianMatch: number | null
	/** Titles per match band (near, a step out, unexplored); null without taste. */
	bands: [number, number, number] | null
	/** Where the island sits, -1 to 1 on both axes: islands with similar titles sit close together. */
	x: number
	y: number
	/** What sets the island apart from the others, for example "Real scares and the uncanny". */
	apart: string
	/** The top 12 titles by quality plus the top 5 of each match band, best first. */
	titles: ExplorerTitle[]
}

export interface ExplorerMap {
	/** The grouping shown; the default one when the requested one needs taste the viewer doesn't have. */
	grouping: Grouping
	requested: Grouping
	/** The groupings this viewer can choose. */
	groupings: Grouping[]
	filters: ExplorerFilters
	/** True while the viewer's country's availability loads: On my services can't apply yet. */
	approximate: boolean
	taste: { signal: "none" | "some"; ratings: number; liked: number }
	/** The viewer's services (for On my services). */
	services: ExplorerService[]
	/** Distinct titles on the islands. */
	total: number
	islands: ExplorerIsland[]
}

/**
 * Titles laid out as a tree, breadth first: the first posters (generation 1, parent -1), then each title's closest
 * titles, generation by generation. parent[i] is the index of titles[i]'s parent.
 */
export interface ExplorerTree {
	count: number
	titles: ExplorerTitle[]
	parent: number[]
	generation: number[]
}

export interface ExplorerIslandTree extends ExplorerTree {
	grouping: Grouping
	id: string
}

/**
 * both: titles on both islands (Mood, Theme, Style, Occasion, and Genre, where titles sit on several islands, when at
 * least 6 exist); between: titles of either island that sit closest to both.
 */
export type BridgeKind = "both" | "between"

export interface ExplorerBridge extends ExplorerTree {
	grouping: Grouping
	a: string
	b: string
	kind: BridgeKind
}

export interface ExplorerPair {
	a: string
	b: string
	kind: BridgeKind
	/** Titles the bridge holds. */
	count: number
	/** 0 to 1: how much more the islands share than their sizes suggest (both), or how alike they are (between). */
	strength: number
}

export interface ExplorerPairs {
	grouping: Grouping
	pairs: ExplorerPair[]
}

export interface ExplorerCard {
	title: ExplorerTitle
	/** "Real scares and a slow burn, like The Thing"; null without taste. */
	why: string | null
	/** The closest title the viewer rated 8 or more. */
	like: { key: TitleKey; title: string } | null
	/** Every subscription service that carries it in the viewer's country, the viewer's first. */
	services: ExplorerService[]
	/** A guest without taste: the card shows the sign-up prompt in place of the match. */
	signUp: boolean
}

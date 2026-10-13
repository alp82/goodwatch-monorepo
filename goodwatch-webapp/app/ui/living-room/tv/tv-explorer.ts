// The mini Explorer on the TV: a small map of six islands, an island's titles, and "Sail to" its two nearest
// islands. Pure, so the choice of the six, their places and the words have tests.
//
// The islands are the real mood map's (`/api/explorer/map?grouping=mood`, `ExplorerMap`): the six with the most
// titles for the person. Each has a position on the real map (`x`, `y` from -1 to 1, y pointing down; islands with
// similar titles sit close together). The mini map has six fixed places; the islands are given out to them so that
// each lands as near to where it sits on the real map as six places allow. There is no list of neighbours: the
// nearest islands by that position are the bridges on the map and the islands "Sail to" offers.
import type {
	ExplorerIsland,
	ExplorerMap,
	ExplorerService,
	ExplorerTitle,
} from "~/domain/explorer"
import {
	brandName,
	getShorterProviderLabel,
} from "../../../utils/streaming-links.ts"
import {
	ISLAND_HOPS,
	LIST_TITLES,
	MAP_ISLANDS,
	type TvContext,
} from "./tv-machine.ts"
import type { TvKnownTitle } from "./tv-title.ts"

/**
 * The map the TV asks for: the Explorer's default grouping, with its default filters (On my services for a
 * person with services, Not seen yet).
 */
export const TV_MAP_GROUPING = "mood"

// ---------------------------------------------------------------------------------------------------------
// The six places.

/** Where an island sits on the desktop's map, in TV canvas pixels inside the map's box (`MAP_BOX`). */
export type MapPlace = {
	left: number
	top: number
	width: number
	height: number
	/** The island's outline, as a border radius: no two islands are the same shape. */
	shape: string
}

/** The map's box on the desktop: what a screen's `Frame` leaves under the top bar. */
export const MAP_BOX = { width: 1088, height: 500 } as const

/**
 * The six places, in reading order: three along the top with the middle one a step down, two under them, and one
 * at the far right between the two rows. They are the approved prototype's six places, drawn as flat islands
 * with their names inside, not as round stills.
 *
 * The numbers decide where the direction keys go (tv-move.ts reads the boxes), and tv-explorer.test.ts pins
 * every move. What they are tuned for:
 * - the far right island reaches up beside the top row and down beside the bottom row, so Right from either row
 *   lands on it, and Up and Down from it leave the map (the bar, the Expand key) and never jump across it;
 * - it ends no more than 40 px above the bottom row's lower edge, so Up from the Expand key, which is right under
 *   it, lands on it;
 * - no island of the bottom row starts beside it and above its lower edge by less than 8 px, so nothing below the
 *   top row counts as "under" the far right island.
 */
export const MAP_PLACES: readonly MapPlace[] = [
	{
		left: 0,
		top: 8,
		width: 250,
		height: 132,
		shape: "58% 42% 46% 54% / 56% 48% 52% 44%",
	},
	{
		left: 290,
		top: 30,
		width: 250,
		height: 132,
		shape: "44% 56% 52% 48% / 50% 58% 42% 50%",
	},
	{
		left: 580,
		top: 0,
		width: 250,
		height: 132,
		shape: "52% 48% 58% 42% / 46% 52% 48% 54%",
	},
	{
		left: 120,
		top: 208,
		width: 250,
		height: 132,
		shape: "48% 52% 44% 56% / 58% 44% 56% 42%",
	},
	{
		left: 470,
		top: 208,
		width: 250,
		height: 132,
		shape: "56% 44% 50% 50% / 44% 56% 46% 54%",
	},
	{
		left: 848,
		top: 116,
		width: 240,
		height: 196,
		shape: "46% 54% 48% 52% / 40% 44% 56% 60%",
	},
]

type Point = { x: number; y: number }

const centre = (place: MapPlace): Point => ({
	x: place.left + place.width / 2,
	y: place.top + place.height / 2,
})

/** Points spread over 0 to 1 on both axes, each axis by itself. Points that share a coordinate sit in its middle. */
function spread(points: readonly Point[]): Point[] {
	const axis = (values: number[]) => {
		const low = Math.min(...values)
		const range = Math.max(...values) - low
		return values.map((value) => (range ? (value - low) / range : 0.5))
	}
	const xs = axis(points.map((point) => point.x))
	const ys = axis(points.map((point) => point.y))
	return points.map((_, at) => ({ x: xs[at], y: ys[at] }))
}

/** Every order of the numbers 0 to n - 1, in counting order. */
function orders(n: number): number[][] {
	if (n <= 1) return [n ? [0] : []]
	return orders(n - 1).flatMap((order) =>
		Array.from({ length: n }, (_, at) => [
			...order.slice(0, at),
			n - 1,
			...order.slice(at),
		]),
	)
}

/**
 * Gives up to six islands their places: the result's island `n` sits at `places[n]`. Both the islands' real
 * positions and the places are spread over the same square, and of every way to give them out the one that
 * moves the islands least wins (the least sum of squared distances). So what is left on the real map is left
 * here, what is on top is on top, and neighbours stay neighbours as far as six fixed places allow.
 */
export function placeIslands<T extends Point>(
	islands: readonly T[],
	places: readonly MapPlace[] = MAP_PLACES,
): T[] {
	const some = islands.slice(0, places.length)
	const from = spread(some)
	const to = spread(places.slice(0, some.length).map(centre))
	let best: number[] = []
	let least = Number.POSITIVE_INFINITY
	// `order[place]` is the island at that place. Six islands are 720 orders.
	for (const order of orders(some.length)) {
		let cost = 0
		for (let place = 0; place < order.length && cost < least; place++) {
			const island = from[order[place]]
			cost += (island.x - to[place].x) ** 2 + (island.y - to[place].y) ** 2
		}
		if (cost < least) {
			least = cost
			best = order
		}
	}
	return best.map((island) => some[island])
}

/** The six islands of a map with the most titles for the person, most first. An island without titles is none. */
export function largestIslands<T extends { count: number }>(
	islands: readonly T[],
	max = MAP_ISLANDS,
): T[] {
	return islands
		.map((island, at) => ({ island, at }))
		.filter(({ island }) => island.count > 0)
		.sort((a, b) => b.island.count - a.island.count || a.at - b.at)
		.slice(0, max)
		.map(({ island }) => island)
}

/** The islands nearest to `from` on the real map, nearest first. `from` itself is not among them. */
export function nearestIslands<T extends Point & { id: string }>(
	from: Point & { id: string },
	islands: readonly T[],
	max = ISLAND_HOPS,
): T[] {
	const far = (island: Point) =>
		(island.x - from.x) ** 2 + (island.y - from.y) ** 2
	return islands
		.map((island, at) => ({ island, at, far: far(island) }))
		.filter(({ island }) => island.id !== from.id)
		.sort((a, b) => a.far - b.far || a.at - b.at)
		.slice(0, max)
		.map(({ island }) => island)
}

/**
 * The map's bridges: each island is joined to its nearest. A pair of places, the lower number first, each pair
 * once.
 */
export function mapBridges(
	islands: readonly (Point & { id: string })[],
): [number, number][] {
	const pairs = new Map<string, [number, number]>()
	islands.forEach((island, at) => {
		const [nearest] = nearestIslands(island, islands, 1)
		if (!nearest) return
		const to = islands.indexOf(nearest)
		const pair: [number, number] = at < to ? [at, to] : [to, at]
		pairs.set(pair.join("-"), pair)
	})
	return [...pairs.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

// ---------------------------------------------------------------------------------------------------------
// What the screens show.

/** An island as the TV draws it. */
export type TvIsland = {
	id: string
	name: string
	color: string
	/** Titles on the island for the person. */
	count: number
	/** What sets it apart: "Real scares and the uncanny". */
	apart: string
	/** The backdrop of its first title: the picture behind the map while the island has the focus. */
	picture: string | null
}

/** A title of the island on screen. */
export type TvIslandTitle = {
	/** `movie-603`, as in the TV's URL. */
	key: string
	title: string
	/** "1999 · Movie · 87 score · On Netflix". */
	facts: string
	poster: string
	backdrop: string | null
}

export type TvExplorerView = {
	/** `waiting` until the map is there, `failed` when it did not come. */
	status: "waiting" | "failed" | "ready"
	/** The six islands, each at the place of its number (`MAP_PLACES`). */
	islands: TvIsland[]
	/** The bridges between them, as pairs of places. */
	bridges: [number, number][]
	/** The island the address names, with its titles and where to sail from it. Null on the map. */
	island:
		| (TvIsland & { titles: TvIslandTitle[]; hops: TvIsland[] })
		/** The address names an island the map does not have. */
		| "missing"
		| null
}

/** The view before the map is there, and when it did not come. */
export const explorerWaiting = (failed = false): TvExplorerView => ({
	status: failed ? "failed" : "waiting",
	islands: [],
	bridges: [],
	island: null,
})

/** A title's key on the TV and in its URL. */
const tvKey = (title: Pick<ExplorerTitle, "mediaType" | "tmdbId">) =>
	`${title.mediaType}-${title.tmdbId}`

/** "1999 · Movie · 87 score · 91% match · On Netflix": what stands under the focused title's name. */
export function islandTitleFacts(
	title: Pick<
		ExplorerTitle,
		"year" | "mediaType" | "score" | "match" | "services"
	>,
	services: readonly ExplorerService[],
): string {
	// A title's services are the person's own that carry it; the first names where to watch it.
	const service = services.find((one) => title.services.includes(one.id))
	return [
		title.year,
		title.mediaType === "show" ? "Show" : "Movie",
		title.score != null && `${Math.round(title.score)} score`,
		title.match != null && `${title.match}% match`,
		service && `On ${brandName(getShorterProviderLabel(service.name))}`,
	]
		.filter(Boolean)
		.join(" · ")
}

const asTvIsland = (island: ExplorerIsland): TvIsland => ({
	id: island.id,
	name: island.name,
	color: island.color,
	count: island.count,
	apart: island.apart,
	picture: island.titles.find((title) => title.backdrop)?.backdrop ?? null,
})

/**
 * What the Explorer's two screens show of a map: the six islands in their places with their bridges, and for an
 * island its first four titles and the two nearest of the six. An island of the map that is not among the six
 * (a link can name any) shows its titles too, and sails to the nearest of the six.
 */
export function explorerView(
	map: Pick<ExplorerMap, "islands" | "services">,
	islandId: string | null,
): TvExplorerView {
	const six = placeIslands(largestIslands(map.islands))
	const on = islandId
		? map.islands.find((island) => island.id === islandId)
		: null
	return {
		status: "ready",
		islands: six.map(asTvIsland),
		bridges: mapBridges(six),
		island: !islandId
			? null
			: !on
				? "missing"
				: {
						...asTvIsland(on),
						titles: on.titles.slice(0, LIST_TITLES).map((title) => ({
							key: tvKey(title),
							title: title.title,
							facts: islandTitleFacts(title, map.services),
							poster: title.poster,
							backdrop: title.backdrop,
						})),
						hops: nearestIslands(on, six).map(asTvIsland),
					},
	}
}

/** The machine's context for the Explorer's screens: the islands in reading order, and an island's titles and hops. */
export function explorerContext(
	view: TvExplorerView,
): Pick<TvContext, "islands" | "titles" | "hops"> {
	const island = view.island && view.island !== "missing" ? view.island : null
	return {
		islands: view.islands.map((one) => one.id),
		titles: island?.titles.map((title) => title.key) ?? [],
		hops: island?.hops.map((hop) => hop.id) ?? [],
	}
}

/** What the map knows of a title, for the title screen until its card is there. */
export function knownOnMap(
	map: Pick<ExplorerMap, "islands">,
	key: string,
): TvKnownTitle | null {
	for (const island of map.islands) {
		const title = island.titles.find((one) => tvKey(one) === key)
		if (title)
			return {
				media_type: title.mediaType,
				tmdb_id: title.tmdbId,
				title: title.title,
				poster_path: title.poster,
				backdrop_path: title.backdrop,
				release_year: title.year,
				goodwatch_overall_score_normalized_percent: title.score,
				match: title.match,
				wantToSee: title.wantToSee,
				seen: title.seen,
			}
	}
	return null
}

/** "2,616 titles", "1 title". */
export const islandCount = (count: number) =>
	`${count.toLocaleString("en-US")} ${count === 1 ? "title" : "titles"}`

/**
 * The ink for a name on an island's flat colour: white or near black, whichever stands out more (the contrast of
 * the two against the colour, by its relative luminance).
 */
export function inkOn(color: string): "#fff" | "#0b0c10" {
	const [r, g, b] = [1, 3, 5].map((at) => {
		const channel = Number.parseInt(color.slice(at, at + 2), 16) / 255
		return channel <= 0.03928
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4
	})
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
	// White wins where 1.05 / (L + 0.05) is more than (L + 0.05) / 0.05.
	return luminance < 0.179 ? "#fff" : "#0b0c10"
}

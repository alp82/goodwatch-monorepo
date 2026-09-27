// The Explorer's sea: the night water, fog, and islands drawn under the posters. One interface, three adapters
// (WebGL2, WebGL1, Canvas 2D), chosen in that order by `createSeaRenderer`.

export type SeaKind = "webgl2" | "webgl1" | "canvas2d"

/** A color with channels from 0 to 1. */
export type Rgb = [number, number, number]

/** The shader's island array holds this many islands. */
export const ISLAND_LIMIT = 24
/** The backdrop atlas holds this many island tiles. */
export const ATLAS_TILE_LIMIT = 16
/** Edge of one backdrop tile in pixels; the atlas is 4 by 4 tiles. */
export const TILE_SIZE = 512

/** An island's painted surface: a blurred collage of its titles' backdrops, and its average color. */
export interface BackdropTile {
	readonly canvas: HTMLCanvasElement
	readonly average: Rgb
}

export interface IslandShape {
	/** Center in world units. */
	x: number
	y: number
	/** Radius in world units, before the outline's wobble. */
	radius: number
	/** Phase of the outline's wobble, so every island has its own shoreline. */
	seed: number
	/** Tint of the shoreline, glow, and fog near the island. */
	color: Rgb
	/** The land's surface; without one the land is drawn in the tint. */
	backdrop: BackdropTile | null
	/**
	 * Focus weight: -1 dimmed, 0 normal, 1 in focus (more glow). An island picked for combining goes up to 1.7, which
	 * brightens its shoreline further.
	 */
	emphasis: number
	/** Saturation of the land: 0 grey, 1 as painted, a little over 1 more vivid. */
	saturation: number
	/**
	 * 0 to 1: the night closes in around this island beyond 1.2 radii, so it's what the person sees first. The
	 * strongest island's spotlight wins.
	 */
	spotlight?: number
}

export interface Camera {
	/** World point at the viewport's center. */
	x: number
	y: number
	/** Screen pixels (CSS) per world unit. */
	scale: number
	/** The scale that fits the whole map; the fog's parallax is measured against it. */
	overviewScale: number
	/** 0 at map level to 1 deep inside an island: the land darkens and the surf and haze fade. */
	depth: number
	/** Viewport size in CSS pixels. */
	width: number
	height: number
}

export interface SeaRenderer {
	/** The adapter drawing now; it changes to "canvas2d" after repeated context losses. */
	readonly kind: SeaKind
	setIslands(islands: IslandShape[]): void
	setCamera(camera: Camera): void
	/** Draws a frame when needed; returns true while anything still moves, so the caller keeps its frame loop. */
	draw(timeMs: number): boolean
	dispose(): void
}

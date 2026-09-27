// An island as the map engine holds it: the grouping's island from the server, its place in the world, its tree of
// titles laid out for zooming in, its painted surface, and how it's drawn this frame.
import {
	DEFAULT_BRANCHING,
	type ExplorerTitle,
	type ExplorerTree,
	firstPosters,
} from "~/domain/explorer"
import type { BackdropTile } from "./sea/types"
import { type Rgb, hexRgb, luminous } from "./color"
import { type Placed, placeTree, treeExtent, treeRoots } from "./tree"
import type { WorldIsland } from "./world"

export const BRANCHING = DEFAULT_BRANCHING
export const TREE_EXTENT = treeExtent(BRANCHING)

/** What the page knows about an island before the engine lays it out. */
export interface IslandInput {
	id: string
	name: string
	/** "#rrggbb". */
	color: string
	count: number
	/** Median taste match, null without taste. */
	medianMatch: number | null
	/** A logo drawn above the name (the Streaming grouping's services), as a TMDB path. */
	logo: string | null
	/** The island's first titles, best first (the map's top titles). */
	titles: ExplorerTitle[]
}

/**
 * How the focus of the map styles an island (the seam combining islands builds on): an offset from its place and a
 * scale, both in world units, and how muted (grey, dim, names only), vivid (first posters readable from far out), and
 * lit (picked) it is, each 0 to 1. The engine springs every island toward its target.
 */
export interface IslandLook {
	dx: number
	dy: number
	scale: number
	mute: number
	vivid: number
	lit: number
}

export const NEUTRAL_LOOK: IslandLook = {
	dx: 0,
	dy: 0,
	scale: 1,
	mute: 0,
	vivid: 0,
	lit: 0,
}

export interface MapIsland {
	id: string
	name: string
	color: string
	/** The grouping's color, and the tint drawn (lifted, and mixed with the surface's average once it's painted). */
	base: Rgb
	tint: Rgb
	logo: string | null
	count: number
	medianMatch: number | null
	shape: WorldIsland
	/** First posters: how many, how wide (world units), and where. */
	n1: number
	w1: number
	roots: { x: number; y: number }[]
	/** How far the first posters may grow (times w1) before they'd touch each other or the shore. */
	boost: number
	/** The map's top titles, the fallback until the tree loads. */
	top: ExplorerTitle[]
	titles: ExplorerTitle[]
	parent: number[]
	generation: number[]
	pos: Placed
	loaded: boolean
	backdrop: BackdropTile | null
	/** On screen this frame: center and radius in CSS pixels, and whether any of it shows. */
	sx: number
	sy: number
	sr: number
	on: boolean
	/** Under the pointer or in the middle of the view, 0 to 1 (animated). */
	emph: number
	/** The look drawn now, its target, and the springs' velocities of the offset and scale. */
	look: IslandLook
	target: IslandLook
	vx: number
	vy: number
	vs: number
}

/** How far an island's first posters may grow into the room their smaller posters take once you zoom in. */
function boostOf(island: MapIsland) {
	const pts = island.roots
	const w = island.w1
	if (!pts.length || w <= 0) return 1
	const R = island.shape.r * 0.8
	let limit = Number.POSITIVE_INFINITY
	for (let a = 0; a < pts.length; a++)
		for (let b = a + 1; b < pts.length; b++) {
			const dx = Math.abs(pts[a].x - pts[b].x)
			const dy = Math.abs(pts[a].y - pts[b].y)
			limit = Math.min(limit, Math.max(dx / 1.1, dy / (1.5 * 1.1)))
		}
	for (const p of pts) {
		// The poster's far corner on the circle: (a + k/2)^2 + (b + 3k/4)^2 = R^2.
		const a = Math.abs(p.x - island.shape.cx)
		const b = Math.abs(p.y - island.shape.cy)
		const A = 0.8125
		const B = a + 1.5 * b
		const C = a * a + b * b - R * R
		const disc = B * B - 4 * A * C
		if (disc > 0) limit = Math.min(limit, (-B + Math.sqrt(disc)) / (2 * A))
	}
	return Math.min(6, Math.max(1, limit / w))
}

export function makeIsland(input: IslandInput, shape: WorldIsland): MapIsland {
	const n1 = firstPosters(input.count)
	const r = shape.r
	const rt = treeRoots(BRANCHING, n1, shape.cx, shape.cy + 0.02 * r, 0.8 * r)
	const base = hexRgb(input.color)
	const island: MapIsland = {
		id: input.id,
		name: input.name,
		color: input.color,
		base,
		tint: luminous(base),
		logo: input.logo,
		count: input.count,
		medianMatch: input.medianMatch,
		shape,
		n1,
		w1: rt.w,
		roots: rt.pts,
		boost: 1,
		top: input.titles,
		titles: [],
		parent: [],
		generation: [],
		pos: {
			x: new Float32Array(0),
			y: new Float32Array(0),
			w: new Float32Array(0),
		},
		loaded: false,
		backdrop: null,
		sx: 0,
		sy: 0,
		sr: 0,
		on: false,
		emph: 0,
		look: { ...NEUTRAL_LOOK },
		target: { ...NEUTRAL_LOOK },
		vx: 0,
		vy: 0,
		vs: 0,
	}
	island.boost = boostOf(island)
	return island
}

/** Until its tree loads, an island shows its first titles that pass the filters as its first posters. */
export function showTopTitles(
	island: MapIsland,
	visible: (title: ExplorerTitle) => boolean,
) {
	if (island.loaded) return
	const titles = island.top.filter(visible).slice(0, island.n1)
	island.titles = titles
	island.parent = titles.map(() => -1)
	island.generation = titles.map(() => 1)
	island.pos = placeTree(
		island.roots,
		island.w1,
		island.parent,
		island.generation,
	)
}

/** The island's tree from the server replaces its first titles. */
export function showTree(island: MapIsland, tree: ExplorerTree) {
	if (island.loaded || !tree.titles.length) return false
	island.titles = tree.titles
	island.parent = tree.parent
	island.generation = tree.generation
	island.pos = placeTree(island.roots, island.w1, tree.parent, tree.generation)
	island.loaded = true
	return true
}

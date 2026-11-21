// The world map's arithmetic, apart from React so it can be tested: which views a set of countries needs, the box
// each view shows, and the transform that brings a box into the frame. All numbers are in the canvas of shapes.ts.
import {
	VIEW_BOX,
	WORLD_HEIGHT,
	WORLD_SHAPES,
	type WorldRegion,
	type WorldShape,
	type WorldView,
} from "~/ui/browse/world-map/shapes"

export type Box = readonly [number, number, number, number]

export const SHAPE_BY_CODE: ReadonlyMap<string, WorldShape> = new Map(
	WORLD_SHAPES.filter((shape) => shape.code).map((shape) => [shape.code, shape]),
)

export const REGION_ORDER: readonly WorldRegion[] = ["americas", "europe", "asia", "africa"]

export const REGION_NAME: Record<WorldView, string> = {
	world: "World",
	americas: "Americas",
	europe: "Europe",
	asia: "Asia & Pacific",
	africa: "Africa",
}

const width = (box: Box) => box[2] - box[0]
const height = (box: Box) => box[3] - box[1]

/** A shape too small to see or hit at world scale: it gets a dot and a wider hit area. */
export const isTiny = (shape: WorldShape) =>
	!shape.d || Math.max(width(shape.box), height(shape.box)) < 3

/** A shape that is hard to hit at world scale. */
export const isSmall = (shape: WorldShape) => Math.min(width(shape.box), height(shape.box)) < 12

const union = (a: Box, b: Box): Box => [
	Math.min(a[0], b[0]),
	Math.min(a[1], b[1]),
	Math.max(a[2], b[2]),
	Math.max(a[3], b[3]),
]

const pad = (box: Box, by: number): Box => [box[0] - by, box[1] - by, box[2] + by, box[3] + by]

/**
 * The box a view shows: the listed countries of that region with some room around them, so the view comes as close
 * as they allow (Asia & Pacific without New Zealand doesn't show the empty South Pacific). A country wider than the
 * region's usual crop (Russia) doesn't count: it fills the view's edge anyway. A region with no listed country shows
 * its usual crop.
 */
export function viewBoxOf(view: WorldView, codes: readonly string[]): Box {
	const base = VIEW_BOX[view]
	if (view === "world") return base
	let box: Box | null = null
	for (const code of codes) {
		const shape = SHAPE_BY_CODE.get(code)
		if (!shape || shape.region !== view) continue
		if (width(shape.box) > width(base) * 0.6) continue
		box = box ? union(box, shape.box) : shape.box
	}
	if (!box) return base
	// Room around them, and never closer than a sixth of the world's width.
	const room = Math.max(width(box), height(box)) * 0.03 + 3
	const short = Math.max(0, MIN_VIEW - width(box) - room * 2) / 2
	const roomy = pad([box[0] - short, box[1], box[2] + short, box[3]], room)
	return [roomy[0], Math.max(roomy[1], 0), roomy[2], Math.min(roomy[3], WORLD_HEIGHT)]
}

const MIN_VIEW = 150

/** How much closer than the whole world a view brings its region, in a frame. */
export const gainOf = (frame: Box, target: Box) =>
	fitTransform(frame, target).scale / fitTransform(frame, VIEW_BOX.world).scale

/** The regions that hold at least one of the countries, in the order of the switch. */
export function regionsOf(codes: readonly string[]): WorldRegion[] {
	const present = new Set<string>()
	for (const code of codes) {
		const region = SHAPE_BY_CODE.get(code)?.region
		if (region) present.add(region)
	}
	return REGION_ORDER.filter((region) => present.has(region))
}

/** The frame a phone shows: as wide as `frame`, 3:2, around the same middle. */
export function tallFrameOf(frame: Box): Box {
	const h = width(frame) / 1.5
	const cy = (frame[1] + frame[3]) / 2
	return [frame[0], cy - h / 2, frame[2], cy + h / 2]
}

/** Scale and offset that fit `target` inside `frame`, centered (the group's transform; origin 0 0). */
export function fitTransform(frame: Box, target: Box) {
	const scale = Math.min(width(frame) / width(target), height(frame) / height(target))
	const x = (frame[0] + frame[2]) / 2 - (scale * (target[0] + target[2])) / 2
	const y = (frame[1] + frame[3]) / 2 - (scale * (target[1] + target[3])) / 2
	return { scale, x, y }
}

/**
 * The hero's box: the country with its neighbors around it. The country takes at most about a third of the width and
 * half of the height of a frame `aspect` times as wide as it is tall; a narrower frame crops the sides and still holds
 * it. `anchorX` is where the country's middle sits across the box: 0.5 is the middle, 0.7 the right half.
 */
export function heroBoxOf(shape: WorldShape, aspect = 2.4, anchorX = 0.5): Box {
	const share = anchorX === 0.5 ? 0.34 : 0.3
	const w = Math.min(
		Math.max(width(shape.box) / share, (height(shape.box) / 0.5) * aspect, 150),
		620,
	)
	const h = w / aspect
	const cx = (shape.box[0] + shape.box[2]) / 2
	const cy = (shape.box[1] + shape.box[3]) / 2
	return [cx - w * anchorX, cy - h / 2, cx + w * (1 - anchorX), cy + h / 2]
}

/**
 * 0.4 to 0.64: how strongly a listed country is filled, by its weight among the listed ones. The floor sits well above
 * the unlisted land (0.055), so a country with a page reads as one at a glance.
 */
export function emphasisOf(weight: number | undefined, max: number): number {
	if (!max || !weight || weight <= 0) return 0.42
	return 0.4 + 0.24 * Math.sqrt(Math.min(weight / max, 1))
}

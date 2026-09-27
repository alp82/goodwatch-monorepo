import type { Camera, IslandShape, SeaKind } from "./types"

/** The spotlight in world units (the night closes in beyond 1.2 radii), strength 0 to 1. */
export interface Spotlight {
	x: number
	y: number
	radius: number
	strength: number
}

/** Everything one frame needs, resolved by the renderer for its adapter. */
export interface SeaFrame {
	camera: Camera
	islands: IslandShape[]
	/** Atlas slot of each island's backdrop, or -1 when it has none. */
	slots: number[]
	/** Sea time in seconds; frozen with reduced motion and while idle. */
	time: number
	spotlight: Spotlight | null
}

/** Raised by an adapter when it can't be created; the renderer tries the next one. */
export class AdapterUnavailable extends Error {}

export interface SeaAdapter {
	readonly kind: SeaKind
	/** Whether the sea moves on its own (fog, surf, grain); Canvas 2D doesn't. */
	readonly animated: boolean
	/** How many islands the adapter can draw. */
	readonly islandCapacity: number
	uploadTile(slot: number, tile: HTMLCanvasElement): void
	render(frame: SeaFrame): void
	dispose(): void
}

export const WEBGL_PIXEL_RATIO_CAP = 1.5
export const CANVAS_PIXEL_RATIO_CAP = 1.5

/** Sizes the canvas's backing store to its CSS size times the capped pixel ratio; returns that ratio. */
export function fitBackingStore(
	canvas: HTMLCanvasElement,
	camera: Camera,
	cap: number,
): number {
	const ratio = Math.min(cap, window.devicePixelRatio || 1)
	const width = Math.max(1, Math.round(camera.width * ratio))
	const height = Math.max(1, Math.round(camera.height * ratio))
	if (canvas.width !== width) canvas.width = width
	if (canvas.height !== height) canvas.height = height
	return ratio
}

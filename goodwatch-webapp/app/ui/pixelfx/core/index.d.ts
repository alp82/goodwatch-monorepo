// Types for the parts of the vendored pixelfx core that the map effects call.

export interface FxFrame {
	w: number
	h: number
	ox: number
	oy: number
	color: Uint32Array
	light: Uint32Array
}

export interface FxMeta {
	name?: string
	duration?: number
	loop?: boolean
	size?: [number, number]
	origin?: [number, number]
	options?: Record<string, unknown>
}

export interface FxModule {
	meta: FxMeta
}

export interface FxInstance {
	meta: FxMeta
	options: Record<string, unknown>
	readonly t: number
	update(dt: number): void
	draw(frame: FxFrame, layer?: "back" | "front"): void
	stop(): void
	done(): boolean
}

export function createFrame(w: number, h: number, ox?: number, oy?: number): FxFrame
export function clearFrame(f: FxFrame): FxFrame
export function createFx(mod: FxModule, o?: Record<string, unknown>): FxInstance
export function composite(
	f: FxFrame,
	out: Uint8ClampedArray,
	bg?: number | Uint32Array | null,
	lightK?: number,
): Uint8ClampedArray

/** The drawing API effects get (only what the map's own code and tests call). */
export class Painter {
	constructor(frame: FxFrame)
	toX(x: number, y: number): number
	toY(x: number, y: number): number
	add(sx: number, sy: number, c: number, k?: number): void
	glow(x: number, y: number, r: number, c: number, k?: number): void
	glowLine(x0: number, y0: number, x1: number, y1: number, r: number, c: number, k?: number): void
	glowRing(x: number, y: number, R: number, r: number, c: number, k?: number): void
}

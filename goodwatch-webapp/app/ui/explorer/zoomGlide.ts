// How the map's camera zooms: in short ease-out glides instead of jumps from stop to stop.
// - A wheel notch zooms 1.25x in a 420 ms glide toward an accumulated target, so quick notches chain; the buttons, the
//   + and - keys and a double tap glide about twice as close over 900 ms.
// - Zooming in over water drifts the point toward the region under it (at the world), the nearest island (between
//   islands) or the nearest poster (in among an island's titles), so a zoom never ends in empty water.
import type { Cam } from "./camera"
import type { MapIsland } from "./island"
import { clamp } from "./paint"

/** One wheel notch. */
export const NOTCH = 1.25
export const NOTCH_MS = 420
/** The + and - buttons and keys, a double tap. */
export const STEP_MS = 900
/** A glide this long counts as a flight that lands (it plays the landing effect). */
export const LAND_MS = 800

export const easeOut = (t: number) => 1 - (1 - t) ** 3

/**
 * A glide of the camera: the scale moves on a log scale, and the world point under the screen point (px, py) moves from
 * w0 to w1, both on the same ease-out. With w0 = w1 it zooms about the point.
 */
export interface ZoomGlide {
	t0: number
	ms: number
	s0: number
	s1: number
	px: number
	py: number
	w0x: number
	w0y: number
	w1x: number
	w1y: number
	hw: number
	hh: number
	land: boolean
}

export function makeGlide(
	from: Cam,
	to: Cam,
	px: number,
	py: number,
	W: number,
	H: number,
	ms: number,
	now: number,
	land = false,
): ZoomGlide {
	const hw = W / 2
	const hh = H / 2
	return {
		t0: now,
		ms: Math.max(1, ms),
		s0: from.s,
		s1: to.s,
		px,
		py,
		w0x: from.x + (px - hw) / from.s,
		w0y: from.y + (py - hh) / from.s,
		w1x: to.x + (px - hw) / to.s,
		w1y: to.y + (py - hh) / to.s,
		hw,
		hh,
		land,
	}
}

/** Writes the camera for `now` into `out`; true once the glide is over. */
export function glideAt(gl: ZoomGlide, now: number, out: Cam): boolean {
	const t = clamp((now - gl.t0) / gl.ms, 0, 1)
	const e = easeOut(t)
	const s = Math.exp(Math.log(gl.s0) + (Math.log(gl.s1) - Math.log(gl.s0)) * e)
	const wx = gl.w0x + (gl.w1x - gl.w0x) * e
	const wy = gl.w0y + (gl.w1y - gl.w0y) * e
	out.s = s
	out.x = wx - (gl.px - gl.hw) / s
	out.y = wy - (gl.py - gl.hh) / s
	return t >= 1
}

/** What the engine tells the drift about its world. */
export interface DriftGeo {
	/** Out at the world: regions as a whole. */
	far: () => boolean
	/** The middle of the region (or the hub) a world point belongs to. */
	region: (x: number, y: number) => { x: number; y: number }
	/** The island nearest a world point and how far from its shore, in its radii (negative inside). */
	nearestIsland: (
		x: number,
		y: number,
	) => { island: MapIsland; d: number } | null
	/** The scale that frames an island's titles. */
	frameScale: (island: MapIsland) => number
	cx: (island: MapIsland) => number
	cy: (island: MapIsland) => number
	px: (island: MapIsland, i: number) => number
	py: (island: MapIsland, i: number) => number
	pw: (island: MapIsland, i: number) => number
	visible: (island: MapIsland, i: number) => boolean
}

/**
 * Where a zoom in at world point (wx, wy) should drift so it never ends in empty water: the region under it out at the
 * world, the nearest island over the gaps between islands, the nearest poster (big enough to read at `toS`) once in
 * among an island's tree. Null when the point is already on something.
 */
export function driftTarget(
	geo: DriftGeo,
	wx: number,
	wy: number,
	toS: number,
): { x: number; y: number } | null {
	if (geo.far()) return geo.region(wx, wy)
	const near = geo.nearestIsland(wx, wy)
	if (!near) return null
	const { island, d } = near
	const off = d > 0.02
	const centre = { x: geo.cx(island), y: geo.cy(island) }
	if (toS < geo.frameScale(island) * 0.9) return off ? centre : null
	let best = -1
	let bd = Number.POSITIVE_INFINITY
	const n = island.titles.length
	for (let i = 0; i < n; i++) {
		const w = geo.pw(island, i)
		if (w * toS < 48 || !geo.visible(island, i)) continue
		const dx = Math.max(0, Math.abs(wx - geo.px(island, i)) - w / 2) * toS
		const dy = Math.max(0, Math.abs(wy - geo.py(island, i)) - w * 0.75) * toS
		// Bigger posters pull a little harder: they're what the zoom is heading for.
		const v = Math.hypot(dx, dy) - Math.min(40, w * toS * 0.08)
		if (v < bd) {
			bd = v
			best = i
		}
	}
	if (best < 0) return off ? centre : null
	// Already on (or right next to) a poster: zoom straight in.
	if (bd < 4) return null
	return { x: geo.px(island, best), y: geo.py(island, best) }
}

/**
 * The world point the zoom ends about: `base` moved part of the way toward its drift target, at most `cap` screen
 * pixels (at the target scale) per step, so the map slides gently instead of jumping.
 */
export function drifted(
	base: { x: number; y: number },
	target: { x: number; y: number } | null,
	toS: number,
	k: number,
	cap: number,
): { x: number; y: number } {
	if (!target) return base
	let dx = (target.x - base.x) * k
	let dy = (target.y - base.y) * k
	const px = Math.hypot(dx, dy) * toS
	if (px > cap) {
		dx *= cap / px
		dy *= cap / px
	}
	return { x: base.x + dx, y: base.y + dy }
}

// The map camera's zoom math, apart from the engine's state: zooming about a point on screen, the stop a step lands
// on, and the stop a free zoom (trackpad, pinch) settles on.

/** The world point at the middle of the view, and the scale (screen pixels per world unit). */
export interface Cam {
	x: number
	y: number
	s: number
}

/** The camera at scale `s` that keeps what's under the screen point (sx, sy) of a w by h view where it is. */
export const zoomAbout = (
	cam: Cam,
	s: number,
	sx: number,
	sy: number,
	w: number,
	h: number,
): Cam => ({
	x: cam.x + (sx - w / 2) / cam.s - (sx - w / 2) / s,
	y: cam.y + (sy - h / 2) / cam.s - (sy - h / 2) / s,
	s,
})

/** The next stop in (1) or out (-1) from scale `base`; null past the last one. `stops` ascend. */
export function nextStop(
	stops: readonly number[],
	base: number,
	dir: 1 | -1,
): number | null {
	if (dir > 0) return stops.find((s) => s > base * 1.12) ?? null
	for (let k = stops.length - 1; k >= 0; k--)
		if (stops[k] < base / 1.12) return stops[k]
	return null
}

/** A free zoom settles on a stop only from this close (in log scale, about 10%), and from half that against its way. */
export const SETTLE_REACH = 0.1

/**
 * The stop a free zoom that ended at scale `s` settles on, or null to stay where it was let go. `dir` is the way the
 * gesture went (1 in, -1 out, 0 neither).
 */
export function settleStop(
	stops: readonly number[],
	s: number,
	dir: number,
): number | null {
	let best: number | null = null
	let gap = Number.POSITIVE_INFINITY
	for (const stop of stops) {
		const d = Math.log(stop / s)
		const reach = dir && d * dir < 0 ? SETTLE_REACH / 2 : SETTLE_REACH
		if (Math.abs(d) < reach && Math.abs(d) < gap) {
			gap = Math.abs(d)
			best = stop
		}
	}
	return best
}

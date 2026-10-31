// The map camera's zoom math, apart from the engine's state: zooming about a point on screen, and the stop a step lands
// on.

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

/**
 * A step from the world frames the region under the pointer. The combination's frame can be wider than a region:
 * once it is reached, return null so normal zoom stops take over instead of framing the same view again.
 */
export function overviewStep(
	base: number,
	regionScale: number,
	dir: 1 | -1,
	home: () => Cam,
	frame: () => Cam,
): Cam | null {
	if (base >= regionScale * 0.9) return null
	if (dir < 0) return home()
	const target = frame()
	return base < target.s * 0.9 ? target : null
}

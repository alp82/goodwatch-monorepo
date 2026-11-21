// Where a flag goes when a country on the world map wears it: the box of
// the country's largest part, not of all its parts, so the United States' flag covers the lower 48 and not Alaska too,
// and France's flag covers France and not French Guiana. Parts outside the box show the land under the flag.
import type { WorldShape } from "~/ui/browse/world-map/shapes"

type Box = readonly [number, number, number, number]

/** Every flag file in public/flags is drawn on a 513 × 342 canvas (3:2). */
export const FLAG_RATIO = 513 / 342

/**
 * Where a flag image goes so it covers the box [x, y, w, h] completely, centered (what `slice` should do). Browsers
 * apply an SVG file's own `meet` to an `<image>` that shows it, so `preserveAspectRatio="xMidYMid slice"` alone leaves
 * the box's edges bare; this places the image by hand instead.
 */
export function flagCover(x: number, y: number, w: number, h: number) {
	if (w / h > FLAG_RATIO) {
		const fh = w / FLAG_RATIO
		return { x, y: y + (h - fh) / 2, width: w, height: fh }
	}
	const fw = h * FLAG_RATIO
	return { x: x + (w - fw) / 2, y, width: fw, height: h }
}

const cache = new Map<string, Box>()

/** The box [x0, y0, x1, y1] of a shape's largest part (by area), in map units. */
export function flagBox(shape: Pick<WorldShape, "code" | "d" | "box">): Box {
	const key = shape.code || shape.d.slice(0, 32)
	const hit = cache.get(key)
	if (hit) return hit
	const box = largestPart(shape.d) ?? shape.box
	cache.set(key, box)
	return box
}

/**
 * Walks the outline (the generator writes absolute `M`, relative `l`, `h`, `v` and `z`; other commands are read as their
 * absolute or relative selves) and keeps the part with the largest area.
 */
function largestPart(d: string): Box | null {
	const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g)
	if (!tokens) return null
	let best: { area: number; box: Box } | null = null
	let pts: [number, number][] = []
	let x = 0
	let y = 0
	let cmd = ""
	const close = () => {
		if (pts.length < 3) {
			pts = []
			return
		}
		let a = 0
		let x0 = Number.POSITIVE_INFINITY
		let y0 = Number.POSITIVE_INFINITY
		let x1 = Number.NEGATIVE_INFINITY
		let y1 = Number.NEGATIVE_INFINITY
		for (let i = 0; i < pts.length; i++) {
			const [px, py] = pts[i]
			const [qx, qy] = pts[(i + 1) % pts.length]
			a += px * qy - qx * py
			if (px < x0) x0 = px
			if (py < y0) y0 = py
			if (px > x1) x1 = px
			if (py > y1) y1 = py
		}
		const area = Math.abs(a) / 2
		if (!best || area > best.area) best = { area, box: [x0, y0, x1, y1] }
		pts = []
	}
	let i = 0
	const num = () => Number(tokens[i++])
	while (i < tokens.length) {
		const t = tokens[i]
		if (/[a-zA-Z]/.test(t)) {
			cmd = t
			i++
			if (cmd === "z" || cmd === "Z") close()
			continue
		}
		switch (cmd) {
			case "M":
				close()
				x = num()
				y = num()
				pts.push([x, y])
				cmd = "L"
				break
			case "m":
				close()
				x += num()
				y += num()
				pts.push([x, y])
				cmd = "l"
				break
			case "L":
				x = num()
				y = num()
				pts.push([x, y])
				break
			case "l":
				x += num()
				y += num()
				pts.push([x, y])
				break
			case "H":
				x = num()
				pts.push([x, y])
				break
			case "h":
				x += num()
				pts.push([x, y])
				break
			case "V":
				y = num()
				pts.push([x, y])
				break
			case "v":
				y += num()
				pts.push([x, y])
				break
			default:
				i++
		}
	}
	close()
	return (best as { area: number; box: Box } | null)?.box ?? null
}

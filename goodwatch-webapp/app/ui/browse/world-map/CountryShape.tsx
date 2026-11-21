// One country's outline on its own, from the world map's shapes: for a
// card or a heading whose identity is the country. It draws in `currentColor`, so the text color colors it.
//
// The world map is one flat projection (Equal Earth), which squashes the far north: Canada on its own looks flat. So a
// lone country is taken off the map and drawn as it looks on a globe turned to face it (an equal-area view centered on
// the country). A territory too small to have a shape of its own (Hong Kong) is drawn as a lit point on its coast.
import { SHAPE_BY_CODE } from "./geometry.ts"
import { WORLD_SHAPES } from "./shapes.ts"

type Box = [number, number, number, number]
type Point = [number, number]

// The map's canvas: Equal Earth turned 10° east, fitted by build-shapes.mjs. Scale and offsets measured from eight
// countries with well-known extents (every edge within half a canvas unit).
const K = 187.9
const TX = 494.9
const TY = 245.22
const A1 = 1.340264
const A2 = -0.081106
const A3 = 0.000893
const A4 = 0.003796
const M = Math.sqrt(3) / 2

/** A canvas point back to longitude and latitude (radians, longitude in the map's turned frame). */
function unproject(X: number, Y: number): Point {
	const x = (X - TX) / K
	const y = (TY - Y) / K
	let l = y
	for (let i = 0; i < 12; i++) {
		const l2 = l * l
		const l6 = l2 * l2 * l2
		const step =
			(l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y) /
			(A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))
		l -= step
		if (Math.abs(step) < 1e-9) break
	}
	const l2 = l * l
	const l6 = l2 * l2 * l2
	const lon = (M * x * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))) / Math.cos(l)
	const lat = Math.asin(Math.max(-1, Math.min(1, Math.sin(l) / M)))
	return [lon, lat]
}

/** The globe turned to face (lon0, lat0), flattened without changing areas (Lambert azimuthal). North is up. */
function face(lon: number, lat: number, lon0: number, lat0: number): Point {
	const d = lon - lon0
	const c = 1 + Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(d)
	const k = Math.sqrt(2 / Math.max(c, 1e-6))
	return [
		k * Math.cos(lat) * Math.sin(d),
		-k * (Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(d)),
	]
}

/** The outline's parts as canvas points (the data only uses M, l and z), each with its box. */
function partsOf(d: string): { points: Point[]; box: Box }[] {
	return d
		.split("M")
		.filter(Boolean)
		.map((part) => {
			const n = (part.match(/-?\d*\.?\d+/g) ?? []).map(Number)
			let [x, y] = [n[0] ?? 0, n[1] ?? 0]
			const points: Point[] = [[x, y]]
			const box: Box = [x, y, x, y]
			for (let i = 2; i + 1 < n.length; i += 2) {
				x += n[i]
				y += n[i + 1]
				points.push([x, y])
				box[0] = Math.min(box[0], x)
				box[1] = Math.min(box[1], y)
				box[2] = Math.max(box[2], x)
				box[3] = Math.max(box[3], y)
			}
			return { points, box }
		})
}

interface Drawn {
	/** The country in a box whose longer side is 100. */
	d: string
	w: number
	h: number
	/** A territory too small for a shape: the land around it, and where it sits (same box, 100 × 100). */
	around?: string
	at?: Point
}

const cache = new Map<string, Drawn | null>()
const r1 = (n: number) => Math.round(n * 10) / 10
const pathOf = (rings: Point[][]) =>
	rings.map((ring) => `M${ring.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}Z`).join("")

/**
 * The country's main body: its largest part and every part close to it (Japan's islands, Sicily), without the parts
 * that lie far off (Alaska, Hawaii), which would shrink the body to a speck.
 */
function draw(code: string): Drawn | null {
	const hit = cache.get(code)
	if (hit !== undefined) return hit
	const shape = SHAPE_BY_CODE.get(code)
	let out: Drawn | null = null
	if (shape?.d) {
		const parts = partsOf(shape.d)
		const area = (b: Box) => (b[2] - b[0]) * (b[3] - b[1])
		const main = parts.reduce((a, b) => (area(b.box) > area(a.box) ? b : a), parts[0])
		const reach = Math.max(main.box[2] - main.box[0], main.box[3] - main.box[1]) * 0.07
		const kept = parts.filter((p) => {
			const gapX = Math.max(0, p.box[0] - main.box[2], main.box[0] - p.box[2])
			const gapY = Math.max(0, p.box[1] - main.box[3], main.box[1] - p.box[3])
			return p === main || Math.hypot(gapX, gapY) <= reach
		})
		const globe = kept.map((p) => p.points.map(([x, y]) => unproject(x, y)))
		const flat = globe.flat()
		const lon0 = (Math.min(...flat.map((p) => p[0])) + Math.max(...flat.map((p) => p[0]))) / 2
		const lat0 = (Math.min(...flat.map((p) => p[1])) + Math.max(...flat.map((p) => p[1]))) / 2
		const span =
			Math.max(
				Math.max(...flat.map((p) => p[1])) - Math.min(...flat.map((p) => p[1])),
				(Math.max(...flat.map((p) => p[0])) - Math.min(...flat.map((p) => p[0]))) * Math.cos(lat0),
			) *
			(180 / Math.PI)
		if (span < 1.5) {
			// Too small for a shape of its own: a window of about 2,000 km around it, with the land in it.
			const half = 0.2
			const to = ([lon, lat]: Point): Point => {
				const [x, y] = face(lon, lat, lon0, lat0)
				return [50 + (x / half) * 50, 50 + (y / half) * 50]
			}
			const reachPx = half * K * 1.6
			const cx = (main.box[0] + main.box[2]) / 2
			const cy = (main.box[1] + main.box[3]) / 2
			const rings: Point[][] = []
			for (const other of WORLD_SHAPES) {
				if (!other.d || other.code === code) continue
				for (const p of partsOf(other.d)) {
					if (
						p.box[2] < cx - reachPx ||
						p.box[0] > cx + reachPx ||
						p.box[3] < cy - reachPx ||
						p.box[1] > cy + reachPx
					)
						continue
					rings.push(p.points.map(([x, y]) => to(unproject(x, y))))
				}
			}
			out = { d: "", w: 100, h: 100, around: pathOf(rings), at: [50, 50] }
		} else {
			const rings = globe.map((ring) => ring.map(([lon, lat]) => face(lon, lat, lon0, lat0)))
			const all = rings.flat()
			const x0 = Math.min(...all.map((p) => p[0]))
			const y0 = Math.min(...all.map((p) => p[1]))
			const w = Math.max(...all.map((p) => p[0])) - x0
			const h = Math.max(...all.map((p) => p[1])) - y0
			const s = 100 / Math.max(w, h, 1e-9)
			out = {
				d: pathOf(rings.map((ring) => ring.map(([x, y]): Point => [(x - x0) * s, (y - y0) * s]))),
				// Whole numbers: the server and the browser don't agree on the last digits of a sine.
				w: Math.max(Math.round(w * s), 1),
				h: Math.max(Math.round(h * s), 1),
			}
		}
	}
	cache.set(code, out)
	return out
}

/**
 * The country's outline as `CountryShape` draws it: a path in a box whose longer side is 100 (`w` × `h`). Null for a
 * code without an outline and for a territory too small for one (Hong Kong). For fills of your own (a flag).
 */
export function countryOutline(
	code: string | undefined,
): { d: string; w: number; h: number } | null {
	const drawn = code ? draw(code.toUpperCase()) : null
	return drawn?.d ? { d: drawn.d, w: drawn.w, h: drawn.h } : null
}

/** Whether the map has an outline (or a point) for the country. */
export const hasCountryShape = (code: string | undefined) =>
	Boolean(code && draw(code.toUpperCase()))

/**
 * `code` is the ISO 3166-1 alpha-2 code (any case). `size` is the box's longer side in px; the outline keeps its
 * proportions inside it. Far-off parts (Alaska, Hawaii) are left out so the main body fills the box. Renders nothing
 * for a code the map has no outline for. A very small territory (Hong Kong) is a lit point on the coast around it,
 * `size` px square.
 */
export function CountryShape({
	code,
	size = 64,
	className = "",
	title,
}: {
	code: string
	size?: number
	className?: string
	/** Read aloud; leave out when the country's name stands next to it. */
	title?: string
}) {
	const drawn = draw(code.toUpperCase())
	if (!drawn) return null
	const label = {
		role: title ? ("img" as const) : undefined,
		"aria-label": title,
		"aria-hidden": title ? undefined : (true as const),
	}
	if (drawn.around !== undefined && drawn.at) {
		// A round window on the coast, so it reads as a place on the map and not as a shape.
		const clip = `country-window-${code.toLowerCase()}`
		return (
			<svg
				viewBox="0 0 100 100"
				width={size}
				height={size}
				{...label}
				className={`shrink-0 ${className}`}
			>
				<clipPath id={clip}>
					<circle cx={50} cy={50} r={49} />
				</clipPath>
				<circle cx={50} cy={50} r={49} fill="currentColor" opacity={0.06} />
				<path d={drawn.around} fill="currentColor" opacity={0.3} clipPath={`url(#${clip})`} />
				<circle cx={50} cy={50} r={49} fill="none" stroke="currentColor" strokeOpacity={0.25} />
				<circle cx={drawn.at[0]} cy={drawn.at[1]} r={12} fill="currentColor" opacity={0.25} />
				<circle cx={drawn.at[0]} cy={drawn.at[1]} r={5} fill="currentColor" />
			</svg>
		)
	}
	// A hair of room so the outline doesn't touch the box.
	const pad = 1.5
	const scale = size / 100
	return (
		<svg
			viewBox={`${-pad} ${-pad} ${drawn.w + pad * 2} ${drawn.h + pad * 2}`}
			width={Math.max(1, Math.round(drawn.w * scale))}
			height={Math.max(1, Math.round(drawn.h * scale))}
			{...label}
			className={`shrink-0 ${className}`}
		>
			<path d={drawn.d} fill="currentColor" />
		</svg>
	)
}

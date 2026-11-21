// One-off generator for shapes.ts. NOT imported by the app and not part of its build: run it in a scratch directory
// outside the repository:
//   npm i d3-geo d3-geo-projection topojson-client topojson-server topojson-simplify world-atlas polylabel \
//     i18n-iso-countries countries-list
//   node build-shapes.mjs 0.5 5 3   (simplification threshold, Europe factor, East Asia factor) -> shapes.ts
import fs from "node:fs"
import { createRequire } from "node:module"
import { geoEqualEarth, geoPath } from "d3-geo"
import { geoProject } from "d3-geo-projection"
import { feature } from "topojson-client"
import { topology } from "topojson-server"
import { presimplify, simplify, filter, filterWeight } from "topojson-simplify"
import polylabelPkg from "polylabel"
const polylabel = polylabelPkg.default ?? polylabelPkg
const require = createRequire(import.meta.url)
const iso = require("i18n-iso-countries")
const { countries: CL } = require("countries-list")

const W = 1000
const MIN_W = Number(process.argv[2] ?? 0.09)
const EU_F = Number(process.argv[3] ?? 5)
const EA_F = Number(process.argv[4] ?? 3) // simplification threshold, planar area in px²
const world = JSON.parse(fs.readFileSync("node_modules/world-atlas/countries-50m.json", "utf8"))
let feats = feature(world, world.objects.countries).features.filter((f) => f.id !== "010")

const projection = geoEqualEarth().rotate([-10, 0])
projection.fitWidth(W, { type: "FeatureCollection", features: feats })
const projected = {
	type: "FeatureCollection",
	features: feats.map((f, i) => ({
		...geoProject(f, projection),
		id: f.id,
		properties: { ...f.properties, i },
	})),
}
// Crop the empty south: everything below Tierra del Fuego.
function boxOfLater(lon0, lat0, lon1, lat1) {
	const pts = []
	for (let i = 0; i <= 10; i++) {
		const lon = lon0 + ((lon1 - lon0) * i) / 10
		const lat = lat0 + ((lat1 - lat0) * i) / 10
		pts.push(
			projection([lon, lat0]),
			projection([lon, lat1]),
			projection([lon0, lat]),
			projection([lon1, lat]),
		)
	}
	const xs = pts.map((p) => p[0])
	const ys = pts.map((p) => p[1])
	return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}
let topo = topology({ c: projected }, 1e5)
topo = presimplify(topo)
// Finer where people will zoom: Europe, then East Asia. A point survives when weight * factor >= MIN_W.
const eu = boxOfLater(-12, 34, 46, 71)
const ea = boxOfLater(98, 18, 148, 46)
const inBox = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]
for (const arc of topo.arcs)
	for (const p of arc) {
		if (!Number.isFinite(p[2])) continue
		if (inBox(eu, p[0], p[1])) p[2] *= EU_F
		else if (inBox(ea, p[0], p[1])) p[2] *= EA_F
	}
topo = simplify(topo, MIN_W)
topo = filter(topo, filterWeight(topo, 0.35))
const out = feature(topo, topo.objects.c).features

const planar = geoPath(null)
const KEEP = new Set(["344", "702", "446", "442", "470", "352"])
const REGION = {
	NA: "americas",
	SA: "americas",
	EU: "europe",
	AS: "asia",
	OC: "asia",
	AF: "africa",
}
const OVERRIDE = {
	TR: "europe",
	RU: "europe",
	CY: "europe",
	GE: "europe",
	AM: "europe",
	AZ: "europe",
	GL: "americas",
}
const r1 = (n) => Math.round(n * 10) / 10
const num = (n) => {
	const s = String(r1(n))
	return s.startsWith("0.") ? s.slice(1) : s.startsWith("-0.") ? `-${s.slice(2)}` : s
}
function ringPath(ring) {
	let d = ""
	let px = 0
	let py = 0
	ring.forEach(([x, y], i) => {
		if (i === ring.length - 1) return
		const X = r1(x)
		const Y = r1(y)
		if (i === 0) d += `M${num(X)},${num(Y)}`
		else {
			const dx = r1(X - px)
			const dy = r1(Y - py)
			if (dx === 0 && dy === 0) return
			const sy = num(dy)
			d += `${i === 1 ? "l" : " "}${num(dx)}${sy.startsWith("-") ? "" : ","}${sy}`
		}
		px = X
		py = Y
	})
	return `${d}z`
}
const polys = (g) =>
	!g ? [] : g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []
const area = (p) => Math.abs(planar.area({ type: "Polygon", coordinates: p }))

let maxY = 0
const rows = []
const simplified = new Map(out.map((f) => [f.properties.i, f]))
for (const full of projected.features) {
	const f = simplified.get(full.properties.i) ?? { geometry: null }
	f.id = full.id
	f.properties = full.properties
	const ps = polys(f.geometry).filter((p) => p[0].length >= 4)
	const fullPs = polys(full.geometry)
	if (!fullPs.length) continue
	const main = fullPs.reduce((a, b) => (area(a) >= area(b) ? a : b))
	if (!ps.length && area(main) < 0.05 && !KEEP.has(full.id)) continue
	// The box to frame the country by: its largest part and every part at least 8% as large (Japan's and New
	// Zealand's islands, Sicily), but not the far-flung ones (Alaska, French Guiana, Svalbard).
	const MAIN_ONLY = new Set(["840", "250", "578", "528", "643"])
	const parts = MAIN_ONLY.has(full.id) ? [main] : fullPs.filter((p) => area(p) >= area(main) * 0.08)
	let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
	for (const p of parts) {
		const [[a, b], [c, d]] = planar.bounds({ type: "Polygon", coordinates: p })
		x0 = Math.min(x0, a)
		y0 = Math.min(y0, b)
		x1 = Math.max(x1, c)
		y1 = Math.max(y1, d)
	}
	const [lx, ly] = polylabel(main, 0.5)
	const code = f.id
		? (iso.numericToAlpha2(f.id) ?? "")
		: f.properties?.name === "Kosovo"
			? "XK"
			: ""
	const region = OVERRIDE[code] ?? REGION[CL[code]?.continent] ?? ""
	const d = ps.map((p) => p.map(ringPath).join("")).join("")
	if (ps.length) maxY = Math.max(maxY, planar.bounds(f)[1][1])
	rows.push({
		code,
		name: f.properties?.name ?? "",
		region,
		d,
		at: [r1(lx), r1(ly)],
		box: [r1(x0), r1(y0), r1(x1), r1(y1)],
	})
}
{
	const byCode = new Map()
	for (let i = rows.length - 1; i >= 0; i--) {
		const r = rows[i]
		if (!r.code) continue
		const first = byCode.get(r.code)
		if (!first) byCode.set(r.code, r)
		else {
			// Keep the larger part's label and box; join the outlines.
			const big = (x) => (x.box[2] - x.box[0]) * (x.box[3] - x.box[1])
			const [keep, drop] = big(first) >= big(r) ? [first, r] : [r, first]
			keep.d += drop.d
			byCode.set(r.code, keep)
			rows.splice(rows.indexOf(drop), 1)
		}
	}
}
rows.sort((a, b) => (a.code || "~").localeCompare(b.code || "~"))
let wx0 = Infinity
let wx1 = -Infinity
for (const f of out)
	for (const p of polys(f.geometry)) {
		if (area(p) < 2) continue
		const [[x0], [x1]] = planar.bounds({ type: "Polygon", coordinates: p })
		wx0 = Math.min(wx0, x0)
		wx1 = Math.max(wx1, x1)
	}
const worldBox = [Math.floor(wx0 - 8), 0, Math.ceil(wx1 + 8), 0]
const H = Math.ceil(maxY + 4)
const boxOf = (lon0, lat0, lon1, lat1) => boxOfLater(lon0, lat0, lon1, lat1).map(r1)
worldBox[3] = H
const regions = {
	world: worldBox,
	americas: boxOf(-128, -56, -34, 62),
	europe: boxOf(-24, 35, 40, 70),
	asia: boxOf(62, -46, 178, 54),
	africa: boxOf(-20, -36, 60, 38),
}
const body = `// GENERATED by build-shapes.mjs (Natural Earth 1:50m via world-atlas, Equal Earth, rotated 10° east), then formatted.
// Do not edit by hand.
// Each country: ISO code ("" where it has none), region, the label point inside its largest part, the box of its main parts
// [x0, y0, x1, y1], and its outline as an SVG path. All in a ${W} × ${H} canvas.
export type WorldRegion = "americas" | "europe" | "asia" | "africa"
export type WorldView = WorldRegion | "world"
export interface WorldShape {
	code: string
	region: WorldRegion | ""
	at: readonly [number, number]
	box: readonly [number, number, number, number]
	d: string
}
export const WORLD_WIDTH = ${W}
export const WORLD_HEIGHT = ${H}
export const VIEW_BOX: Record<WorldView, readonly [number, number, number, number]> = ${JSON.stringify(regions)}
export const WORLD_SHAPES: readonly WorldShape[] = [
${rows.map((r) => `\t{ code: ${JSON.stringify(r.code)}, region: ${JSON.stringify(r.region)}, at: [${r.at}], box: [${r.box}], d: ${JSON.stringify(r.d)} },`).join("\n")}
]
`
fs.writeFileSync("shapes.ts", body)
console.log("countries", rows.length, "height", H, "bytes", body.length)

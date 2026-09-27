import {
	AdapterUnavailable,
	CANVAS_PIXEL_RATIO_CAP,
	type SeaAdapter,
	type SeaFrame,
	fitBackingStore,
} from "./adapter"
import { type IslandShape, type Rgb, TILE_SIZE } from "./types"

// The last resort, without shaders or animation: the same island shapes and shorelines as the shader, the backdrop
// collage clipped into each island, a rim light, soft shadows, fog from a prerendered noise tile, and a vignette.

const clamp = (v: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, v))
const css = (c: Rgb, alpha = 1) =>
	`rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${alpha})`
const scaled = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k]
const towardWhite = (c: Rgb, k: number): Rgb => [
	c[0] + (1 - c[0]) * k,
	c[1] + (1 - c[1]) * k,
	c[2] + (1 - c[2]) * k,
]

/** The shader's wobbly outline radius at angle a. */
const outlineRadius = (r: number, seed: number, a: number) =>
	r *
	(1 +
		0.055 * Math.sin(3 * a + seed) +
		0.035 * Math.sin(5 * a + seed * 2.3) +
		0.03 * Math.sin(2 * a + seed * 0.7))

let fogTileCache: HTMLCanvasElement | null = null
/** A tileable fog texture (value noise, four octaves), made once per page. */
function fogTile() {
	if (fogTileCache) return fogTileCache
	const size = 256
	const canvas = document.createElement("canvas")
	canvas.width = size
	canvas.height = size
	const g = canvas.getContext("2d") as CanvasRenderingContext2D
	const image = g.createImageData(size, size)
	const random = (x: number, y: number, period: number) => {
		const h =
			Math.sin(
				(((x % period) + period) % period) * 127.1 +
					(((y % period) + period) % period) * 311.7 +
					period * 17.3,
			) * 43758.5453
		return h - Math.floor(h)
	}
	const value = (x: number, y: number, period: number) => {
		const x0 = Math.floor(x)
		const y0 = Math.floor(y)
		const fx = x - x0
		const fy = y - y0
		const sx = fx * fx * (3 - 2 * fx)
		const sy = fy * fy * (3 - 2 * fy)
		const a = random(x0, y0, period)
		const b = random(x0 + 1, y0, period)
		const c = random(x0, y0 + 1, period)
		const d = random(x0 + 1, y0 + 1, period)
		return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
	}
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) {
			let v = 0
			let amplitude = 0.55
			let period = 4
			for (let octave = 0; octave < 4; octave++) {
				v += amplitude * value((x / size) * period, (y / size) * period, period)
				amplitude *= 0.5
				period *= 2
			}
			const f = clamp((v - 0.35) / 0.6, 0, 1)
			const k = (y * size + x) * 4
			image.data[k] = 118
			image.data[k + 1] = 138
			image.data[k + 2] = 190
			image.data[k + 3] = Math.round(f * f * 120)
		}
	g.putImageData(image, 0, 0)
	fogTileCache = canvas
	return canvas
}

let nightCache: HTMLCanvasElement | null = null
/** Clear within 1.2 of 3.6 radii, night at the edge: the spotlight, prerendered. */
function nightRing() {
	if (nightCache) return nightCache
	const canvas = document.createElement("canvas")
	canvas.width = 256
	canvas.height = 256
	const g = canvas.getContext("2d") as CanvasRenderingContext2D
	const gradient = g.createRadialGradient(128, 128, 0, 128, 128, 128)
	gradient.addColorStop(0, "rgba(0,0,0,0)")
	gradient.addColorStop(1.2 / 3.6, "rgba(0,0,0,0)")
	gradient.addColorStop(1, "rgba(0,0,0,1)")
	g.fillStyle = gradient
	g.fillRect(0, 0, 256, 256)
	nightCache = canvas
	return canvas
}

interface Visible {
	island: IslandShape
	slot: number
	sx: number
	sy: number
	sr: number
}

function outline(v: Visible, k = 1, dx = 0, dy = 0) {
	const path = new Path2D()
	const steps = 72
	for (let n = 0; n <= steps; n++) {
		const a = (n / steps) * Math.PI * 2
		const rr = outlineRadius(v.sr * k, v.island.seed, a)
		const x = v.sx + dx + Math.cos(a) * rr
		const y = v.sy + dy + Math.sin(a) * rr
		if (n) path.lineTo(x, y)
		else path.moveTo(x, y)
	}
	path.closePath()
	return path
}

export function createCanvas2dAdapter(canvas: HTMLCanvasElement): SeaAdapter {
	const g = canvas.getContext("2d")
	if (!g) throw new AdapterUnavailable("No Canvas 2D context")
	const tiles = new Map<number, HTMLCanvasElement>()
	const fog = g.createPattern(fogTile(), "repeat")
	let vignette: { w: number; h: number; canvas: HTMLCanvasElement } | null =
		null
	const vignetteFor = (w: number, h: number) => {
		if (vignette && vignette.w === w && vignette.h === h) return vignette.canvas
		const c = document.createElement("canvas")
		c.width = Math.max(1, Math.round(w / 2))
		c.height = Math.max(1, Math.round(h / 2))
		const v = c.getContext("2d") as CanvasRenderingContext2D
		const gradient = v.createRadialGradient(
			c.width / 2,
			c.height / 2,
			Math.min(c.width, c.height) * 0.25,
			c.width / 2,
			c.height / 2,
			Math.hypot(c.width, c.height) * 0.62,
		)
		gradient.addColorStop(0, "rgba(0,0,0,0)")
		gradient.addColorStop(1, "rgba(0,0,0,.55)")
		v.fillStyle = gradient
		v.fillRect(0, 0, c.width, c.height)
		vignette = { w, h, canvas: c }
		return c
	}

	return {
		kind: "canvas2d",
		animated: false,
		islandCapacity: Number.POSITIVE_INFINITY,
		uploadTile(slot, tile) {
			tiles.set(slot, tile)
		},
		render(frame: SeaFrame) {
			const { camera: cam, spotlight } = frame
			const W = cam.width
			const H = cam.height
			const ratio = fitBackingStore(canvas, cam, CANVAS_PIXEL_RATIO_CAP)
			g.setTransform(ratio, 0, 0, ratio, 0, 0)
			g.globalCompositeOperation = "source-over"
			g.globalAlpha = 1
			const sea = g.createLinearGradient(0, 0, 0, H)
			sea.addColorStop(0, "#060a16")
			sea.addColorStop(1, "#03050c")
			g.fillStyle = sea
			g.fillRect(0, 0, W, H)

			// Fog at a depth: it pans slower than the islands and zooms more gently.
			if (fog) {
				const unit = (Math.sqrt(cam.scale * cam.overviewScale) * 952) / 256
				fog.setTransform(
					new DOMMatrix([
						unit,
						0,
						0,
						unit,
						W / 2 - cam.x * cam.scale * 0.72,
						H / 2 - cam.y * cam.scale * 0.72,
					]),
				)
				g.globalAlpha = 0.85
				g.fillStyle = fog
				g.fillRect(0, 0, W, H)
				g.globalAlpha = 1
			}

			const visible: Visible[] = []
			frame.islands.forEach((island, i) => {
				const v = {
					island,
					slot: frame.slots[i],
					sx: W / 2 + (island.x - cam.x) * cam.scale,
					sy: H / 2 + (island.y - cam.y) * cam.scale,
					sr: island.radius * cam.scale,
				}
				const reach = v.sr * 2
				if (
					v.sr > 0.5 &&
					v.sx + reach > 0 &&
					v.sx - reach < W &&
					v.sy + reach > 0 &&
					v.sy - reach < H
				)
					visible.push(v)
			})

			// Each island's glow on the water, added.
			g.globalCompositeOperation = "lighter"
			for (const v of visible) {
				const e = clamp(v.island.emphasis, 0, 1)
				const glow = g.createRadialGradient(
					v.sx,
					v.sy,
					v.sr * 0.7,
					v.sx,
					v.sy,
					v.sr * (1.7 + 0.3 * e),
				)
				glow.addColorStop(0, css(v.island.color, 0.2 + 0.18 * e))
				glow.addColorStop(1, css(v.island.color, 0))
				g.fillStyle = glow
				g.fillRect(v.sx - v.sr * 2.1, v.sy - v.sr * 2.1, v.sr * 4.2, v.sr * 4.2)
			}
			g.globalCompositeOperation = "source-over"

			// Shadows: the island floats a little above the water.
			for (const v of visible)
				for (const [k, alpha] of [
					[1.07, 0.12],
					[1.035, 0.16],
					[1, 0.22],
				] as const) {
					g.fillStyle = `rgba(0,0,0,${alpha})`
					g.fill(outline(v, k, 0, v.sr * 0.07))
				}

			for (const v of visible) {
				const { island } = v
				const shape = outline(v)
				const e = clamp(island.emphasis, -1, 1)
				const pick = Math.max(0, island.emphasis - 1)
				const box = [
					v.sx - v.sr * 1.2,
					v.sy - v.sr * 1.2,
					v.sr * 2.4,
					v.sr * 2.4,
				] as const

				// Surf: two faint rings off the shore.
				g.lineWidth = 1.2
				g.strokeStyle = css(island.color, 0.13 * (1 - 0.6 * cam.depth))
				g.stroke(outline(v, 1.05))
				g.strokeStyle = css(island.color, 0.06 * (1 - 0.6 * cam.depth))
				g.stroke(outline(v, 1.11))

				// The land: the backdrop collage clipped to the island, graded like the shader's.
				g.save()
				g.clip(shape)
				const tile = v.slot >= 0 ? tiles.get(v.slot) : undefined
				if (tile) {
					g.fillStyle = css(scaled(island.color, 0.3))
					g.fillRect(...box)
					const s = v.sr * 1.24
					const px =
						clamp(((cam.x - island.x) / island.radius) * 0.035, -0.06, 0.06) * s
					const py =
						clamp(((cam.y - island.y) / island.radius) * 0.035, -0.06, 0.06) * s
					g.drawImage(
						tile,
						8,
						8,
						TILE_SIZE - 16,
						TILE_SIZE - 16,
						v.sx - s - px,
						v.sy - s - py,
						s * 2,
						s * 2,
					)
					// Out of focus: a "saturation" blend of grey takes the color out in proportion.
					if (island.saturation < 0.98) {
						g.globalCompositeOperation = "saturation"
						g.fillStyle = `rgba(128,128,128,${clamp(1 - island.saturation, 0, 1)})`
						g.fillRect(...box)
						g.globalCompositeOperation = "source-over"
					}
					g.fillStyle = `rgba(4,6,14,${0.18 + 0.42 * cam.depth + Math.max(0, 0.12 - 0.3 * e)})`
					g.fillRect(...box)
				} else {
					const land = g.createRadialGradient(v.sx, v.sy, 0, v.sx, v.sy, v.sr)
					land.addColorStop(0, css(scaled(island.color, 0.42)))
					land.addColorStop(1, css(scaled(island.color, 0.22)))
					g.fillStyle = land
					g.fillRect(...box)
				}
				// Rim light from the upper left, a shade on the far side.
				const lx = -0.55
				const ly = -0.83
				const rim = g.createLinearGradient(
					v.sx + lx * v.sr,
					v.sy + ly * v.sr,
					v.sx - lx * v.sr,
					v.sy - ly * v.sr,
				)
				rim.addColorStop(0, css(island.color, 0.42))
				rim.addColorStop(0.3, css(island.color, 0.04))
				rim.addColorStop(0.7, "rgba(0,0,0,0)")
				rim.addColorStop(1, "rgba(0,0,0,.38)")
				g.fillStyle = rim
				g.fillRect(...box)
				// Deep in, the middle sinks a little so the posters sit in a basin.
				if (cam.depth > 0.01) {
					const basin = g.createRadialGradient(
						v.sx,
						v.sy,
						0,
						v.sx,
						v.sy,
						v.sr * 0.85,
					)
					basin.addColorStop(0, `rgba(0,0,0,${0.26 * cam.depth})`)
					basin.addColorStop(1, "rgba(0,0,0,0)")
					g.fillStyle = basin
					g.fillRect(v.sx - v.sr, v.sy - v.sr, v.sr * 2, v.sr * 2)
				}
				g.restore()

				// The shoreline: a soft halo and a thin bright line.
				g.lineJoin = "round"
				g.lineWidth = 12
				g.strokeStyle = css(
					island.color,
					Math.max(0.03, 0.08 + 0.06 * e + 0.1 * pick),
				)
				g.stroke(shape)
				g.lineWidth = 5
				g.strokeStyle = css(
					island.color,
					Math.max(0.06, 0.2 + 0.12 * e + 0.2 * pick),
				)
				g.stroke(shape)
				g.lineWidth = 1.6
				g.strokeStyle = css(
					towardWhite(island.color, 0.55),
					Math.max(0.3, 0.85 + 0.15 * e),
				)
				g.stroke(shape)
			}

			if (spotlight && spotlight.strength > 0.01) {
				// The spotlight: a prerendered ring of night, and plain night beyond it.
				const R = Math.round(spotlight.radius * cam.scale * 3.6)
				const x0 = Math.round(W / 2 + (spotlight.x - cam.x) * cam.scale) - R
				const y0 = Math.round(H / 2 + (spotlight.y - cam.y) * cam.scale) - R
				g.globalAlpha = spotlight.strength
				g.drawImage(nightRing(), x0, y0, 2 * R, 2 * R)
				g.fillStyle = "rgb(0,0,0)"
				g.fillRect(0, 0, W, Math.max(0, y0))
				g.fillRect(0, y0 + 2 * R, W, Math.max(0, H - y0 - 2 * R))
				g.fillRect(0, y0, Math.max(0, x0), 2 * R)
				g.fillRect(x0 + 2 * R, y0, Math.max(0, W - x0 - 2 * R), 2 * R)
				g.globalAlpha = 1
			}
			g.drawImage(vignetteFor(W, H), 0, 0, W, H)
		},
		dispose() {
			tiles.clear()
		},
	}
}

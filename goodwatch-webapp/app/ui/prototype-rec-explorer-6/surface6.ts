// PROTOTYPE - throwaway. Images for the round-6 map (#180) and each island's surface. Every island gets one slot of a
// shared atlas texture, painted once from its best titles:
//   backdrop  a collage of its first titles' backdrops, blurred and color-graded into a soft landscape;
//   mosaic    a tilted mosaic of its poster thumbnails, softened, like a field of tiles seen from above;
//   contour   the same backdrop collage, only used faintly under glowing contour lines.
// The slot's average color becomes the island's tint (mixed with the grouping's color so islands stay apart).
import type { SurfaceStyle } from "./sea6"
import type { W } from "./wire6"

export const TMDB = "https://image.tmdb.org/t/p"

// ---------------------------------------------------------------- images

type Img = { im: HTMLImageElement; ok: boolean; bad: boolean }
const IMGS = new Map<string, Img>()
const wakers = new Set<() => void>()
export const onImage = (fn: () => void) => {
	wakers.add(fn)
	return () => wakers.delete(fn)
}
let wakeQueued = false
function wake() {
	if (wakeQueued) return
	wakeQueued = true
	requestAnimationFrame(() => {
		wakeQueued = false
		for (const f of wakers) f()
	})
}
export function image(path: string, size: string) {
	const key = size + path
	let e = IMGS.get(key)
	if (!e) {
		const im = new Image()
		im.crossOrigin = "anonymous"
		im.decoding = "async"
		const ent: Img = { im, ok: false, bad: false }
		e = ent
		im.src = `${TMDB}/${size}${path}`
		im.decode()
			.then(() => {
				ent.ok = true
				wake()
			})
			.catch(() => {
				ent.bad = true
			})
		IMGS.set(key, e)
	}
	return e
}
export const loaded = (path: string, size: string) =>
	new Promise<HTMLImageElement | null>((res) => {
		const e = image(path, size)
		if (e.ok) return res(e.im)
		e.im.decode().then(
			() => res(e.im),
			() => res(null),
		)
	})

const POSTER = ["w92", "w154", "w185", "w342", "w500"]
/** The sharpest poster already decoded, asking for the right size for px on screen. */
export function poster(path: string, px: number) {
	const want = px < 70 ? "w92" : px < 130 ? "w154" : px < 170 ? "w185" : px < 320 ? "w342" : "w500"
	const e = image(path, want)
	if (e.ok) return e.im
	for (let k = POSTER.length - 1; k >= 0; k--) {
		const o = IMGS.get(POSTER[k] + path)
		if (o?.ok) return o.im
	}
	return null
}

// ---------------------------------------------------------------- color

export const hexRgb = (c: string): [number, number, number] => [1, 3, 5].map((k) => Number.parseInt(c.slice(k, k + 2), 16) / 255) as [number, number, number]
export const rgbCss = (c: [number, number, number], a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`
/** Lift a color to a luminous one: more saturation, a floor on brightness. */
export function luminous(c: [number, number, number]): [number, number, number] {
	const mx = Math.max(...c)
	const mn = Math.min(...c)
	const l = (mx + mn) / 2
	const out = c.map((v) => l + (v - l) * 1.5) as [number, number, number]
	const m2 = Math.max(...out, 1e-3)
	const k = Math.max(0.78, m2) / m2
	return out.map((v) => Math.min(1, Math.max(0, v * k))) as [number, number, number]
}
export const mixRgb = (a: [number, number, number], b: [number, number, number], t: number) => a.map((v, k) => v + (b[k] - v) * t) as [number, number, number]

// ---------------------------------------------------------------- atlas

export const SLOT = 512
export const COLS = 4
export const ATLAS = SLOT * COLS

export function makeAtlas() {
	const c = document.createElement("canvas")
	c.width = ATLAS
	c.height = ATLAS
	const g = c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D
	g.fillStyle = "#0b1020"
	g.fillRect(0, 0, ATLAS, ATLAS)
	return c
}
export const slotRect = (slot: number) => ({ x: (slot % COLS) * SLOT, y: Math.floor(slot / COLS) * SLOT })
export const slotUv = (slot: number): [number, number, number, number] => {
	const r = slotRect(slot)
	const inset = 8 / ATLAS
	return [r.x / ATLAS + inset, r.y / ATLAS + inset, SLOT / ATLAS - 2 * inset, SLOT / ATLAS - 2 * inset]
}

function cover(g: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
	const s = Math.max(w / im.naturalWidth, h / im.naturalHeight)
	const sw = w / s
	const sh = h / s
	g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

/** Paint one island's surface; resolves with the tile and its average color (null when no image loaded). */
export async function paintSurface(items: W[], style: SurfaceStyle, color: string) {
	const tmp = document.createElement("canvas")
	tmp.width = SLOT
	tmp.height = SLOT
	const g = tmp.getContext("2d") as CanvasRenderingContext2D
	g.fillStyle = color
	g.fillRect(0, 0, SLOT, SLOT)
	if (style === "mosaic") {
		const ims = await Promise.all(items.slice(0, 30).map((it) => (it.p ? loaded(it.p, "w92") : Promise.resolve(null))))
		const ok = ims.filter((x): x is HTMLImageElement => !!x)
		if (!ok.length) return null
		g.fillStyle = "#05070c"
		g.fillRect(0, 0, SLOT, SLOT)
		g.save()
		g.translate(SLOT / 2, SLOT / 2)
		g.rotate(-0.12)
		const tw = 74
		const th = 111
		let k = 0
		for (let row = -4; row <= 4; row++)
			for (let col = -5; col <= 5; col++) {
				const im = ok[k++ % ok.length]
				const x = col * (tw + 6) + (row % 2 ? tw / 2 : 0) - tw / 2
				const y = row * (th + 6) - th / 2
				cover(g, im, x, y, tw, th)
			}
		g.restore()
		const t2 = document.createElement("canvas")
		t2.width = SLOT
		t2.height = SLOT
		const g2 = t2.getContext("2d") as CanvasRenderingContext2D
		g2.filter = "blur(1.6px) saturate(1.15) brightness(.95)"
		g2.drawImage(tmp, 0, 0)
		g.drawImage(t2, 0, 0)
	} else {
		const withB = items.filter((it) => it.b).slice(0, 4)
		const ims = (await Promise.all(withB.map((it) => loaded(it.b, "w300")))).filter((x): x is HTMLImageElement => !!x)
		if (!ims.length) return null
		// Each backdrop fills the tile and fades out from its own center, so they melt into one landscape.
		g.fillStyle = "#070a14"
		g.fillRect(0, 0, SLOT, SLOT)
		const spots = [
			[0.32, 0.34],
			[0.7, 0.3],
			[0.3, 0.72],
			[0.72, 0.7],
		]
		const layer = document.createElement("canvas")
		layer.width = SLOT
		layer.height = SLOT
		const gl = layer.getContext("2d") as CanvasRenderingContext2D
		ims.forEach((im, k) => {
			const [sx, sy] = ims.length === 1 ? [0.5, 0.5] : spots[k % spots.length]
			gl.globalCompositeOperation = "source-over"
			gl.clearRect(0, 0, SLOT, SLOT)
			cover(gl, im, 0, 0, SLOT, SLOT)
			gl.globalCompositeOperation = "destination-in"
			const gr = gl.createRadialGradient(sx * SLOT, sy * SLOT, 0, sx * SLOT, sy * SLOT, SLOT * (ims.length === 1 ? 0.8 : 0.52))
			gr.addColorStop(0, "rgba(0,0,0,1)")
			gr.addColorStop(0.55, "rgba(0,0,0,.75)")
			gr.addColorStop(1, "rgba(0,0,0,0)")
			gl.fillStyle = gr
			gl.fillRect(0, 0, SLOT, SLOT)
			g.drawImage(layer, 0, 0)
		})
		const t2 = document.createElement("canvas")
		t2.width = SLOT
		t2.height = SLOT
		const g2 = t2.getContext("2d") as CanvasRenderingContext2D
		g2.filter = "blur(9px) saturate(1.3)"
		g2.drawImage(tmp, -40, -40, SLOT + 80, SLOT + 80)
		g.filter = "none"
		g.drawImage(t2, 0, 0)
		// A little of the sharp picture back in the middle, like light through water.
		g.globalAlpha = 0.3
		g.filter = "blur(2px)"
		g.drawImage(tmp, 0, 0)
		g.globalAlpha = 1
		g.filter = "none"
	}
	// Color grade toward the grouping's color.
	g.globalCompositeOperation = "soft-light"
	g.fillStyle = color
	g.fillRect(0, 0, SLOT, SLOT)
	g.globalCompositeOperation = "source-over"
	// The average color.
	const one = document.createElement("canvas")
	one.width = 1
	one.height = 1
	const g1 = one.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D
	g1.drawImage(tmp, 0, 0, 1, 1)
	const d = g1.getImageData(0, 0, 1, 1).data
	return { tile: tmp, avg: [d[0] / 255, d[1] / 255, d[2] / 255] as [number, number, number] }
}

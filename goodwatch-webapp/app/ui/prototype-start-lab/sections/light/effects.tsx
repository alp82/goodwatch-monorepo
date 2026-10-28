// PROTOTYPE (start page lab, round 12): mood lighting c and d's film effects over the room (grain, vignette, bloom,
// scanlines, contrast) and d's letterbox bars and dimmed shelves, per the tables in ./tables. Everything is drawn once
// (noise, bloom and contrast images on canvases) and then only fades (opacity) or moves (transform), so it stays at
// 60 fps; nothing animates a blur or a filter.
// Round 13: dust motes in the lamp light, a light sweep, drifting fog, a lamp flicker, sepia and moonlight (EFFECTS).
// Round 14: e's picture and film effects (halation, chroma, crt, vhs, teal, xpro, bleach, pop, leak, shafts, flare,
// lightning, rain, scratches, redrim; EFFECTS_E), and `force` (the `?fx=` explorer) turns effects on regardless of mood.
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { CINEMA, EFFECTS, type Effect, FX_SOLO } from "./tables"

/** Round 14: an effects table (c's EFFECTS or e's EFFECTS_E). */
export type EffectTable = Record<string, Partial<Record<Effect, number>>>

/** Where the scene image sits in the stage (px), its slots (normalized quads), and the band the room shows in. */
export type LightGeo = {
	src: string
	img: { left: number; top: number; width: number; height: number }
	slots: [number, number][][]
	/** The stage's width and height. */
	w: number
	h: number
	/** Letterbox edges: the room's visible band, never closer to the scene's focus (the dog) than a few px. */
	band: { top: number; bottom: number }
	/** The scene's focus (the seat and the dog), normalized [x, y, w, h]: the window sits over it. */
	focus: [number, number, number, number]
}

const GRAY_HEX = "#808080"

const CSS = `.lf{position:absolute;pointer-events:none;transition:opacity .6s ease-out}
.lf-bar{position:absolute;left:0;right:0;pointer-events:none;background:#010205;transition:transform .65s cubic-bezier(.2,.8,.2,1)}
@keyframes lf-grain{0%{transform:translate(0,0)}12.5%{transform:translate(-37px,22px)}25%{transform:translate(53px,-61px)}37.5%{transform:translate(-88px,-14px)}50%{transform:translate(19px,77px)}62.5%{transform:translate(71px,31px)}75%{transform:translate(-55px,-93px)}87.5%{transform:translate(98px,-40px)}100%{transform:translate(0,0)}}
.lf-grain{position:absolute;inset:-128px;background-size:256px 256px;animation:lf-grain .9s steps(1,end) infinite;will-change:transform}
@keyframes lf-roll{from{transform:translateY(-100%)}to{transform:translateY(var(--lf-h))}}
.lf-roll{left:0;right:0;top:0;height:34vh;animation:lf-roll 7s linear infinite;will-change:transform;background:linear-gradient(to bottom,transparent,rgb(200 170 255 / .16) 50%,transparent)}
@keyframes lf-up{from{transform:translate(0,0)}to{transform:translate(-256px,-512px)}}
.lf-dust{position:absolute;left:0;top:0;width:calc(100% + 256px);height:calc(100% + 512px);background-size:256px 512px;animation:lf-up 46s linear infinite;will-change:transform}
@keyframes lf-up2{from{transform:translate(0,0)}to{transform:translate(384px,-768px)}}
.lf-dust.lf-near{left:-384px;width:calc(100% + 384px);height:calc(100% + 768px);background-size:384px 768px;animation:lf-up2 31s linear infinite}
@keyframes lf-sweep{0%{transform:translateX(-130%) skewX(-18deg)}55%,100%{transform:translateX(250%) skewX(-18deg)}}
.lf-sweep{position:absolute;top:0;bottom:0;left:0;width:45%;animation:lf-sweep 7.5s cubic-bezier(.45,0,.55,1) infinite;will-change:transform;background:linear-gradient(90deg,transparent,rgb(255 236 210 / .22) 42%,rgb(255 244 228 / .3) 50%,rgb(255 236 210 / .22) 58%,transparent)}
@keyframes lf-drift{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.lf-fog{position:absolute;left:0;width:200%;animation:lf-drift 70s linear infinite;will-change:transform;background-repeat:repeat-x;background-size:50% 100%}
.lf-fog.lf-far{animation-duration:110s;animation-direction:reverse}
@keyframes lf-flicker{0%,100%{opacity:1}9%{opacity:.86}14%{opacity:.97}31%{opacity:.9}38%{opacity:1}57%{opacity:.84}63%{opacity:.95}82%{opacity:.9}}
.lf-flicker{position:absolute;inset:0;animation:lf-flicker 3.6s ease-in-out infinite;will-change:opacity}
@keyframes lf-breathe{0%,100%{opacity:.72}50%{opacity:1}}
.lf-breathe{position:absolute;inset:0;animation:lf-breathe 8s ease-in-out infinite;will-change:opacity}
@keyframes lf-leak{0%,100%{opacity:.2;transform:translateX(-5%)}35%{opacity:1;transform:translateX(0)}55%{opacity:.65;transform:translateX(1.5%)}75%{opacity:.95;transform:translateX(-1%)}}
.lf-leak{position:absolute;inset:0;animation:lf-leak 11s ease-in-out infinite;will-change:opacity,transform}
@keyframes lf-bolt{0%,70%{opacity:0}71%{opacity:.85}72.5%{opacity:.08}74%{opacity:1}78%,100%{opacity:0}}
.lf-bolt{position:absolute;inset:0;opacity:0;animation:lf-bolt 13s linear infinite;will-change:opacity}
@keyframes lf-flare{0%,100%{opacity:.7;transform:scaleX(.88)}50%{opacity:1;transform:scaleX(1.06)}}
.lf-flare{position:absolute;animation:lf-flare 5s ease-in-out infinite;will-change:opacity,transform}
@keyframes lf-fall{from{transform:translateY(-512px)}to{transform:translateY(0)}}
.lf-rain{position:absolute;left:0;top:0;width:100%;height:calc(100% + 512px);background-size:256px 512px;animation:lf-fall .55s linear infinite;will-change:transform}
.lf-rain.lf-slow{animation-duration:16s}
@keyframes lf-track{0%{transform:translateY(0)}55%{transform:translateY(calc(var(--lf-h) * -.16))}56%{transform:translateY(calc(var(--lf-h) * -.03))}80%{transform:translateY(calc(var(--lf-h) * -.09))}81%,100%{transform:translateY(0)}}
.lf-track{position:absolute;left:0;right:0;animation:lf-track 9s ease-in-out infinite;will-change:transform;overflow:hidden}
@keyframes lf-jump{0%{transform:translateX(0)}17%{transform:translateX(13%)}34%{transform:translateX(-9%)}51%{transform:translateX(21%)}68%{transform:translateX(4%)}85%{transform:translateX(-15%)}100%{transform:translateX(0)}}
.lf-scr{position:absolute;top:0;bottom:0;left:-25%;width:150%;animation:lf-jump 1.3s steps(1,end) infinite;will-change:transform}
.lf-grain.lf-specks{background-size:320px 320px;animation-duration:1.9s}
@media (prefers-reduced-motion:reduce){.lf,.lf-bar{transition:none}.lf-grain,.lf-roll,.lf-dust,.lf-sweep,.lf-fog,.lf-flicker,.lf-breathe,.lf-leak,.lf-bolt,.lf-flare,.lf-rain,.lf-track,.lf-scr{animation:none}}`

/** Round 14: a seeded random (park-miller), so tiles look the same on every load. */
const seeded = (seed: number) => {
	let r = seed
	return () => {
		r = (r * 16807) % 2147483647
		return r / 2147483647
	}
}

/** Round 14: a tile drawn once per id (rain streaks, drops, film specks), as a data URL. */
const tileUrls = new Map<string, string>()
function useTile(id: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D, rnd: () => number) => void) {
	const [url, setUrl] = useState(tileUrls.get(id) ?? null)
	useEffect(() => {
		const have = tileUrls.get(id)
		if (have) return setUrl(have)
		const c = document.createElement("canvas")
		c.width = w
		c.height = h
		const ctx = c.getContext("2d")
		if (!ctx) return
		paint(ctx, seeded(id.length * 7919 + w))
		const u = c.toDataURL("image/png")
		tileUrls.set(id, u)
		setUrl(u)
	}, [id])
	return url
}

/** Rain outside: thin slanted streaks (each also drawn where it wraps). */
function paintStreaks(ctx: CanvasRenderingContext2D, rnd: () => number) {
	ctx.lineCap = "round"
	for (let i = 0; i < 70; i++) {
		const x = rnd() * 256
		const y = rnd() * 512
		const len = 18 + rnd() * 34
		ctx.strokeStyle = `rgba(210,225,255,${0.18 + rnd() * 0.3})`
		ctx.lineWidth = rnd() < 0.2 ? 1.4 : 0.8
		for (const dy of [-512, 0, 512]) {
			ctx.beginPath()
			ctx.moveTo(x, y + dy)
			ctx.lineTo(x - len * 0.08, y + dy + len)
			ctx.stroke()
		}
	}
}

/** Drops on the glass: small beads with a thin trail above each. */
function paintDrops(ctx: CanvasRenderingContext2D, rnd: () => number) {
	for (let i = 0; i < 26; i++) {
		const x = rnd() * 256
		const y = rnd() * 512
		const r = 1.2 + rnd() * 2.2
		const trail = 20 + rnd() * 70
		for (const dy of [-512, 0, 512]) {
			const t = ctx.createLinearGradient(0, y + dy - trail, 0, y + dy)
			t.addColorStop(0, "rgba(200,220,255,0)")
			t.addColorStop(1, "rgba(200,220,255,.28)")
			ctx.fillStyle = t
			ctx.fillRect(x - r * 0.35, y + dy - trail, r * 0.7, trail)
			const g = ctx.createRadialGradient(x - r * 0.3, y + dy - r * 0.3, 0, x, y + dy, r)
			g.addColorStop(0, "rgba(235,245,255,.85)")
			g.addColorStop(0.6, "rgba(190,210,250,.4)")
			g.addColorStop(1, "rgba(190,210,250,0)")
			ctx.fillStyle = g
			ctx.beginPath()
			ctx.arc(x, y + dy, r, 0, Math.PI * 2)
			ctx.fill()
		}
	}
}

/** Film specks: a few dark blobs and hairs, two pale ones, mostly empty (the tile steps around, so they jump). */
function paintSpecks(ctx: CanvasRenderingContext2D, rnd: () => number) {
	for (let i = 0; i < 9; i++) {
		const x = rnd() * 320
		const y = rnd() * 320
		const light = i < 2
		const color = light ? `rgba(255,248,230,${0.35 + rnd() * 0.25})` : `rgba(12,8,4,${0.45 + rnd() * 0.35})`
		if (rnd() < 0.35) {
			// A hair: a short curved line.
			ctx.strokeStyle = color
			ctx.lineWidth = 0.9
			ctx.beginPath()
			ctx.moveTo(x, y)
			ctx.quadraticCurveTo(x + (rnd() - 0.5) * 30, y + 8 + rnd() * 14, x + (rnd() - 0.5) * 24, y + 16 + rnd() * 20)
			ctx.stroke()
		} else {
			ctx.fillStyle = color
			ctx.beginPath()
			ctx.ellipse(x, y, 0.8 + rnd() * 2.4, 0.6 + rnd() * 1.8, rnd() * Math.PI, 0, Math.PI * 2)
			ctx.fill()
		}
	}
}

/**
 * The dust tile: soft light motes on transparent (a few bigger blurry ones, many small), seamless (each mote is also
 * drawn where it wraps), made once per size.
 */
const dustUrls = new Map<string, string>()
function useDustUrl(w: number, h: number, n: number, seed: number) {
	const id = `${w}x${h}x${n}x${seed}`
	const [url, setUrl] = useState(dustUrls.get(id) ?? null)
	useEffect(() => {
		const have = dustUrls.get(id)
		if (have) return setUrl(have)
		const c = document.createElement("canvas")
		c.width = w
		c.height = h
		const ctx = c.getContext("2d")
		if (!ctx) return
		let r = seed
		const rnd = () => {
			r = (r * 16807) % 2147483647
			return r / 2147483647
		}
		for (let i = 0; i < n; i++) {
			const x = rnd() * w
			const y = rnd() * h
			const big = rnd() < 0.18
			const rad = big ? 2.2 + rnd() * 2.6 : 0.7 + rnd() * 1.1
			const a = big ? 0.35 + rnd() * 0.3 : 0.55 + rnd() * 0.45
			for (const dx of [-w, 0, w])
				for (const dy of [-h, 0, h]) {
					const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad * 2.2)
					g.addColorStop(0, `rgba(255,232,190,${a})`)
					g.addColorStop(0.45, `rgba(255,222,170,${a * 0.45})`)
					g.addColorStop(1, "rgba(255,222,170,0)")
					ctx.fillStyle = g
					ctx.fillRect(x + dx - rad * 2.2, y + dy - rad * 2.2, rad * 4.4, rad * 4.4)
				}
		}
		const u = c.toDataURL("image/png")
		dustUrls.set(id, u)
		setUrl(u)
	}, [id, w, h, n, seed])
	return url
}

/** The grain tile: monochrome noise around mid gray (neutral under overlay), made once per page. */
let grainUrl: string | null = null
function useGrainUrl() {
	const [url, setUrl] = useState(grainUrl)
	useEffect(() => {
		if (grainUrl) return setUrl(grainUrl)
		const c = document.createElement("canvas")
		c.width = c.height = 256
		const ctx = c.getContext("2d")
		if (!ctx) return
		const img = ctx.createImageData(256, 256)
		for (let i = 0; i < img.data.length; i += 4) {
			// Roughly normal around 128 (three uniforms), clipped.
			const v = Math.max(0, Math.min(255, 128 + (Math.random() + Math.random() + Math.random() - 1.5) * 110))
			img.data[i] = img.data[i + 1] = img.data[i + 2] = v
			img.data[i + 3] = 255
		}
		ctx.putImageData(img, 0, 0)
		grainUrl = c.toDataURL("image/png")
		setUrl(grainUrl)
	}, [])
	return url
}

const loaded = new Map<string, Promise<HTMLImageElement>>()
function loadImage(src: string) {
	let p = loaded.get(src)
	if (!p) {
		p = new Promise((resolve, reject) => {
			const img = new Image()
			img.decoding = "async"
			img.onload = () => resolve(img)
			img.onerror = reject
			img.src = src
		})
		loaded.set(src, p)
	}
	return p
}

/** Fills the scene's poster slots (so the live posters under them stay untouched by the effect). */
function fillSlots(ctx: CanvasRenderingContext2D, slots: [number, number][][], w: number, h: number, color: string) {
	ctx.fillStyle = color
	for (const q of slots) {
		if (q.length < 3) continue
		ctx.beginPath()
		q.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)))
		ctx.closePath()
		ctx.fill()
	}
}

/** A box blur, `passes` times, on RGB in place (separable, on a small image). */
function boxBlur(d: Uint8ClampedArray, w: number, h: number, r: number, passes: number) {
	const tmp = new Float32Array(w * h * 3)
	for (let p = 0; p < passes; p++) {
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++)
				for (let c = 0; c < 3; c++) {
					let s = 0
					let n = 0
					for (let k = -r; k <= r; k++) {
						const xx = x + k
						if (xx < 0 || xx >= w) continue
						s += d[(y * w + xx) * 4 + c]
						n++
					}
					tmp[(y * w + x) * 3 + c] = s / n
				}
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++)
				for (let c = 0; c < 3; c++) {
					let s = 0
					let n = 0
					for (let k = -r; k <= r; k++) {
						const yy = y + k
						if (yy < 0 || yy >= h) continue
						s += tmp[(yy * w + x) * 3 + c]
						n++
					}
					d[(y * w + x) * 4 + c] = s / n
				}
	}
}

/**
 * The bloom: the scene at 1/8 size, only its bright parts kept (a soft threshold on luminance), blurred, then drawn
 * over the scene with `screen` (stretched; the browser's smoothing finishes the glow).
 */
function drawBloom(c: HTMLCanvasElement, img: HTMLImageElement, slots: [number, number][][]) {
	const w = 192
	const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
	c.width = w
	c.height = h
	const ctx = c.getContext("2d", { willReadFrequently: true })
	if (!ctx) return
	ctx.drawImage(img, 0, 0, w, h)
	fillSlots(ctx, slots, w, h, "#000")
	const data = ctx.getImageData(0, 0, w, h)
	const d = data.data
	for (let i = 0; i < d.length; i += 4) {
		const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
		const k = Math.max(0, Math.min(1, (l - 140) / 90)) ** 1.4 * 1.6
		d[i] *= k
		d[i + 1] *= k
		d[i + 2] *= k
	}
	boxBlur(d, w, h, 3, 3)
	ctx.putImageData(data, 0, 0)
}

/** The contrast copy: the scene with its slots in neutral gray (soft-light leaves the posters as they are). */
function drawContrast(c: HTMLCanvasElement, img: HTMLImageElement, slots: [number, number][][]) {
	const w = Math.min(1280, img.naturalWidth)
	const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
	c.width = w
	c.height = h
	const ctx = c.getContext("2d")
	if (!ctx) return
	ctx.drawImage(img, 0, 0, w, h)
	fillSlots(ctx, slots, w, h, "#808080")
}

/** Round 14 · halation: like the bloom, but a lower threshold, a wider blur and tinted red-orange. */
function drawHalation(c: HTMLCanvasElement, img: HTMLImageElement, slots: [number, number][][]) {
	const w = 160
	const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
	c.width = w
	c.height = h
	const ctx = c.getContext("2d", { willReadFrequently: true })
	if (!ctx) return
	ctx.drawImage(img, 0, 0, w, h)
	fillSlots(ctx, slots, w, h, "#000")
	const data = ctx.getImageData(0, 0, w, h)
	const d = data.data
	for (let i = 0; i < d.length; i += 4) {
		const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
		const k = Math.max(0, Math.min(1, (l - 120) / 110)) ** 1.2 * 1.8
		d[i] = 255 * k
		d[i + 1] = 92 * k
		d[i + 2] = 34 * k
	}
	boxBlur(d, w, h, 5, 3)
	ctx.putImageData(data, 0, 0)
}

/**
 * Round 14 · split toning (teal, xpro): a soft-light map from the scene's luminance, `shadow` color in the darks
 * and `high` in the lights; the slots neutral gray afterwards (soft-light leaves the posters alone).
 */
function toned(shadow: [number, number, number], high: [number, number, number]) {
	return (c: HTMLCanvasElement, img: HTMLImageElement, slots: [number, number][][]) => {
		const w = Math.min(960, img.naturalWidth)
		const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
		c.width = w
		c.height = h
		const ctx = c.getContext("2d", { willReadFrequently: true })
		if (!ctx) return
		ctx.drawImage(img, 0, 0, w, h)
		const data = ctx.getImageData(0, 0, w, h)
		const d = data.data
		for (let i = 0; i < d.length; i += 4) {
			const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
			const u = Math.max(0, Math.min(1, (l - 0.12) / 0.6))
			const t = u * u * (3 - 2 * u)
			d[i] = shadow[0] + (high[0] - shadow[0]) * t
			d[i + 1] = shadow[1] + (high[1] - shadow[1]) * t
			d[i + 2] = shadow[2] + (high[2] - shadow[2]) * t
		}
		ctx.putImageData(data, 0, 0)
		fillSlots(ctx, slots, w, h, "#808080")
	}
}
const drawTeal = toned([0, 112, 128], [255, 146, 60])
const drawXpro = toned([40, 96, 170], [255, 236, 110])

/** Round 14 · bleach bypass: a gray copy of the scene (slots mid gray), overlaid on the room. */
function drawBleach(c: HTMLCanvasElement, img: HTMLImageElement, slots: [number, number][][]) {
	const w = Math.min(960, img.naturalWidth)
	const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
	c.width = w
	c.height = h
	const ctx = c.getContext("2d", { willReadFrequently: true })
	if (!ctx) return
	ctx.drawImage(img, 0, 0, w, h)
	const data = ctx.getImageData(0, 0, w, h)
	const d = data.data
	for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
	ctx.putImageData(data, 0, 0)
	fillSlots(ctx, slots, w, h, "#808080")
}

/** Round 14 · one color channel of the scene (slots black), for the chroma fringes and vhs's color bleed. */
function channel(keep: 0 | 2) {
	return (c: HTMLCanvasElement, img: HTMLImageElement, slots: [number, number][][]) => {
		const w = Math.min(1280, img.naturalWidth)
		const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
		c.width = w
		c.height = h
		const ctx = c.getContext("2d", { willReadFrequently: true })
		if (!ctx) return
		ctx.drawImage(img, 0, 0, w, h)
		fillSlots(ctx, slots, w, h, "#000")
		const data = ctx.getImageData(0, 0, w, h)
		const d = data.data
		for (let i = 0; i < d.length; i += 4) {
			if (keep !== 0) d[i] = 0
			d[i + 1] = 0
			if (keep !== 2) d[i + 2] = 0
		}
		ctx.putImageData(data, 0, 0)
	}
}
const drawRed = channel(0)
const drawBlue = channel(2)

/**
 * Where the scene's lamp is, normalized: its brightest warm spot after a wide blur, away from the side shelves and
 * the slots (those shelves carry their own strip lights). Found once per image; the focus's right end if none.
 */
const lamps = new Map<string, Promise<[number, number] | null>>()
function findLamp(src: string, slots: [number, number][][]) {
	let p = lamps.get(src)
	if (!p) {
		p = loadImage(src).then((img) => {
			const w = 96
			const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
			const c = document.createElement("canvas")
			c.width = w
			c.height = h
			const ctx = c.getContext("2d", { willReadFrequently: true })
			if (!ctx) return null
			ctx.drawImage(img, 0, 0, w, h)
			fillSlots(ctx, slots, w, h, "#000")
			const data = ctx.getImageData(0, 0, w, h)
			const d = data.data
			for (let i = 0; i < d.length; i += 4) {
				// Warm, bright light: luminance over a threshold, weighted toward red over blue.
				const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
				const warm = Math.max(0, d[i] - d[i + 2]) / 255
				const k = Math.max(0, (l - 150) / 105) * (0.4 + warm)
				d[i] = d[i + 1] = d[i + 2] = Math.min(255, k * 255)
			}
			boxBlur(d, w, h, 4, 2)
			let best = 0
			let at: [number, number] | null = null
			for (let y = Math.round(h * 0.2); y < Math.round(h * 0.9); y++)
				for (let x = Math.round(w * 0.14); x < Math.round(w * 0.86); x++) {
					const v = d[(y * w + x) * 4]
					if (v > best) {
						best = v
						at = [x / w, y / h]
					}
				}
			return best > 20 ? at : null
		})
		lamps.set(src, p)
	}
	return p
}

function useLamp(geo: LightGeo | null, want: boolean): [number, number] | null {
	const [lamp, setLamp] = useState<[number, number] | null>(null)
	const src = geo?.src
	// biome-ignore lint/correctness/useExhaustiveDependencies: found per scene image
	useEffect(() => {
		if (!want || !geo || !src) return
		let live = true
		findLamp(src, geo.slots)
			.then((p) => live && setLamp(p ?? [geo.focus[0] + geo.focus[2], geo.focus[1] + geo.focus[3] * 0.2]))
			.catch(() => {})
		return () => {
			live = false
		}
	}, [src, want])
	return lamp
}

function SceneCanvas({
	geo,
	o,
	blend,
	draw,
	style,
}: { geo: LightGeo; o: number; blend: CSSProperties["mixBlendMode"]; draw: typeof drawBloom; style?: CSSProperties }) {
	const ref = useRef<HTMLCanvasElement>(null)
	const [ready, setReady] = useState(false)
	const key = `${geo.src}|${geo.slots.length}`
	// biome-ignore lint/correctness/useExhaustiveDependencies: redrawn per scene image
	useEffect(() => {
		let live = true
		setReady(false)
		loadImage(geo.src)
			.then((img) => {
				if (!live || !ref.current) return
				draw(ref.current, img, geo.slots)
				setReady(true)
			})
			.catch(() => {})
		return () => {
			live = false
		}
	}, [key, draw])
	return (
		<canvas
			ref={ref}
			aria-hidden
			className="lf"
			style={{ ...geo.img, ...style, mixBlendMode: blend, opacity: ready ? o : 0 }}
		/>
	)
}

/** The effects a set of grades uses, plus the forced ones (Round 14). */
const effectsOf = (grades: string[], table: EffectTable = EFFECTS, force: Effect[] = []) => {
	const s = new Set<Effect>(force)
	for (const g of grades) for (const e of Object.keys(table[g] ?? {}) as Effect[]) s.add(e)
	return s
}

/** Round 14: the shown grade's effects, with each forced effect at least at its solo strength. */
const fxOf = (on: string | null, table: EffectTable, force: Effect[]) => {
	const base = (on && table[on]) || {}
	if (!force.length) return base
	const out: Partial<Record<Effect, number>> = { ...base }
	for (const e of force) out[e] = Math.max(out[e] ?? 0, FX_SOLO[e])
	return out
}

/**
 * Under the grade: the contrast copy (it should see the room before it's tinted). Mounts once a grade that uses it
 * has been shown, then only fades.
 */
export function LightUnder({
	on,
	mounted,
	geo,
	table = EFFECTS,
	force = [],
}: { on: string | null; mounted: string[]; geo: LightGeo | null; table?: EffectTable; force?: Effect[] }) {
	if (!geo) return null
	const used = effectsOf(mounted, table, force)
	const fx = fxOf(on, table, force)
	return (
		<>
			{used.has("contrast") ? <SceneCanvas geo={geo} o={fx.contrast ?? 0} blend="soft-light" draw={drawContrast} /> : null}
			{/* Round 14 · the tone maps (they should see the room before it's tinted, like contrast). */}
			{used.has("bleach") ? <SceneCanvas geo={geo} o={fx.bleach ?? 0} blend="overlay" draw={drawBleach} /> : null}
			{used.has("teal") ? <SceneCanvas geo={geo} o={fx.teal ?? 0} blend="soft-light" draw={drawTeal} /> : null}
			{used.has("xpro") ? <SceneCanvas geo={geo} o={fx.xpro ?? 0} blend="soft-light" draw={drawXpro} /> : null}
		</>
	)
}

/** Over the grade: bloom, vignette, scanlines, grain (c and d), then d's dimmed shelves and letterbox bars. */
export function LightOver({
	on,
	mounted,
	geo,
	cinematic,
	table = EFFECTS,
	force = [],
}: { on: string | null; mounted: string[]; geo: LightGeo | null; cinematic: boolean; table?: EffectTable; force?: Effect[] }) {
	const used = effectsOf(mounted, table, force)
	const fx = fxOf(on, table, force)
	const grain = useGrainUrl()
	const streaks = useTile("rain-streaks", 256, 512, paintStreaks)
	const drops = useTile("rain-drops", 256, 512, paintDrops)
	const specks = useTile("film-specks", 320, 320, paintSpecks)
	const cine = cinematic && on ? CINEMA[on] : undefined
	const usesCinema = cinematic && mounted.some((g) => CINEMA[g])
	const cy = geo ? (geo.band.top + geo.band.bottom) / 2 : 400
	const lampN = useLamp(geo, used.has("dust") || used.has("flicker") || used.has("flare") || used.has("redrim"))
	const dustFar = useDustUrl(256, 512, 26, 7)
	const dustNear = useDustUrl(384, 768, 14, 91)
	// In stage px: the lamp, the scene's size, and the focus box (the window is over it).
	const S = geo ? Math.max(geo.img.width, 1) : 1
	const lamp = geo && lampN ? { x: geo.img.left + lampN[0] * geo.img.width, y: geo.img.top + lampN[1] * geo.img.height } : null
	const foc = geo
		? {
				x: geo.img.left + (geo.focus[0] + geo.focus[2] / 2) * geo.img.width,
				top: geo.img.top + geo.focus[1] * geo.img.height,
				w: geo.focus[2] * geo.img.width,
				h: geo.focus[3] * geo.img.height,
			}
		: null
	// Round 14 · the window, a guess: the box just above the focus (the seat), as wide as most of it.
	const win = foc ? { x: foc.x, y: foc.top - foc.h * 0.4, w: foc.w * 0.75, h: foc.h * 0.8 } : null
	const W = geo?.w ?? 1200
	const H = geo?.h ?? 800
	const run = (e: Effect) => (fx[e] ? "running" : "paused")
	// The stage center in the scene image's own box (chroma scales around it and fades in toward the edges).
	const origin = geo ? `${Math.round(W / 2 - geo.img.left)}px ${Math.round(cy - geo.img.top)}px` : "50% 50%"
	const edgeMask = geo
		? `radial-gradient(ellipse ${Math.round(W * 0.62)}px ${Math.round(Math.max(320, (geo.band.bottom - geo.band.top) * 0.75))}px at ${Math.round(W / 2 - geo.img.left)}px ${Math.round(cy - geo.img.top)}px, transparent 30%, rgb(0 0 0 / .6) 70%, #000 100%)`
		: undefined
	return (
		<>
			<style>{CSS}</style>
			{/* Round 14 · halation: the red-orange glow around bright spots. */}
			{geo && used.has("halation") ? <SceneCanvas geo={geo} o={fx.halation ?? 0} blend="screen" draw={drawHalation} /> : null}
			{/* Round 14 · pop: a saturation boost (a fully saturated color, saturation blend, at low opacity). */}
			{used.has("pop") ? <div className="lf inset-0" style={{ opacity: fx.pop ?? 0, mixBlendMode: "saturation", background: "#ff1010" }} /> : null}
			{geo && used.has("bloom") ? <SceneCanvas geo={geo} o={fx.bloom ?? 0} blend="screen" draw={drawBloom} /> : null}
			{used.has("vignette") ? (
				<div
					className="lf inset-0"
					style={{
						opacity: fx.vignette ?? 0,
						background: `radial-gradient(ellipse ${geo ? Math.round(geo.w * 0.62) : 900}px ${geo ? Math.round(Math.max(320, (geo.band.bottom - geo.band.top) * 0.95)) : 500}px at 50% ${Math.round(cy)}px, rgb(0 0 0 / 0) 35%, rgb(0 0 0 / .45) 70%, rgb(0 0 0 / .85) 100%)`,
					}}
				/>
			) : null}
			{/* Scanlines, the rolling band and the edge tint: separate layers, so each blends with the room (a shared
			    faded parent would isolate them). */}
			{used.has("scan") ? (
				<>
					<div
						className="lf inset-0"
						style={{
							opacity: (fx.scan ?? 0) * 0.8,
							mixBlendMode: "multiply",
							background: "repeating-linear-gradient(to bottom, rgb(0 0 0 / .32) 0 1px, rgb(0 0 0 / 0) 1px 3px)",
						}}
					/>
					<div
						className="lf lf-roll"
						style={{ opacity: fx.scan ?? 0, mixBlendMode: "screen", animationPlayState: fx.scan ? "running" : "paused", "--lf-h": `${geo?.h ?? 1200}px` } as CSSProperties}
					/>
					<div
						className="lf inset-0"
						style={{
							opacity: (fx.scan ?? 0) * 0.55,
							mixBlendMode: "screen",
							background: "linear-gradient(90deg, rgb(255 40 170 / .45), rgb(255 40 170 / 0) 24%, rgb(0 220 255 / 0) 76%, rgb(0 220 255 / .45))",
						}}
					/>
				</>
			) : null}
			{/* Round 13 · sepia: a brown cast (color blend keeps the room's light and dark). */}
			{used.has("sepia") ? <div className="lf inset-0" style={{ opacity: fx.sepia ?? 0, mixBlendMode: "color", background: "rgb(140 96 52)" }} /> : null}
			{/* Round 13 · moon: cool light from the window above the seat, falling down and out over the room. */}
			{used.has("moon") && foc ? (
				<>
					<div
						className="lf inset-0"
						style={{
							opacity: fx.moon ?? 0,
							mixBlendMode: "soft-light",
							background: `radial-gradient(ellipse ${Math.round(foc.w * 1.1)}px ${Math.round(foc.h * 2.6)}px at ${Math.round(foc.x)}px ${Math.round(foc.top - foc.h * 0.35)}px, rgb(120 170 255 / .95), rgb(90 140 255 / .4) 55%, rgb(90 140 255 / 0) 100%)`,
						}}
					/>
					<div
						className="lf inset-0"
						style={{
							opacity: (fx.moon ?? 0) * 0.6,
							mixBlendMode: "screen",
							background: `radial-gradient(ellipse ${Math.round(foc.w * 0.7)}px ${Math.round(foc.h * 1.5)}px at ${Math.round(foc.x)}px ${Math.round(foc.top + foc.h * 0.15)}px, rgb(70 110 190 / .32), rgb(70 110 190 / 0) 100%)`,
						}}
					/>
				</>
			) : null}
			{/* Round 13 · flicker: the lamp's warm glow, breathing (the inner layer's opacity loops; the outer fades). */}
			{used.has("flicker") && lamp ? (
				<div className="lf inset-0" style={{ opacity: fx.flicker ?? 0, mixBlendMode: "screen" }}>
					<div
						className="lf-flicker"
						style={{
							animationPlayState: fx.flicker ? "running" : "paused",
							background: `radial-gradient(circle ${Math.round(S * 0.2)}px at ${Math.round(lamp.x)}px ${Math.round(lamp.y)}px, rgb(255 190 110 / .34), rgb(255 170 90 / .12) 45%, rgb(255 170 90 / 0) 100%)`,
						}}
					/>
				</div>
			) : null}
			{/* Round 13 · dust: two tiles of motes drifting up at two speeds, only inside the lamp's light. */}
			{used.has("dust") && lamp && dustFar && dustNear ? (
				<div
					className="lf inset-0 overflow-hidden"
					style={{
						opacity: fx.dust ?? 0,
						mixBlendMode: "screen",
						maskImage: `radial-gradient(ellipse ${Math.round(S * 0.3)}px ${Math.round(S * 0.24)}px at ${Math.round(lamp.x - S * 0.06)}px ${Math.round(lamp.y)}px, #000 0%, rgb(0 0 0 / .55) 45%, transparent 100%)`,
						WebkitMaskImage: `radial-gradient(ellipse ${Math.round(S * 0.3)}px ${Math.round(S * 0.24)}px at ${Math.round(lamp.x - S * 0.06)}px ${Math.round(lamp.y)}px, #000 0%, rgb(0 0 0 / .55) 45%, transparent 100%)`,
					}}
				>
					<div className="lf-dust" style={{ backgroundImage: `url(${dustFar})`, animationPlayState: fx.dust ? "running" : "paused" }} />
					<div className="lf-dust lf-near" style={{ backgroundImage: `url(${dustNear})`, animationPlayState: fx.dust ? "running" : "paused" }} />
				</div>
			) : null}
			{/* Round 13 · fog: two faint cool hazes over the floor and the seat, drifting opposite ways. */}
			{used.has("fog") && foc ? (
				<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.fog ?? 0, mixBlendMode: "screen" }}>
					{[0, 1].map((i) => (
						<div
							key={i}
							className={`lf-fog ${i ? "lf-far" : ""}`}
							style={{
								top: Math.round(foc.top + foc.h * (i ? -0.1 : 0.35)),
								height: Math.round(foc.h * (i ? 1.1 : 1.4)),
								animationPlayState: fx.fog ? "running" : "paused",
								backgroundImage: i
									? "radial-gradient(ellipse 30% 45% at 25% 55%, rgb(150 175 210 / .16), transparent 70%), radial-gradient(ellipse 26% 40% at 74% 40%, rgb(150 175 210 / .13), transparent 70%)"
									: "radial-gradient(ellipse 34% 50% at 18% 55%, rgb(160 185 215 / .22), transparent 72%), radial-gradient(ellipse 30% 46% at 58% 45%, rgb(160 185 215 / .18), transparent 72%), radial-gradient(ellipse 22% 40% at 90% 60%, rgb(160 185 215 / .2), transparent 72%)",
							}}
						/>
					))}
				</div>
			) : null}
			{/* Round 13 · sweep: a soft band of light crossing the room. */}
			{used.has("sweep") ? (
				<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.sweep ?? 0, mixBlendMode: "screen" }}>
					<div className="lf-sweep" style={{ animationPlayState: fx.sweep ? "running" : "paused" }} />
				</div>
			) : null}
			{/* Round 14 · chroma: the red channel a touch bigger and the blue a touch smaller, lightened over the room,
			    only toward the edges: color fringes like a cheap lens. */}
			{geo && used.has("chroma") ? (
				<>
					<SceneCanvas
						geo={geo}
						o={fx.chroma ?? 0}
						blend="lighten"
						draw={drawRed}
						style={{ transform: "scale(1.009)", transformOrigin: origin, maskImage: edgeMask, WebkitMaskImage: edgeMask }}
					/>
					<SceneCanvas
						geo={geo}
						o={fx.chroma ?? 0}
						blend="lighten"
						draw={drawBlue}
						style={{ transform: "scale(.991)", transformOrigin: origin, maskImage: edgeMask, WebkitMaskImage: edgeMask }}
					/>
				</>
			) : null}
			{/* Round 14 · crt: phosphor stripes and scanlines (each its own multiply layer, so each blends with the
			    room), then the tube's rounded dark corners (an outer shadow around a rounded box). */}
			{used.has("crt") ? (
				<>
					<div
						className="lf inset-0"
						style={{
							opacity: (fx.crt ?? 0) * 0.3,
							mixBlendMode: "multiply",
							background: "repeating-linear-gradient(90deg, rgb(255 80 80) 0 1px, rgb(80 255 80) 1px 2px, rgb(80 80 255) 2px 3px)",
						}}
					/>
					<div
						className="lf inset-0"
						style={{
							opacity: (fx.crt ?? 0) * 0.75,
							mixBlendMode: "multiply",
							background: "repeating-linear-gradient(to bottom, rgb(0 0 0 / .3) 0 1px, rgb(0 0 0 / 0) 1px 3px)",
						}}
					/>
					<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.crt ?? 0 }}>
						<div
							className="absolute"
							style={{
								inset: Math.round(Math.min(W, H) * 0.012),
								borderRadius: `${Math.round(Math.min(W, H) * 0.09)}px / ${Math.round(Math.min(W, H) * 0.12)}px`,
								boxShadow: `0 0 0 ${Math.round(Math.max(W, H))}px rgb(2 2 4 / .92), inset 0 0 ${Math.round(Math.min(W, H) * 0.14)}px ${Math.round(Math.min(W, H) * 0.03)}px rgb(0 0 0 / .7)`,
							}}
						/>
					</div>
				</>
			) : null}
			{/* Round 14 · vhs: milky blacks, a little less color, a red bleed to the right, and the tracking band. */}
			{used.has("vhs") ? (
				<>
					<div className="lf inset-0" style={{ opacity: (fx.vhs ?? 0) * 0.5, mixBlendMode: "screen", background: "rgb(44 38 62)" }} />
					<div className="lf inset-0" style={{ opacity: (fx.vhs ?? 0) * 0.3, mixBlendMode: "saturation", background: GRAY_HEX }} />
					{geo ? (
						<SceneCanvas geo={geo} o={(fx.vhs ?? 0) * 0.8} blend="lighten" draw={drawRed} style={{ transform: "translateX(5px)" }} />
					) : null}
					<div className="lf inset-0 overflow-hidden" style={{ opacity: (fx.vhs ?? 0) * 0.9, mixBlendMode: "screen" }}>
						<div
							className="lf-track"
							style={
								{
									bottom: Math.round(H * 0.05),
									height: Math.max(14, Math.round(H * 0.028)),
									animationPlayState: run("vhs"),
									"--lf-h": `${H}px`,
									background:
										"linear-gradient(90deg, rgb(255 255 255 / .05), rgb(255 255 255 / .18) 30%, rgb(255 255 255 / .1) 60%, rgb(255 255 255 / .2) 85%, rgb(255 255 255 / .06)), repeating-linear-gradient(to bottom, rgb(255 255 255 / .2) 0 1px, transparent 1px 3px)",
								} as CSSProperties
							}
						>
							{grain ? <div className="lf-grain" style={{ backgroundImage: `url(${grain})`, opacity: 0.35, animationPlayState: run("vhs") }} /> : null}
						</div>
					</div>
				</>
			) : null}
			{/* Round 14 · leak: a warm burn at the left edge, breathing in and out (opacity and a small slide). */}
			{used.has("leak") ? (
				<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.leak ?? 0, mixBlendMode: "screen" }}>
					<div
						className="lf-leak"
						style={{
							animationPlayState: run("leak"),
							background: `radial-gradient(ellipse ${Math.round(W * 0.13)}px ${Math.round(H * 0.32)}px at 0px ${Math.round(H * 0.32)}px, rgb(255 226 160 / .55), rgb(255 226 160 / 0) 100%), radial-gradient(ellipse ${Math.round(W * 0.34)}px ${Math.round(H * 0.62)}px at 0px ${Math.round(H * 0.38)}px, rgb(255 112 40 / .55), rgb(240 60 30 / .25) 45%, rgb(240 60 30 / 0) 100%)`,
						}}
					/>
				</div>
			) : null}
			{/* Round 14 · shafts: warm beams slanting down from the window, masked to fall off below it. */}
			{used.has("shafts") && win ? (
				<div
					className="lf inset-0"
					style={{
						opacity: fx.shafts ?? 0,
						mixBlendMode: "screen",
						maskImage: `radial-gradient(ellipse ${Math.round(win.w * 0.95)}px ${Math.round(win.h * 2.4)}px at ${Math.round(win.x)}px ${Math.round(win.y)}px, #000 0%, rgb(0 0 0 / .5) 50%, transparent 100%)`,
						WebkitMaskImage: `radial-gradient(ellipse ${Math.round(win.w * 0.95)}px ${Math.round(win.h * 2.4)}px at ${Math.round(win.x)}px ${Math.round(win.y)}px, #000 0%, rgb(0 0 0 / .5) 50%, transparent 100%)`,
					}}
				>
					<div
						className="lf-breathe"
						style={{
							animationPlayState: run("shafts"),
							background:
								"linear-gradient(104deg, transparent 0 34%, rgb(255 214 150 / .22) 36% 39%, transparent 41% 44%, rgb(255 214 150 / .14) 45% 46.5%, transparent 48% 50%, rgb(255 220 160 / .26) 52% 56%, transparent 58% 61%, rgb(255 214 150 / .16) 62% 64%, transparent 66% 100%)",
						}}
					/>
				</div>
			) : null}
			{/* Round 14 · flare: an anamorphic streak through the lamp, a soft haze around it and two ghosts. */}
			{used.has("flare") && lamp ? (
				<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.flare ?? 0, mixBlendMode: "screen" }}>
					<div
						className="lf-flare"
						style={{
							animationPlayState: run("flare"),
							left: Math.round(lamp.x - S * 0.5),
							top: Math.round(lamp.y - S * 0.02),
							width: Math.round(S),
							height: Math.round(S * 0.04),
							background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgb(120 170 255 / .35), rgb(120 170 255 / 0) 100%)",
						}}
					/>
					<div
						className="lf-flare"
						style={{
							animationPlayState: run("flare"),
							left: Math.round(lamp.x - S * 0.45),
							top: Math.round(lamp.y - Math.max(1, S * 0.0018)),
							width: Math.round(S * 0.9),
							height: Math.max(2, Math.round(S * 0.0036)),
							background:
								"linear-gradient(90deg, rgb(140 190 255 / 0), rgb(140 190 255 / .45) 30%, rgb(235 244 255 / .95) 50%, rgb(140 190 255 / .45) 70%, rgb(140 190 255 / 0))",
						}}
					/>
					{[1.45, 1.9].map((t, i) => {
						const gx = lamp.x + (W / 2 - lamp.x) * t
						const gy = lamp.y + (cy - lamp.y) * t
						const r = S * (i ? 0.035 : 0.022)
						return (
							<div
								key={t}
								className="absolute rounded-full"
								style={{
									left: Math.round(gx - r),
									top: Math.round(gy - r),
									width: Math.round(r * 2),
									height: Math.round(r * 2),
									background: i
										? "radial-gradient(circle, rgb(120 255 200 / 0) 55%, rgb(120 255 200 / .16) 80%, rgb(120 255 200 / 0) 100%)"
										: "radial-gradient(circle, rgb(150 170 255 / .2), rgb(150 170 255 / 0) 70%)",
								}}
							/>
						)
					})}
				</div>
			) : null}
			{/* Round 14 · redrim: deep red at the edges and a dim red glow around the lamp, breathing slowly. */}
			{used.has("redrim") ? (
				<>
					<div className="lf inset-0" style={{ opacity: fx.redrim ?? 0 }}>
						<div
							className="lf-breathe"
							style={{
								animationPlayState: run("redrim"),
								animationDuration: "6s",
								background: `radial-gradient(ellipse ${Math.round(W * 0.6)}px ${geo ? Math.round(Math.max(320, (geo.band.bottom - geo.band.top) * 0.9)) : 500}px at 50% ${Math.round(cy)}px, rgb(70 0 6 / 0) 45%, rgb(80 0 8 / .32) 72%, rgb(46 0 4 / .7) 100%)`,
							}}
						/>
					</div>
					{lamp ? (
						<div className="lf inset-0" style={{ opacity: (fx.redrim ?? 0) * 0.8, mixBlendMode: "screen" }}>
							<div
								className="lf-breathe"
								style={{
									animationPlayState: run("redrim"),
									animationDuration: "6s",
									background: `radial-gradient(circle ${Math.round(S * 0.16)}px at ${Math.round(lamp.x)}px ${Math.round(lamp.y)}px, rgb(150 12 12 / .3), rgb(120 0 0 / .1) 50%, rgb(120 0 0 / 0) 100%)`,
								}}
							/>
						</div>
					) : null}
				</>
			) : null}
			{/* Round 14 · rain: fast streaks and slow drops, only over the window. */}
			{used.has("rain") && win && streaks && drops ? (
				<div
					className="lf inset-0 overflow-hidden"
					style={{
						opacity: fx.rain ?? 0,
						mixBlendMode: "screen",
						maskImage: `radial-gradient(ellipse ${Math.round(win.w * 0.55)}px ${Math.round(win.h * 0.62)}px at ${Math.round(win.x)}px ${Math.round(win.y)}px, #000 55%, transparent 100%)`,
						WebkitMaskImage: `radial-gradient(ellipse ${Math.round(win.w * 0.55)}px ${Math.round(win.h * 0.62)}px at ${Math.round(win.x)}px ${Math.round(win.y)}px, #000 55%, transparent 100%)`,
					}}
				>
					<div className="lf-rain" style={{ backgroundImage: `url(${streaks})`, opacity: 0.7, animationPlayState: run("rain") }} />
					<div className="lf-rain lf-slow" style={{ backgroundImage: `url(${drops})`, animationPlayState: run("rain") }} />
				</div>
			) : null}
			{/* Round 14 · lightning: a rare double flash at the window and a faint lift over the room. */}
			{used.has("lightning") && win ? (
				<div className="lf inset-0" style={{ opacity: fx.lightning ?? 0, mixBlendMode: "screen" }}>
					<div
						className="lf-bolt"
						style={{
							animationPlayState: run("lightning"),
							background: `radial-gradient(ellipse ${Math.round(win.w * 0.8)}px ${Math.round(win.h * 1.1)}px at ${Math.round(win.x)}px ${Math.round(win.y)}px, rgb(205 222 255 / .7), rgb(170 195 255 / .22) 55%, rgb(170 195 255 / 0) 100%), linear-gradient(rgb(150 170 215 / .12), rgb(150 170 215 / .12))`,
						}}
					/>
				</div>
			) : null}
			{/* Round 14 · scratches: thin vertical scratches jumping every few frames, plus dark specks. */}
			{used.has("scratches") ? (
				<>
					<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.scratches ?? 0, mixBlendMode: "screen" }}>
						<div
							className="lf-scr"
							style={{
								animationPlayState: run("scratches"),
								background: [0.18, 0.43, 0.61, 0.79]
									.map((x, i) => {
										const at = Math.round(x * W * 1.5)
										const a = [0.3, 0.16, 0.24, 0.12][i]
										return `linear-gradient(90deg, transparent ${at}px, rgb(255 246 225 / ${a}) ${at}px ${at + 1}px, transparent ${at + 1}px)`
									})
									.join(", "),
							}}
						/>
					</div>
					{specks ? (
						<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.scratches ?? 0 }}>
							<div className="lf-grain lf-specks" style={{ backgroundImage: `url(${specks})`, animationPlayState: run("scratches") }} />
						</div>
					) : null}
				</>
			) : null}
			{used.has("grain") && grain ? (
				<div className="lf inset-0 overflow-hidden" style={{ opacity: fx.grain ?? 0, mixBlendMode: "overlay" }}>
					<div className="lf-grain" style={{ backgroundImage: `url(${grain})`, animationPlayState: fx.grain ? "running" : "paused" }} />
				</div>
			) : null}
			{usesCinema ? (
				<>
					<div
						className="lf inset-0"
						style={{
							opacity: cine?.shelves ?? 0,
							background:
								"linear-gradient(90deg, rgb(0 0 0 / .78) 0, rgb(0 0 0 / .5) 16%, rgb(0 0 0 / 0) 32%, rgb(0 0 0 / 0) 68%, rgb(0 0 0 / .5) 84%, rgb(0 0 0 / .78) 100%)",
						}}
					/>
					{geo ? (
						<>
							<div className="lf-bar top-0" style={{ height: geo.band.top, transform: cine?.bars ? "none" : "translateY(-100%)" }} />
							<div className="lf-bar bottom-0" style={{ top: geo.band.bottom, transform: cine?.bars ? "none" : "translateY(100%)" }} />
						</>
					) : null}
				</>
			) : null}
		</>
	)
}

// PROTOTYPE (start page lab, round 12): mood lighting c and d's film effects over the room (grain, vignette, bloom,
// scanlines, contrast) and d's letterbox bars and dimmed shelves, per the tables in ./tables. Everything is drawn once
// (noise, bloom and contrast images on canvases) and then only fades (opacity) or moves (transform), so it stays at
// 60 fps; nothing animates a blur or a filter.
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { CINEMA, EFFECTS, type Effect } from "./tables"

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
}

const CSS = `.lf{position:absolute;pointer-events:none;transition:opacity .6s ease-out}
.lf-bar{position:absolute;left:0;right:0;pointer-events:none;background:#010205;transition:transform .65s cubic-bezier(.2,.8,.2,1)}
@keyframes lf-grain{0%{transform:translate(0,0)}12.5%{transform:translate(-37px,22px)}25%{transform:translate(53px,-61px)}37.5%{transform:translate(-88px,-14px)}50%{transform:translate(19px,77px)}62.5%{transform:translate(71px,31px)}75%{transform:translate(-55px,-93px)}87.5%{transform:translate(98px,-40px)}100%{transform:translate(0,0)}}
.lf-grain{position:absolute;inset:-128px;background-size:256px 256px;animation:lf-grain .9s steps(1,end) infinite;will-change:transform}
@keyframes lf-roll{from{transform:translateY(-100%)}to{transform:translateY(var(--lf-h))}}
.lf-roll{left:0;right:0;top:0;height:34vh;animation:lf-roll 7s linear infinite;will-change:transform;background:linear-gradient(to bottom,transparent,rgb(200 170 255 / .16) 50%,transparent)}
@media (prefers-reduced-motion:reduce){.lf,.lf-bar{transition:none}.lf-grain,.lf-roll{animation:none}}`

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

function SceneCanvas({ geo, o, blend, draw }: { geo: LightGeo; o: number; blend: CSSProperties["mixBlendMode"]; draw: typeof drawBloom }) {
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
			style={{ ...geo.img, mixBlendMode: blend, opacity: ready ? o : 0 }}
		/>
	)
}

/** The effects a set of grades uses. */
const effectsOf = (grades: string[]) => {
	const s = new Set<Effect>()
	for (const g of grades) for (const e of Object.keys(EFFECTS[g] ?? {}) as Effect[]) s.add(e)
	return s
}

/**
 * Under the grade: the contrast copy (it should see the room before it's tinted). Mounts once a grade that uses it
 * has been shown, then only fades.
 */
export function LightUnder({ on, mounted, geo }: { on: string | null; mounted: string[]; geo: LightGeo | null }) {
	if (!geo || !effectsOf(mounted).has("contrast")) return null
	const o = (on && EFFECTS[on]?.contrast) || 0
	return <SceneCanvas geo={geo} o={o} blend="soft-light" draw={drawContrast} />
}

/** Over the grade: bloom, vignette, scanlines, grain (c and d), then d's dimmed shelves and letterbox bars. */
export function LightOver({ on, mounted, geo, cinematic }: { on: string | null; mounted: string[]; geo: LightGeo | null; cinematic: boolean }) {
	const used = effectsOf(mounted)
	const fx = (on && EFFECTS[on]) || {}
	const grain = useGrainUrl()
	const cine = cinematic && on ? CINEMA[on] : undefined
	const usesCinema = cinematic && mounted.some((g) => CINEMA[g])
	const cy = geo ? (geo.band.top + geo.band.bottom) / 2 : 400
	return (
		<>
			<style>{CSS}</style>
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

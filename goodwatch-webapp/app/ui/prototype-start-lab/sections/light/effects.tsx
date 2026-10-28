// PROTOTYPE (start page lab, round 12): mood lighting c and d's film effects over the room (grain, vignette, bloom,
// scanlines, contrast) and d's letterbox bars and dimmed shelves, per the tables in ./tables. Everything is drawn once
// (noise, bloom and contrast images on canvases) and then only fades (opacity) or moves (transform), so it stays at
// 60 fps; nothing animates a blur or a filter.
// Round 13: dust motes in the lamp light, a light sweep, drifting fog, a lamp flicker, sepia and moonlight (EFFECTS).
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
	/** The scene's focus (the seat and the dog), normalized [x, y, w, h]: the window sits over it. */
	focus: [number, number, number, number]
}

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
@media (prefers-reduced-motion:reduce){.lf,.lf-bar{transition:none}.lf-grain,.lf-roll,.lf-dust,.lf-sweep,.lf-fog,.lf-flicker{animation:none}}`

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
	const lampN = useLamp(geo, used.has("dust") || used.has("flicker"))
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

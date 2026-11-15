// One pixel canvas for the whole cinema while the show runs: the room around the screen, the screen with the picture on
// it, the projector's beam and the projector, all on one grid of S CSS px per pixel. Each frame draws, in order: the
// room's back layer, the screen (its surface, then the scenes' frame copied onto it), the room's front layer, the beam
// and the projector, then composites the lot once. It measures the picture's light every frame and hands it to the
// room, the beam and the projector (`lum`, `tint`) and to `onLight`, so the room and the page around the screen react
// to what is on screen. The loop runs only between `run` and `pause` or `destroy`.
import { SCREEN } from "./palace"
import {
	type FxFrame,
	type FxInstance,
	type FxModule,
	clearFrame,
	composite,
	createFrame,
	createFx,
} from "./pixelfx/core/index.js"

export interface Rect {
	x: number
	y: number
	w: number
	h: number
}

export interface CinemaLayout {
	/** CSS px per pixel. */
	S: number
	/** Where room pixel (0, 0) is in the window, in CSS px. */
	gx: number
	gy: number
	/** The room's size in pixels. */
	W: number
	H: number
	/** The screen in room pixels. */
	screen: Rect
	/** The lens (where the beam leaves) in room pixels. */
	lens: { x: number; y: number }
}

/** Steers one running effect. */
export interface Handle {
	set(opts: Record<string, unknown>): void
}

interface Live {
	fx: FxInstance
	/** Drawn as it is, without time passing (reduced motion). */
	still: boolean
	dead: boolean
}

const BASE = { r: 11, g: 11, b: 16 }
const BLANK = { r: 214, g: 206, b: 186 }

export interface CinemaStage {
	layout(l: CinemaLayout): void
	room(mod: FxModule, opts?: Record<string, unknown>): Handle
	beam(mod: FxModule, opts?: Record<string, unknown>): Handle
	projector(mod: FxModule, opts?: Record<string, unknown>): Handle
	/** Plays a scene on the screen. */
	play(mod: FxModule, opts?: Record<string, unknown>): void
	/** Draws a scene's frame at `t` seconds and keeps it (reduced motion). */
	still(mod: FxModule, t: number, opts?: Record<string, unknown>): void
	/** Ends every scene on the screen. */
	cut(): void
	/** Plain projector light on the empty screen, 0..1. */
	blank: number
	/** Called every frame with the picture's light. */
	onLight: ((lum: number, r: number, g: number, b: number) => void) | null
	/** Starts the loop, which runs until `pause` or `destroy`; `render` draws one frame without it. */
	run(): void
	pause(): void
	render(): void
	destroy(): void
}

export function createCinemaStage(canvas: HTMLCanvasElement): CinemaStage {
	const ctx = canvas.getContext("2d")
	let L: CinemaLayout | null = null
	let frame: FxFrame = createFrame(1, 1)
	let picture: FxFrame = createFrame(1, 1)
	let image: ImageData | null = null
	let roomFx: Live | null = null
	let beamFx: Live | null = null
	let projectorFx: Live | null = null
	let scenes: Live[] = []
	let raf = 0
	let last = 0
	let destroyed = false
	// the picture's light, smoothed a little so the room breathes instead of strobing
	const light = { lum: 0, r: 0, g: 0, b: 0 }

	const live = (mod: FxModule, opts: Record<string, unknown>): Live => ({
		fx: createFx(mod, opts),
		still: false,
		dead: false,
	})

	const handle = (l: Live): Handle => ({
		set(opts) {
			Object.assign(l.fx.options, opts)
		},
	})

	/** Puts the room, the beam and the projector where the layout says. */
	const place = () => {
		const l = L
		if (!l) return
		const s = l.screen
		const cx = s.x + s.w / 2
		const cy = s.y + s.h / 2
		if (roomFx)
			Object.assign(roomFx.fx.options, {
				x: cx,
				y: cy,
				vl: -cx,
				vt: -cy,
				vr: l.W - cx,
				vb: l.H - cy,
				sw: s.w,
			})
		if (beamFx)
			Object.assign(beamFx.fx.options, {
				x: l.lens.x,
				y: l.lens.y,
				sx0: s.x - l.lens.x,
				sy0: s.y - l.lens.y,
				sx1: s.x + s.w - 1 - l.lens.x,
				sy1: s.y + s.h - 1 - l.lens.y,
			})
		if (projectorFx)
			Object.assign(projectorFx.fx.options, { x: l.lens.x, y: l.lens.y })
	}

	/** Copies the picture onto the screen. */
	function blit() {
		const l = L
		if (!l) return
		const { x: X, y: Y, w: SW, h: SH } = l.screen
		const C = frame.color
		const LI = frame.light
		for (let dx = 0; dx < SW; dx++) {
			const fx = X + dx
			if (fx < 0 || fx >= frame.w) continue
			for (let dy = 0; dy < SH; dy++) {
				const fy = Y + dy
				if (fy < 0 || fy >= frame.h) continue
				const si = dy * picture.w + dx
				const c = picture.color[si]
				const i = fy * frame.w + fx
				const ca = c >>> 24
				if (ca) {
					const a = ca / 255
					const d = C[i]
					const r = (c & 255) * a + (d & 255) * (1 - a)
					const g = ((c >>> 8) & 255) * a + ((d >>> 8) & 255) * (1 - a)
					const b = ((c >>> 16) & 255) * a + ((d >>> 16) & 255) * (1 - a)
					C[i] = 0xff000000 | (b << 16) | (g << 8) | r
				}
				const sl = picture.light[si] & 0xffffff
				if (sl) {
					const d = LI[i]
					const r = Math.min(255, (d & 255) + (sl & 255))
					const g = Math.min(255, ((d >>> 8) & 255) + ((sl >>> 8) & 255))
					const b = Math.min(255, ((d >>> 16) & 255) + ((sl >>> 16) & 255))
					LI[i] = (b << 16) | (g << 8) | r
				}
			}
		}
	}

	/** The screen's surface under the picture: near black, lit warm white by plain projector light. */
	function surface() {
		const l = L
		if (!l) return
		const { x: X, y: Y, w: SW, h: SH } = l.screen
		const k = stage.blank
		const r = Math.round(BASE.r + (BLANK.r - BASE.r) * k)
		const g = Math.round(BASE.g + (BLANK.g - BASE.g) * k)
		const b = Math.round(BASE.b + (BLANK.b - BASE.b) * k)
		const c = 0xff000000 | (b << 16) | (g << 8) | r
		for (let dy = 0; dy < SH; dy++) {
			const fy = Y + dy
			if (fy < 0 || fy >= frame.h) continue
			const row = fy * frame.w
			for (let dx = 0; dx < SW; dx++) {
				const fx = X + dx
				if (fx >= 0 && fx < frame.w) frame.color[row + fx] = c
			}
		}
	}

	/** The picture's average light (sampled), smoothed, handed to the room, the beam and the projector. */
	function measure() {
		const l = L
		if (!l) return
		const { x: X, y: Y, w: SW, h: SH } = l.screen
		let r = 0
		let g = 0
		let b = 0
		let n = 0
		for (let dy = 2; dy < SH; dy += 6) {
			const fy = Y + dy
			if (fy < 0 || fy >= frame.h) continue
			for (let dx = 2; dx < SW; dx += 6) {
				const fx = X + dx
				if (fx < 0 || fx >= frame.w) continue
				const i = fy * frame.w + fx
				const c = frame.color[i]
				const li = frame.light[i]
				r += (c & 255) + (li & 255)
				g += ((c >>> 8) & 255) + ((li >>> 8) & 255)
				b += ((c >>> 16) & 255) + ((li >>> 16) & 255)
				n++
			}
		}
		if (!n) return
		r /= n
		g /= n
		b /= n
		const lum = Math.min(1, (0.3 * r + 0.55 * g + 0.15 * b) / 170)
		// fast attack (a flash lights the room at once), slow release
		const up = lum > light.lum ? 0.6 : 0.12
		light.lum += (lum - light.lum) * up
		light.r += (r - light.r) * 0.2
		light.g += (g - light.g) * 0.2
		light.b += (b - light.b) * 0.2
		const m = Math.max(1, light.r, light.g, light.b)
		const tint =
			0xff000000 |
			(Math.round((light.b / m) * 255) << 16) |
			(Math.round((light.g / m) * 255) << 8) |
			Math.round((light.r / m) * 255)
		const lit = { lum: light.lum, tint }
		if (roomFx) Object.assign(roomFx.fx.options, lit)
		if (beamFx) Object.assign(beamFx.fx.options, lit)
		if (projectorFx) Object.assign(projectorFx.fx.options, lit)
		stage.onLight?.(light.lum, light.r, light.g, light.b)
	}

	function render(dt: number) {
		if (!ctx || !image || !L) return
		clearFrame(frame)
		if (roomFx) {
			roomFx.fx.update(dt)
			roomFx.fx.draw(frame, "back")
		}
		surface()
		const next: Live[] = []
		for (const s of scenes) {
			if (s.dead) continue
			if (!s.still) {
				s.fx.update(dt)
				if (s.fx.done()) continue
			}
			next.push(s)
		}
		scenes = next
		if (scenes.length) {
			clearFrame(picture)
			for (const s of scenes) s.fx.draw(picture)
			blit()
		}
		measure()
		if (roomFx) roomFx.fx.draw(frame, "front")
		if (beamFx) {
			beamFx.fx.update(dt)
			beamFx.fx.draw(frame)
		}
		if (projectorFx) {
			projectorFx.fx.update(dt)
			projectorFx.fx.draw(frame)
		}
		composite(frame, image.data, null)
		ctx.putImageData(image, 0, 0)
	}

	function loop(now: number) {
		raf = 0
		if (destroyed) return
		const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
		last = now
		render(dt)
		raf = requestAnimationFrame(loop)
	}

	/** A scene, centered on the screen. */
	const scene = (mod: FxModule, opts: Record<string, unknown>) =>
		live(mod, {
			w: SCREEN.w,
			h: SCREEN.h,
			...opts,
			x: (L?.screen.w ?? SCREEN.w) / 2,
			y: (L?.screen.h ?? SCREEN.h) / 2,
		})

	const stage: CinemaStage = {
		blank: 0,
		onLight: null,
		layout(l) {
			L = l
			if (frame.w !== l.W || frame.h !== l.H) {
				canvas.width = l.W
				canvas.height = l.H
				frame = createFrame(l.W, l.H)
				image = ctx?.createImageData(l.W, l.H) ?? null
			}
			if (picture.w !== l.screen.w || picture.h !== l.screen.h)
				picture = createFrame(l.screen.w, l.screen.h)
			canvas.style.width = `${l.W * l.S}px`
			canvas.style.height = `${l.H * l.S}px`
			canvas.style.transform = `translate3d(${l.gx}px, ${l.gy}px, 0)`
			place()
		},
		room(mod, opts = {}) {
			roomFx = live(mod, opts)
			place()
			return handle(roomFx)
		},
		beam(mod, opts = {}) {
			beamFx = live(mod, opts)
			place()
			return handle(beamFx)
		},
		projector(mod, opts = {}) {
			projectorFx = live(mod, opts)
			place()
			return handle(projectorFx)
		},
		play(mod, opts = {}) {
			scenes.push(scene(mod, opts))
		},
		still(mod, t, opts = {}) {
			const s = scene(mod, opts)
			s.still = true
			s.fx.update(t)
			scenes.push(s)
		},
		cut() {
			for (const s of scenes) s.dead = true
		},
		run() {
			if (raf || destroyed) return
			last = performance.now()
			raf = requestAnimationFrame(loop)
		},
		pause() {
			if (raf) cancelAnimationFrame(raf)
			raf = 0
		},
		render() {
			render(0)
		},
		destroy() {
			destroyed = true
			if (raf) cancelAnimationFrame(raf)
			raf = 0
			scenes = []
			roomFx = beamFx = projectorFx = null
			stage.onLight = null
		},
	}
	return stage
}

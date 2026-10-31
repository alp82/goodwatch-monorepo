// The pixel effects layer over the explorer map, built on pixelfx (MIT, see pixelfx/LICENSE.md). Effects are accents:
// - one ambient loop, on the hovered island or else the island zoomed into;
// - small one-shot bursts for hover, pick, let go, combine, open, and landing after a long flight;
// - a title's pun over its poster when it opens;
// - the combination's own layers: a stream from each picked island to the middle while it rises, a warm-up there, a
//   reveal when its titles arrive, and a calm loop while it stays up, stronger the more islands feed it.
// Pixels are FX_PX CSS px at a region and twice that among the posters; big islands, posters and combinations draw
// with chunkier pixels rather than more of them. With reduced motion there are no loops and
// every burst is a short glint.
// The map loads this module once it's up (its own chunk); ExplorerMap only knows the types in types.ts.

import {
	type FxFrame,
	type FxInstance,
	clearFrame,
	composite,
	createFrame,
	createFx,
} from "./pixelfx/core/index.js"
import { EFFECTS } from "./pixelfx/registry.js"
import { type Ambient, ambientFor } from "./ambient.ts"
import { type PunStep, matchPun } from "./puns.ts"
import type {
	EffectCombination,
	EffectIsland,
	EffectKind,
	EffectTitle,
	MapEffects,
	Rect,
} from "./types.ts"

/** CSS pixels per effect pixel at zoom step 1: the effects read as pixel art at about a third of the map's resolution. */
export const FX_PX = 3

/** Every effect an interaction takes turns with, so repeated picks don't look identical. */
export const BURSTS: Record<EffectKind, string[]> = {
	hover: ["cinema/glint"],
	pick: ["cinema/popcorn", "cinema/popcorn-2"],
	unpick: ["cinema/dust", "cinema/dust-2"],
	combine: ["cinema/filmstrip", "cinema/filmstrip-2"],
	open: ["cinema/clapper"],
	land: ["cinema/projector"],
}

/** How big the bursts play: accents, not events. */
const BURST_SCALE = 0.7
const MAX_LIVE = 24
/** Islands smaller than this on screen (radius, CSS px) get no ambient effect. */
const AMBIENT_MIN_R = 42
/** With no island hovered, one this big on screen (CSS px radius) counts as the one zoomed into. */
const ZOOMED_R = 150
/** The largest hub radius (effect pixels) the combination effects draw at. */
const HUB_R_MAX = 4000
/** The biggest pixel step the zoom and a pun's poster take: FX_PX x 2 CSS px. */
const MAX_STEP = 2
/** The biggest pixel step a big island or combination takes (2 on phones, where 3 would cover too much). */
const MAX_SIZE_STEP = 3
/** Island radius (effect px) an ambient is drawn at, at most, before it steps up to bigger pixels. */
const AMB_R_STEP = 50
/** Poster width (effect px) a pun is drawn at, at most, before it steps up to bigger pixels. */
const PUN_W_STEP = 55
/** Hub radius (effect px) the combination is drawn at, at most, before it steps up to bigger pixels. */
const HUB_R_STEP = 42

/** A five-step ramp, dark to bright, around one color: for hover glints and island twinkles. */
export function rampOf(hex: string): string[] {
	const n = Number.parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16)
	const r = (n >> 16) & 255
	const g = (n >> 8) & 255
	const b = n & 255
	const at = (k: number) => {
		const f = (v: number) =>
			Math.round(k < 0.5 ? v * (k * 2) : v + (255 - v) * ((k - 0.5) * 2))
				.toString(16)
				.padStart(2, "0")
		return `#${f(r)}${f(g)}${f(b)}`
	}
	return [at(0.18), at(0.38), at(0.55), at(0.75), at(0.95)]
}

/**
 * How strong the combination's effects are, by how many islands feed it: two start faint, each one more adds a step,
 * five is the full premiere.
 */
export const comboStrength = (n: number) => Math.max(0.4, Math.min(1, n / 5))

/**
 * The island that plays its ambient loop: the hovered one while it's on screen, else the biggest on screen once it
 * fills a good part of the view (the one zoomed into). Null when neither.
 */
export function ambientIsland<T extends { id: string; r: number }>(
	islands: readonly T[],
	focus: string | null,
): T | null {
	const hovered = focus ? islands.find((i) => i.id === focus) : undefined
	if (hovered) return hovered
	let top: T | null = null
	for (const i of islands)
		if (i.r >= AMBIENT_MIN_R && (!top || i.r > top.r)) top = i
	return top && top.r >= ZOOMED_R ? top : null
}

/** The pixel step (1 or 2) for the camera's zoom over the region scale: bigger pixels among the posters. */
export const zoomStepOf = (z: number) => (z < 1.8 ? 1 : MAX_STEP)

/**
 * The pixel step (1 to `cap`) for something `size` CSS px big that reads best at no more than `per` effect px: bigger
 * things get chunkier pixels instead of more of them, so they stay crisp pixel art and cheap to draw. `cur` keeps the
 * current step until the size has clearly moved past it (no flapping at a boundary).
 */
function stepFor(size: number, per: number, cap: number, cur = 0): number {
	const f = size / (FX_PX * per)
	if (cur && Math.abs(f - cur) < 0.75) return Math.min(cur, cap)
	return Math.max(1, Math.min(cap, Math.round(f)))
}

const noop: MapEffects = {
	resize() {},
	ambient() {},
	burst() {},
	pun: () => false,
	setZoom() {},
	combination() {},
	setFocus() {},
	raise() {},
	destroy() {},
}

interface Live {
	fx: FxInstance
	/** Seconds to wait before it starts. */
	wait: number
	/** Pixel step: which layer it draws on. */
	k: number
}

interface AmbientLive {
	fx: FxInstance
	key: string
	k: number
}

/** One canvas per pixel step, created when first needed. */
interface Layer {
	k: number
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	frame: FxFrame
	image: ImageData
	/** Drawn into this frame. */
	used: boolean
	/** Shows something from an earlier frame. */
	dirty: boolean
}

/** The live combination's effects. */
interface Combo {
	k: number
	streams: Map<string, FxInstance>
	warm: FxInstance | null
	calm: FxInstance | null
	ready: boolean
	colors: string[]
	/** The reveal, kept so it follows the hub while the camera moves. */
	reveal: FxInstance | null
}

/** Over the posters (no z-index of their own), under the captions layer (20) and every control. */
const Z_MAP = 15
/** Over the big screen (45), under the toast. */
const Z_SCREEN = 46

/** Creates the effects layer: pixelated canvases appended to `host`, above the posters, that never take the pointer. */
export function createMapEffects(
	host: HTMLElement,
	opts: { reducedMotion: boolean },
): MapEffects {
	if (typeof document === "undefined") return noop
	const probe = document.createElement("canvas").getContext("2d")
	if (!probe) return noop

	const reduce = opts.reducedMotion
	let focusId: string | null = null
	/** How many islands fed the last combination (for the combine burst's size). */
	let lastPicked = 2
	/** One-shots that keep to the combination's middle as it moves on screen. */
	let hubFollowers: Live[] = []
	let raised = false
	const layers: (Layer | undefined)[] = []
	let cssW = 1
	let cssH = 1
	let live: Live[] = []
	const ambients = new Map<string, AmbientLive>()
	/** Effects that are fading out after they were replaced (ambients that changed, combination parts let go). */
	let fading: Live[] = []
	/** The combination's drawn effects (none with reduced motion). */
	let combo: Combo | null = null
	/** With reduced motion: whether the ready glint has played for the combination that's up. Bookkeeping only, so the
	 * loop stops once the glint ends. */
	let glinted = false
	let zoomStep = 1
	let tick = 0
	let raf = 0
	let last = 0
	let destroyed = false
	const turns: Partial<Record<EffectKind, number>> = {}

	function layer(k: number): Layer {
		const had = layers[k]
		if (had) return had
		const canvas = document.createElement("canvas")
		canvas.className = "ex-fx"
		canvas.setAttribute("aria-hidden", "true")
		canvas.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;z-index:${raised ? Z_SCREEN : Z_MAP};pointer-events:none;image-rendering:pixelated;display:block`
		host.appendChild(canvas)
		const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
		const L: Layer = {
			k,
			canvas,
			ctx,
			frame: createFrame(1, 1),
			image: ctx.createImageData(1, 1),
			used: false,
			dirty: false,
		}
		layers[k] = L
		sizeLayer(L)
		return L
	}

	function sizeLayer(L: Layer) {
		const px = FX_PX * L.k
		const W = Math.max(1, Math.ceil(cssW / px))
		const H = Math.max(1, Math.ceil(cssH / px))
		if (W === L.frame.w && H === L.frame.h) return
		L.canvas.width = W
		L.canvas.height = H
		// The canvas is stretched to the stage, so a partial last pixel would squash every pixel a little.
		L.canvas.style.width = `${W * px}px`
		L.canvas.style.height = `${H * px}px`
		L.frame = createFrame(W, H)
		L.image = L.ctx.createImageData(W, H)
		L.dirty = true
	}

	function resize(w: number, h: number) {
		cssW = w
		cssH = h
		for (const L of layers) if (L) sizeLayer(L)
		wake()
	}

	/** Phones get at most 2x pixels for big islands and combinations. */
	const sizeCap = () => (cssW < 700 ? 2 : MAX_SIZE_STEP)

	function wake() {
		if (raf || destroyed) return
		last = performance.now()
		raf = requestAnimationFrame(loop)
	}

	function frameOf(k: number): FxFrame {
		const L = layer(k)
		if (!L.used) {
			clearFrame(L.frame)
			L.used = true
		}
		return L.frame
	}

	function loop(now: number) {
		raf = 0
		const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
		last = now
		tick++
		for (const L of layers) if (L) L.used = false
		// One-shots: wait, play, drop when done.
		const next: Live[] = []
		for (const l of live) {
			if (l.wait > 0) {
				l.wait -= dt
				next.push(l)
				continue
			}
			l.fx.update(dt)
			if (l.fx.done()) continue
			l.fx.draw(frameOf(l.k))
			next.push(l)
		}
		live = next
		fading = fading.filter((f) => {
			f.fx.update(dt)
			if (f.fx.done()) return false
			f.fx.draw(frameOf(f.k))
			return true
		})
		for (const [id, a] of ambients) {
			a.fx.update(dt * Number(a.fx.options.speed ?? 1))
			if (a.fx.done()) {
				ambients.delete(id)
				continue
			}
			a.fx.draw(frameOf(a.k))
		}
		if (combo) {
			const f = frameOf(combo.k)
			for (const s of combo.streams.values()) {
				s.update(dt)
				s.draw(f)
			}
			combo.warm?.update(dt)
			combo.warm?.draw(f)
			combo.calm?.update(dt)
			combo.calm?.draw(f)
			if (combo.reveal) {
				combo.reveal.update(dt)
				if (combo.reveal.done()) combo.reveal = null
				else combo.reveal.draw(f)
			}
		}
		let any = false
		for (const L of layers) {
			if (!L) continue
			if (L.used) {
				composite(L.frame, L.image.data, null)
				L.ctx.putImageData(L.image, 0, 0)
				L.dirty = true
				any = true
			} else if (L.dirty) {
				L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height)
				L.dirty = false
			}
		}
		// Keep going while anything is alive; one more frame after the last one clears the canvases.
		if (any || live.length || fading.length || ambients.size || drawing(combo))
			raf = requestAnimationFrame(loop)
	}

	function make(
		id: string,
		k: number,
		x: number,
		y: number,
		o: Record<string, unknown> = {},
	) {
		const mod = EFFECTS[id]
		if (!mod) return null
		const px = FX_PX * k
		return createFx(mod, { ...o, x: x / px, y: y / px })
	}

	function play(
		id: string,
		x: number,
		y: number,
		o: Record<string, unknown> = {},
		wait = 0,
		k = zoomStep,
	) {
		if (destroyed) return false
		const fx = make(id, k, x, y, o)
		if (!fx) return false
		if (live.length >= MAX_LIVE) live.shift()
		live.push({ fx, wait, k })
		wake()
		return true
	}

	function retire(fx: FxInstance, k: number) {
		fx.stop()
		fading.push({ fx, wait: 0, k })
	}

	function ambient(islands: EffectIsland[]) {
		if (destroyed) return
		const isl = reduce ? null : ambientIsland(islands, focusId)
		if (isl) {
			const pick: Ambient = ambientFor(isl)
			const key = `${pick.id}|${JSON.stringify(pick.opts ?? {})}`
			let a = ambients.get(isl.id)
			// Bigger islands on screen draw with chunkier pixels, so the ambient grows with the island.
			const k = stepFor(isl.r, AMB_R_STEP, sizeCap(), a?.k)
			if (a && (a.key !== key || a.k !== k)) {
				ambients.delete(isl.id)
				retire(a.fx, a.k)
				a = undefined
			}
			const r = Math.max(15, Math.min(90, isl.r / (FX_PX * k)))
			if (!a) {
				const mod = EFFECTS[pick.id] ?? EFFECTS["cinema/amb-twinkle"]
				if (mod) {
					const fx = createFx(mod, {
						...(pick.opts ?? {}),
						seed: seedOf(isl.id),
						r,
						density: 1,
					})
					// Islands don't pulse in step.
					fx.update((seedOf(isl.id) % 997) / 97)
					a = { fx, key, k }
					ambients.set(isl.id, a)
				}
			}
			if (a) {
				const px = FX_PX * a.k
				a.fx.options.x = isl.x / px
				a.fx.options.y = isl.y / px
				a.fx.options.r = r
			}
		}
		for (const [id, a] of ambients)
			if (id !== isl?.id) {
				ambients.delete(id)
				retire(a.fx, a.k)
			}
		if (ambients.size || fading.length) wake()
	}

	function burst(
		kind: EffectKind,
		x: number,
		y: number,
		o?: { color?: string },
	) {
		if (reduce) {
			play("cinema/glint", x, y, {
				s: 0.8,
				...(o?.color ? { palette: rampOf(o.color) } : {}),
			})
			return
		}
		// The combine burst grows with the number of islands, like the rest of the combination.
		const s =
			BURST_SCALE *
			(kind === "combine" ? 0.55 + 0.45 * comboStrength(lastPicked) : 1)
		// Take turns between the kind's effects, each with its own seed.
		const turn = (turns[kind] ?? -1) + 1
		turns[kind] = turn
		const list = BURSTS[kind]
		const id = list[turn % list.length]
		const extra: Record<string, unknown> = { s, seed: 1 + (turn % 7) * 13 }
		if (o?.color && kind === "hover") extra.palette = rampOf(o.color)
		play(id, x, y, extra)
		// The combine burst stays on the combination while the camera glides to frame it.
		if (kind === "combine") {
			const f = live[live.length - 1]
			if (f) hubFollowers.push(f)
		}
	}

	function pun(title: EffectTitle, rect: Rect) {
		if (destroyed) return false
		const hit = matchPun(title.name)
		if (!hit) return false
		const cx = rect.x + rect.w / 2
		const cy = rect.y + rect.h / 2
		if (reduce) return play("cinema/glint", cx, cy, { s: 1 })
		// A big poster (zoomed in) gets chunkier pixels, not a bigger effect canvas.
		const k = stepFor(rect.w, PUN_W_STEP, MAX_STEP)
		const px = FX_PX * k
		const w = Math.max(24, Math.min(140, (rect.w / px) * 0.85))
		const h = Math.max(36, Math.min(210, (rect.h / px) * 0.85))
		let played = false
		for (const step of hit.steps as PunStep[])
			played =
				play(
					step.fx,
					cx,
					cy,
					{ ...(step.opts ?? {}), w, h },
					step.delay ?? 0,
					k,
				) || played
		return played
	}

	function endCombo() {
		if (!combo) return
		for (const s of combo.streams.values()) retire(s, combo.k)
		if (combo.warm) retire(combo.warm, combo.k)
		if (combo.calm) retire(combo.calm, combo.k)
		if (combo.reveal) retire(combo.reveal, combo.k)
		combo = null
	}

	const freshCombo = (k: number, colors: string[], ready = false): Combo => ({
		k,
		streams: new Map(),
		warm: null,
		calm: null,
		ready,
		colors,
		reveal: null,
	})

	function combination(state: EffectCombination | null) {
		if (destroyed) return
		if (!state) {
			endCombo()
			glinted = false
			return
		}
		const colors = state.picked.map((p) => p.color)
		if (reduce) {
			// No streams or loops: one glint when it's ready.
			if (state.ready && !glinted && state.rise >= 0.85) {
				play("cinema/glint", state.hub.x, state.hub.y, { s: 1.4 })
				glinted = true
			}
			if (!state.ready) glinted = false
			return
		}
		const k = stepFor(state.hub.r, HUB_R_STEP, sizeCap(), combo?.k)
		if (combo && combo.k !== k) {
			// Zoomed far enough to change pixel size: hand over to fresh effects on the new layer.
			const was = combo.ready
			endCombo()
			combo = freshCombo(k, colors, was)
		}
		if (!combo) combo = freshCombo(k, colors)
		const c = combo
		c.colors = colors
		const st = comboStrength(state.picked.length)
		lastPicked = state.picked.length
		// Faint and soft with two islands, the full premiere with five.
		const look = { alpha: 0.35 + 0.65 * st, light: st }
		const px = FX_PX * k
		const hx = state.hub.x / px
		const hy = state.hub.y / px
		// The ring follows the island's own border; the beams and rings draw only what's in view, so any size is cheap.
		const hr = Math.min(HUB_R_MAX, Math.max(10, state.hub.r / px))

		// The reveal waits until it has nearly risen, so cached titles still get their streams and warm-up; once up it
		// stays up while it sinks.
		const ready = state.ready && (c.ready || state.rise >= 0.85)
		// The moment its titles arrive: the reveal.
		if (ready && !c.ready) {
			if (c.reveal) retire(c.reveal, k)
			c.reveal = make("cinema/comb-reveal", k, state.hub.x, state.hub.y, {
				r: hr * (0.6 + 0.4 * st),
				colors,
				seed: tick % 97,
				...look,
			})
			wake()
		}
		hubFollowers = hubFollowers.filter((f) => live.includes(f))
		for (const f of hubFollowers) {
			f.fx.options.x = state.hub.x / (FX_PX * f.k)
			f.fx.options.y = state.hub.y / (FX_PX * f.k)
		}
		// The reveal stays on the hub while the camera glides (picking another island moves the view).
		if (c.reveal) {
			c.reveal.options.x = hx
			c.reveal.options.y = hy
		}
		// Picks changed under a ready combination: it rises again.
		c.ready = ready

		// Streams: one per picked island while it rises; let go when it's ready or the island is let go.
		const keep = new Set<string>()
		if (!ready)
			for (const p of state.picked) {
				keep.add(p.id)
				let s = c.streams.get(p.id)
				if (!s) {
					s =
						make("cinema/comb-stream", k, p.x, p.y, {
							seed: seedOf(p.id),
							palette: rampOf(p.color),
						}) ?? undefined
					if (!s) continue
					c.streams.set(p.id, s)
				}
				const o = s.options
				o.x = p.x / px
				o.y = p.y / px
				o.dx = hx - p.x / px
				o.dy = hy - p.y / px
				o.r0 = Math.max(6, p.r / px)
				o.r1 = hr
				o.rise = Math.min(1, state.rise * 1.25)
				o.alpha = look.alpha
				o.light = look.light
			}
		for (const [id, s] of c.streams)
			if (!keep.has(id)) {
				c.streams.delete(id)
				retire(s, k)
			}

		// At the hub: warming up while it rises, a calm loop once it's up.
		if (!ready) {
			if (c.calm) {
				retire(c.calm, k)
				c.calm = null
			}
			if (!c.warm)
				c.warm = make("cinema/comb-warmup", k, state.hub.x, state.hub.y, {
					r: hr,
					colors,
				})
			if (c.warm) {
				const o = c.warm.options
				o.x = hx
				o.y = hy
				o.r = hr
				o.charge = state.rise
				o.colors = colors
				o.alpha = look.alpha
				o.light = look.light
			}
		} else {
			if (c.warm) {
				retire(c.warm, k)
				c.warm = null
			}
			if (!c.calm)
				c.calm = make("cinema/comb-calm", k, state.hub.x, state.hub.y, {
					r: hr,
					colors,
				})
			if (c.calm) {
				const o = c.calm.options
				o.x = hx
				o.y = hy
				o.r = hr
				o.colors = colors
				o.alpha = look.alpha
				o.light = look.light
			}
		}
		wake()
	}

	function destroy() {
		destroyed = true
		if (raf) cancelAnimationFrame(raf)
		raf = 0
		live = []
		fading = []
		combo = null
		glinted = false
		ambients.clear()
		for (const L of layers) L?.canvas.remove()
		layers.length = 0
	}

	resize(host.clientWidth || 1, host.clientHeight || 1)
	layer(1)

	return {
		resize,
		ambient,
		burst,
		pun,
		combination,
		setZoom(z: number) {
			zoomStep = zoomStepOf(z)
		},
		setFocus(id: string | null) {
			focusId = id
		},
		raise(on: boolean) {
			raised = on
			for (const L of layers)
				if (L) L.canvas.style.zIndex = String(on ? Z_SCREEN : Z_MAP)
		},
		destroy,
	}
}

/** Whether a combination has anything to draw: the loop keeps running only for that. */
function drawing(
	c: Pick<Combo, "streams" | "warm" | "calm" | "reveal"> | null,
): boolean {
	return !!c && (c.streams.size > 0 || !!c.warm || !!c.calm || !!c.reveal)
}

function seedOf(s: string): number {
	let h = 2166136261
	for (let i = 0; i < s.length; i++)
		h = Math.imul(h ^ s.charCodeAt(i), 16777619)
	return (h >>> 0) % 100000
}

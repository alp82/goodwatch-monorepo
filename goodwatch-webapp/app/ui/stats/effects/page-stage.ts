// The page-wide pixel effects layer for the chapters, built on pixelfx (MIT, see pixelfx/LICENSE.md).
// One fixed canvas the size of the viewport, drawn at `px` CSS px per effect pixel, never takes the pointer. Effects
// are placed in document coordinates, so one that plays while you scroll stays on its element: each frame the canvas
// frame's origin follows the scroll in whole effect pixels and the canvas shifts by the remainder (a transform), so
// effect pixels stay on the page's grid. Rows above `clipTop()` (the sticky chapter bar and the site header) are
// cleared after the effects draw, so nothing shows through the bar.
// The animation frame loop runs only while something is alive and stops after clearing the canvas once.
import {
	type FxFrame,
	type FxInstance,
	type FxModule,
	clearFrame,
	composite,
	createFrame,
	createFx,
} from "./pixelfx/core/index.js"
import { EFFECTS, type FxId } from "./pixelfx/registry.js"

export type { FxId }

export interface PlayOpts {
	/** Seconds before it starts. */
	wait?: number
	/** The spot this effect belongs to; the page counts spots, not effects, against its cap. */
	group?: string
	/** For loops: seconds before it fades out (it fades out by itself after this). Default 4. */
	hold?: number
	/** Seconds after which it is dropped. Defaults to the effect's teaser length when played with `tease`. */
	end?: number
}

export interface PageStage {
	/** Plays `id` at document CSS px (x, y), with the effect's own options. */
	play(
		id: FxId,
		x: number,
		y: number,
		opts?: Record<string, unknown>,
		how?: PlayOpts,
	): void
	/** Spots with an effect still waiting or alive. */
	groups(): Set<string>
	/** Fades out (loops) or drops (one-shots) every effect of a group. */
	stop(group: string): void
	clear(): void
	destroy(): void
	/** Called with the group whenever its last effect ends. */
	onGroupEnd?: (group: string) => void
}

interface Live {
	fx: FxInstance
	wait: number
	group: string
	hold: number
	end: number
}

const MAX_LIVE = 24

export function createPageStage(px: number, clipTop: () => number): PageStage {
	const canvas = document.createElement("canvas")
	canvas.setAttribute("aria-hidden", "true")
	canvas.dataset.fxStage = "page"
	canvas.style.cssText =
		"position:fixed;left:0;top:0;pointer-events:none;image-rendering:pixelated;display:block;z-index:30;will-change:transform"
	document.body.appendChild(canvas)
	const ctx = canvas.getContext("2d")
	let frame: FxFrame = createFrame(1, 1)
	let image: ImageData | null = null
	let live: Live[] = []
	let raf = 0
	let last = 0
	let dirty = false
	let destroyed = false
	let sized = false

	const size = () => {
		// whole effect pixels, one spare row and column for the scroll remainder, never wider than the viewport
		const vw = document.documentElement.clientWidth
		const W = Math.max(1, Math.floor(vw / px))
		const H = Math.max(1, Math.ceil(window.innerHeight / px) + 1)
		if (W === frame.w && H === frame.h) return
		canvas.width = W
		canvas.height = H
		canvas.style.width = `${W * px}px`
		canvas.style.height = `${H * px}px`
		frame = createFrame(W, H)
		image = ctx?.createImageData(W, H) ?? null
	}
	const onResize = () => {
		sized = false
	}
	window.addEventListener("resize", onResize)

	function loop(now: number) {
		raf = 0
		if (!sized) {
			size()
			sized = true
		}
		if (!ctx || !image) return
		const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
		last = now
		// reads first (scroll, the bar's edge), then the one write (the canvas transform)
		const sx = window.scrollX
		const sy = window.scrollY
		const clip = live.length ? clipTop() : 0
		const ox = Math.floor(sx / px)
		const oy = Math.floor(sy / px)
		frame.ox = ox
		frame.oy = oy
		clearFrame(frame)
		let drew = false
		const next: Live[] = []
		const ended = new Set<string>()
		const step = (l: Live) => {
			if (l.wait > 0) {
				l.wait -= dt
				next.push(l)
				return
			}
			l.fx.update(dt)
			if (l.fx.meta.loop && l.fx.t >= l.hold) l.fx.stop()
			if (l.fx.done() || l.fx.t >= l.end) {
				ended.add(l.group)
				return
			}
			next.push(l)
		}
		for (const l of live) step(l)
		for (const l of next) {
			if (l.wait > 0) continue
			l.fx.draw(frame)
			drew = true
		}
		// nothing from the chapters shows through the sticky bar or the header
		const rows = Math.max(
			0,
			Math.min(frame.h, Math.ceil(clip / px + (sy / px - oy))),
		)
		if (drew && rows) {
			frame.color.fill(0, 0, rows * frame.w)
			frame.light.fill(0, 0, rows * frame.w)
		}
		live = next
		if (drew) {
			composite(frame, image.data, null)
			ctx.putImageData(image, 0, 0)
			canvas.style.transform = `translate(${-(sx - ox * px)}px,${-(sy - oy * px)}px)`
			dirty = true
		} else if (dirty) {
			ctx.clearRect(0, 0, canvas.width, canvas.height)
			dirty = false
		}
		for (const g of ended)
			if (!live.some((l) => l.group === g)) api.onGroupEnd?.(g)
		if (live.length || dirty) raf = requestAnimationFrame(loop)
	}

	const api: PageStage = {
		play(id, x, y, opts = {}, how = {}) {
			if (destroyed) return
			const mod = EFFECTS[id] as FxModule & { tease?: { duration: number } }
			if (!mod) return
			const end =
				how.end ??
				(opts.tease && mod.tease
					? mod.tease.duration
					: Number.POSITIVE_INFINITY)
			if (live.length >= MAX_LIVE) live.shift()
			live.push({
				fx: createFx(mod, { ...opts, x: x / px, y: y / px }),
				wait: how.wait ?? 0,
				group: how.group ?? id,
				hold: how.hold ?? 4,
				end,
			})
			if (!raf) {
				last = performance.now()
				raf = requestAnimationFrame(loop)
			}
		},
		groups() {
			return new Set(live.map((l) => l.group))
		},
		stop(group) {
			live = live.filter((l) => {
				if (l.group !== group) return true
				if (l.wait > 0) return false
				if (l.fx.meta.loop) {
					l.fx.stop()
					return true
				}
				return false
			})
		},
		clear() {
			live = []
		},
		destroy() {
			destroyed = true
			if (raf) cancelAnimationFrame(raf)
			raf = 0
			live = []
			window.removeEventListener("resize", onResize)
			canvas.remove()
		},
	}
	return api
}

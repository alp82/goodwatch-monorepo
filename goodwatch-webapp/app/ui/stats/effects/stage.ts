// A pixel effects layer over one element (the hero's roll control, the quiz), built on pixelfx (MIT, see
// pixelfx/LICENSE.md). One transparent canvas, drawn with `px` CSS px per effect pixel and stretched with
// image-rendering: pixelated, sits over the host (plus `pad` above and below for bursts that fly out of it) and never
// takes the pointer. Effects are one-shots played at host-local CSS px; the animation frame loop runs only while one is
// alive and clears the canvas after the last.
import {
	type FxFrame,
	type FxInstance,
	clearFrame,
	composite,
	createFrame,
	createFx,
} from "./pixelfx/core/index.js"
import { EFFECTS, type FxId } from "./pixelfx/registry.js"

export interface HostStage {
	/** Plays `id` at host-local CSS px (x, y) after `wait` seconds. */
	play(
		id: FxId,
		x: number,
		y: number,
		opts?: Record<string, unknown>,
		wait?: number,
	): void
	/** Drops every effect that hasn't finished. */
	clear(): void
	destroy(): void
}

export function createHostStage(
	host: HTMLElement,
	px: number,
	{ pad, maxLive }: { pad: number; maxLive: number },
): HostStage {
	const canvas = document.createElement("canvas")
	canvas.setAttribute("aria-hidden", "true")
	canvas.style.cssText = `position:absolute;left:0;top:${-pad}px;pointer-events:none;image-rendering:pixelated;display:block;z-index:5`
	host.appendChild(canvas)
	const ctx = canvas.getContext("2d")
	let frame: FxFrame = createFrame(1, 1)
	let image: ImageData | null = null
	let live: { fx: FxInstance; wait: number }[] = []
	let raf = 0
	let last = 0
	let dirty = false
	let destroyed = false

	const size = () => {
		const W = Math.max(1, Math.floor(host.clientWidth / px))
		const H = Math.max(1, Math.ceil((host.clientHeight + pad * 2) / px))
		if (W === frame.w && H === frame.h) return
		canvas.width = W
		canvas.height = H
		// Whole effect pixels only, so none is squashed, and never wider than the host (no sideways page scroll).
		canvas.style.width = `${W * px}px`
		canvas.style.height = `${H * px}px`
		frame = createFrame(W, H)
		image = ctx?.createImageData(W, H) ?? null
	}
	size()
	const ro = new ResizeObserver(size)
	ro.observe(host)

	function loop(now: number) {
		raf = 0
		if (!ctx || !image) return
		const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
		last = now
		clearFrame(frame)
		let drew = false
		const next: typeof live = []
		for (const l of live) {
			if (l.wait > 0) {
				l.wait -= dt
				next.push(l)
				continue
			}
			l.fx.update(dt)
			if (l.fx.done()) continue
			l.fx.draw(frame)
			drew = true
			next.push(l)
		}
		live = next
		if (drew) {
			composite(frame, image.data, null)
			ctx.putImageData(image, 0, 0)
			dirty = true
		} else if (dirty) {
			ctx.clearRect(0, 0, canvas.width, canvas.height)
			dirty = false
		}
		if (live.length || dirty) raf = requestAnimationFrame(loop)
	}

	return {
		play(id, x, y, opts = {}, wait = 0) {
			if (destroyed) return
			const mod = EFFECTS[id]
			if (!mod) return
			if (live.length >= maxLive) live.shift()
			live.push({
				fx: createFx(mod, { ...opts, x: x / px, y: (y + pad) / px }),
				wait,
			})
			if (!raf) {
				last = performance.now()
				raf = requestAnimationFrame(loop)
			}
		},
		clear() {
			live = []
		},
		destroy() {
			destroyed = true
			if (raf) cancelAnimationFrame(raf)
			raf = 0
			live = []
			ro.disconnect()
			canvas.remove()
		},
	}
}

import { useEffect, useRef, useState } from "react"
import { rgbCss } from "./color"
import type { MapEngine } from "./engine"
import type { World } from "./world"

/**
 * The whole archipelago small, as it's laid out now (islands where they are and as big as they are, the ones out of
 * focus grey), with the part on screen outlined. It shows once you're zoomed in; a tap flies there.
 */
export function Minimap({
	engine,
	world,
	phone,
	onGo,
}: {
	engine: MapEngine | null
	world: World
	phone: boolean
	/** Flies to this world point. */
	onGo: (x: number, y: number) => void
}) {
	const canvas = useRef<HTMLCanvasElement>(null)
	const [on, setOn] = useState(false)
	const s0 = Math.min(
		(phone ? 96 : 176) / world.w,
		(phone ? 64 : 110) / world.h,
	)
	const size = { w: Math.round(world.w * s0), h: Math.round(world.h * s0) }
	/** World to minimap: the layout can spill a little over the map's edges, and the minimap shows all of it. */
	const frameOf = () => {
		const b = engine?.layoutBox() ?? { x0: 0, y0: 0, x1: world.w, y1: world.h }
		const s = Math.min(size.w / (b.x1 - b.x0), size.h / (b.y1 - b.y0))
		return {
			s,
			ox: (size.w - (b.x1 - b.x0) * s) / 2 - b.x0 * s,
			oy: (size.h - (b.y1 - b.y0) * s) / 2 - b.y0 * s,
		}
	}
	const frameRef = useRef(frameOf)
	frameRef.current = frameOf
	useEffect(() => {
		const c = canvas.current
		if (!c || !engine) return
		const dpr = Math.min(2, window.devicePixelRatio || 1)
		c.width = size.w * dpr
		c.height = size.h * dpr
		const g = c.getContext("2d") as CanvasRenderingContext2D
		let raf = 0
		const draw = () => {
			raf = 0
			const v = engine.view()
			const shown = v.cam.s > v.fit * 1.35
			setOn(shown)
			if (!shown) return
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.clearRect(0, 0, size.w, size.h)
			const { s, ox, oy } = frameRef.current()
			for (const { island, x: wx, y: wy, r: wr } of engine.circles()) {
				const r = wr * s
				if (r < 0.3) continue
				const x = ox + wx * s
				const y = oy + wy * s
				const hot = v.focus === island || island.look.vivid > 0.5
				const m = island.look.mute
				const t = island.tint
				const grey = (t[0] + t[1] + t[2]) / 3
				const c = t.map((ch) => ch + (grey - ch) * 0.8 * m) as typeof t
				const a = 1 - 0.45 * m
				const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.6)
				gr.addColorStop(0, rgbCss(c, (hot ? 0.95 : 0.7) * a))
				gr.addColorStop(0.6, rgbCss(c, (hot ? 0.5 : 0.28) * a))
				gr.addColorStop(1, rgbCss(c, 0))
				g.fillStyle = gr
				g.beginPath()
				g.arc(x, y, r * 1.6, 0, Math.PI * 2)
				g.fill()
			}
			const x = ox + (v.cam.x - v.cam.w / 2 / v.cam.s) * s
			const y = oy + (v.cam.y - v.cam.h / 2 / v.cam.s) * s
			const w = (v.cam.w / v.cam.s) * s
			const h = (v.cam.h / v.cam.s) * s
			g.strokeStyle = "rgba(255,255,255,.9)"
			g.lineWidth = 1.25
			g.beginPath()
			g.roundRect(x, y, Math.max(3, w), Math.max(3, h), 2)
			g.stroke()
		}
		const kick = () => {
			if (!raf) raf = requestAnimationFrame(draw)
		}
		kick()
		const off = engine.subscribe(kick)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [engine, size.w, size.h])
	return (
		<button
			type="button"
			className={`ex-mini ${on ? "" : "ex-mini-off"}`}
			aria-hidden={!on}
			tabIndex={on ? 0 : -1}
			aria-label="Minimap: go to a part of the map"
			onClick={(e) => {
				const r = e.currentTarget.getBoundingClientRect()
				const { s, ox, oy } = frameOf()
				// Keyboard activation clicks the middle.
				const px = e.detail
					? e.clientX - r.left - (r.width - size.w) / 2
					: size.w / 2
				const py = e.detail
					? e.clientY - r.top - (r.height - size.h) / 2
					: size.h / 2
				onGo((px - ox) / s, (py - oy) / s)
			}}
		>
			<canvas
				ref={canvas}
				style={{ width: size.w, height: size.h, display: "block" }}
			/>
		</button>
	)
}

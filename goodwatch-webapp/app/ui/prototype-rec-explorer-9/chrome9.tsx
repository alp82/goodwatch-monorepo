// PROTOTYPE - throwaway. Controls around the round-9 map (#180). Round 8's top bar, combine bar, history and rail are
// reused as they are (chrome8.tsx, chrome6.tsx); the minimap is redrawn here so it follows the focus layout (islands
// where they are now and as big as they are, the ones out of focus grey).
import { useEffect, useRef, useState } from "react"
import type { World } from "~/ui/prototype-rec-explorer-4/geo"
import { rgbCss } from "~/ui/prototype-rec-explorer-6/surface6"
import type { Engine } from "./map9"

/** The whole archipelago small, as it's laid out now, with the part on screen outlined. Tap to go there. */
export function Minimap9({
	eng,
	world,
	onGo,
}: { eng: Engine | null; world: World; onGo: (x: number, y: number) => void }) {
	const cv = useRef<HTMLCanvasElement>(null)
	const [size, setSize] = useState({ w: 170, h: 100 })
	// Zoomed out the whole map is on screen, so the minimap only shows once you're in.
	const [on, setOn] = useState(false)
	useEffect(() => {
		const small = window.innerWidth < 640
		const s = Math.min(
			(small ? 96 : 176) / world.w,
			(small ? 64 : 110) / world.h,
		)
		setSize({ w: Math.round(world.w * s), h: Math.round(world.h * s) })
	}, [world])
	useEffect(() => {
		const c = cv.current
		if (!c || !eng) return
		const dpr = Math.min(2, window.devicePixelRatio || 1)
		c.width = size.w * dpr
		c.height = size.h * dpr
		const g = c.getContext("2d") as CanvasRenderingContext2D
		let raf = 0
		const draw = () => {
			raf = 0
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.clearRect(0, 0, size.w, size.h)
			const v = eng.view()
			setOn(v.cam.s > v.fit * 1.35)
			// The layout can spill a little over the map's edges; the minimap shows all of it.
			const b = eng.layoutBox() ?? { x0: 0, y0: 0, x1: world.w, y1: world.h }
			const s = Math.min(size.w / (b.x1 - b.x0), size.h / (b.y1 - b.y0))
			const ox = (size.w - (b.x1 - b.x0) * s) / 2 - b.x0 * s
			const oy = (size.h - (b.y1 - b.y0) * s) / 2 - b.y0 * s
			for (const i of eng.islands()) {
				const r = i.wr * s
				if (r < 0.3) continue
				const x = ox + i.wx * s
				const y = oy + i.wy * s
				const hot = v.focus === i || i.vivid > 0.5
				const c = i.tint.map(
					(t) =>
						t + ((i.tint[0] + i.tint[1] + i.tint[2]) / 3 - t) * 0.8 * i.mute,
				) as [number, number, number]
				const a = 1 - 0.45 * i.mute
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
			if (w < size.w * 0.97 || h < size.h * 0.97) {
				g.strokeStyle = "rgba(255,255,255,.9)"
				g.lineWidth = 1.25
				g.beginPath()
				g.roundRect(x, y, Math.max(3, w), Math.max(3, h), 2)
				g.stroke()
			}
		}
		const kick = () => {
			if (!raf) raf = requestAnimationFrame(draw)
		}
		kick()
		const off = eng.subscribe(kick)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [world, size, eng])
	return (
		<button
			type="button"
			className={`rx6-mini ${on ? "" : "rx6-mini-off"}`}
			aria-hidden={!on}
			tabIndex={on ? 0 : -1}
			aria-label="Minimap: tap to go there"
			onClick={(e) => {
				if (!eng) return
				const r = e.currentTarget.getBoundingClientRect()
				const b = eng.layoutBox() ?? { x0: 0, y0: 0, x1: world.w, y1: world.h }
				const s = Math.min(size.w / (b.x1 - b.x0), size.h / (b.y1 - b.y0))
				const ox = (size.w - (b.x1 - b.x0) * s) / 2 - b.x0 * s
				const oy = (size.h - (b.y1 - b.y0) * s) / 2 - b.y0 * s
				const px = ((e.clientX - r.left - 6) / (r.width - 12)) * size.w
				const py = ((e.clientY - r.top - 6) / (r.height - 12)) * size.h
				onGo((px - ox) / s, (py - oy) / s)
			}}
		>
			<canvas
				ref={cv}
				style={{ width: size.w, height: size.h, display: "block" }}
			/>
		</button>
	)
}

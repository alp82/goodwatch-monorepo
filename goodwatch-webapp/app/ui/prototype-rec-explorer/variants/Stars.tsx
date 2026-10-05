// PROTOTYPE - throwaway. Night sky (bolder): every title is a star, brighter the closer it is to your taste.
// The titles you loved are joined into constellations, the regions are named across the sky, and zooming in
// turns stars into posters. Opens on the whole sky, then drifts down to you. Filtered titles fade out.
import { useEffect, useMemo, useRef, useState } from "react"
import { MatchText } from "~/ui/prototype-rec-taste/kit"
import { Actions, Filters, WhoNote, ZoomControls } from "../kit"
import type { Pt } from "../math"
import { img, islandsLayout } from "../model"
import { usePaint } from "../paint"
import { type Label, Space, type SpaceHandle } from "../Space"
import type { Explorer } from "../useExplorer"

export default function Stars({ ex }: { ex: Explorer }) {
	const space = useRef<SpaceHandle>(null)
	const layout = useMemo(() => islandsLayout(ex.items, ex.engine), [ex.items, ex.engine])
	const paint = usePaint(ex, { colors: "stars", featured: 40, featuredSize: 1.6, glowTop: 40 })
	const [peek, setPeek] = useState<number | null>(null)
	const you = ex.youIn(layout.pos)

	// Constellations: each loved title joined to its nearest loved neighbour in the same region.
	const lines = useMemo(() => {
		const out: [Pt, Pt][] = []
		const loved = ex.loved
		for (const a of loved) {
			let best: number | null = null
			let bd = Number.POSITIVE_INFINITY
			for (const b of loved) {
				if (a === b || layout.cluster[a] !== layout.cluster[b]) continue
				const d = (layout.pos[a].x - layout.pos[b].x) ** 2 + (layout.pos[a].y - layout.pos[b].y) ** 2
				if (d < bd) {
					bd = d
					best = b
				}
			}
			if (best != null) out.push([layout.pos[a], layout.pos[best]])
		}
		return out
	}, [ex.loved, layout])
	const starPaint = useMemo(() => {
		const size = Float32Array.from(paint.size)
		const glow = Uint8Array.from(paint.glow)
		const alpha = Float32Array.from(paint.alpha)
		for (const i of ex.loved) {
			glow[i] = 1
			size[i] = Math.max(size[i], 1.8)
			alpha[i] = 1
		}
		return { ...paint, size, glow, alpha, ring: paint.ring.map(() => null) }
	}, [paint, ex.loved])
	const labels: Label[] = useMemo(() => {
		const max = Math.max(...layout.regions.map((r) => r.size))
		return layout.regions.map((r) => ({ x: r.x, y: r.y + 4, text: r.name, weight: 0.35 + (0.65 * r.size) / max }))
	}, [layout])

	useEffect(() => {
		const t = setTimeout(() => space.current?.flyTo(you.x, you.y, 2.4, 2600), 1200)
		return () => clearTimeout(t)
	}, [])

	const it = peek != null ? ex.items[peek] : null
	return (
		<div className="rx-stage text-white" style={{ background: "radial-gradient(ellipse at 50% 35%, #111a33 0%, #070a16 55%, #020308 100%)" }}>
			<Space
				ref={space}
				className="absolute inset-0"
				style="stars"
				items={ex.items}
				pos={layout.pos}
				{...starPaint}
				lines={lines}
				labels={labels}
				markers={[{ id: "you", ...you, label: "You are here", color: "#fde68a", kind: "pin" }]}
				selected={peek}
				onTap={(i) => setPeek(i)}
				initial="fit"
				minScale={0.35}
				ariaLabel="A sky of about 2,500 titles; brighter stars match your taste"
			/>
			<div className="pointer-events-none absolute left-0 top-0 px-5 pt-5 md:px-10 md:pt-8">
				<h1 className="text-4xl font-light tracking-tight text-amber-50 md:text-6xl">Your sky</h1>
				<p className="mt-2 max-w-sm text-sm text-slate-300">Brighter stars suit you better. Lines join the titles you loved. Zoom in to see what they are.</p>
				<div className="pointer-events-auto mt-4">
					<Filters ex={ex} showMode={false} />
					<WhoNote ex={ex} className="mt-2" />
				</div>
			</div>
			{it && peek != null && (
				<div className="absolute inset-x-3 bottom-16 z-20 mx-auto max-w-lg md:bottom-8">
					<div className="flex gap-4 rounded-2xl border border-amber-100/15 bg-slate-950/90 p-3 shadow-2xl backdrop-blur">
						<img src={img(it, "w185")} alt={`Poster for ${it.title}`} className="h-36 w-24 shrink-0 rounded-md object-cover" />
						<div className="min-w-0 flex-1">
							<div className="flex items-start justify-between gap-2">
								<p className="text-lg font-bold leading-tight">{it.title}</p>
								<button type="button" onClick={() => setPeek(null)} className="-mr-1 -mt-1 px-2 text-xl leading-none text-slate-400 hover:text-white" aria-label="Close">
									&times;
								</button>
							</div>
							<p className="text-xs text-slate-400">
								{it.year} {it.type === "show" ? "series" : "film"}
							</p>
							<MatchText match={ex.match[peek]} className="text-sm" />
							<p className="mt-1 line-clamp-2 text-xs text-slate-300">{ex.why(peek)}</p>
							<div className="mt-2">
								<Actions ex={ex} i={peek} compact />
							</div>
						</div>
					</div>
				</div>
			)}
			<ZoomControls
				className={`absolute bottom-20 right-4 z-10 rx-md-bottom-6 ${peek != null ? "hidden md:flex" : ""}`}
				onIn={() => space.current?.zoomBy(1.8)}
				onOut={() => space.current?.zoomBy(1 / 1.8)}
				onYou={() => space.current?.flyTo(you.x, you.y, 3, 1200)}
			/>
		</div>
	)
}

// PROTOTYPE - throwaway. The lens (existing components): built for thumbs. Drag the map under a fixed lens, like a
// maps app; whatever sits inside it fills a row of poster cards below, best match first. No precise tapping on
// tiny posters needed. Filtered titles are dimmed on the map and left out of the row.
import { useMemo, useRef, useState } from "react"
import { PosterCard } from "~/ui/prototype-rec-taste/kit"
import { Filters, Peek, WhoNote, ZoomControls } from "../kit"
import { attrLabel as labelOf, pcaLayout } from "../model"
import { usePaint } from "../paint"
import { type Camera, Space, type SpaceHandle } from "../Space"
import type { Explorer } from "../useExplorer"

export default function Lens({ ex }: { ex: Explorer }) {
	const space = useRef<SpaceHandle>(null)
	const layout = useMemo(() => pcaLayout(ex.items, ex.engine), [ex.items, ex.engine])
	const paint = usePaint(ex, { featured: 0 })
	const you = ex.youIn(layout.pos)
	const [cam, setCam] = useState<Camera | null>(null)
	const last = useRef(0)
	const [peek, setPeek] = useState<number | null>(null)
	const lensPx = cam && cam.w < 768 ? 84 : 120

	const inside = useMemo(() => {
		if (!cam) return []
		const r = lensPx / cam.scale
		const out: number[] = []
		for (let i = 0; i < ex.items.length; i++) {
			if (!ex.pass[i] || ex.pool.extra.has(ex.items[i].key)) continue
			const p = layout.pos[i]
			if ((p.x - cam.x) ** 2 + (p.y - cam.y) ** 2 < r * r) out.push(i)
		}
		return out.sort((a, b) => ex.sims[b] - ex.sims[a])
	}, [cam, lensPx, layout, ex.pass, ex.sims, ex.items, ex.pool.extra])

	// What the lens is over, in words: the attributes its titles share most.
	const theme = useMemo(() => {
		if (inside.length < 3) return null
		const sum = new Array(ex.n).fill(0)
		for (const i of inside.slice(0, 30)) ex.zs[i].forEach((v, k) => (sum[k] += v))
		const keys = [...ex.engine.keyIndex.keys()]
		return sum
			.map((v, k) => ({ key: keys[k], v }))
			.filter((e) => !["direction", "acting", "cinematography", "editing", "music_composition", "dialogue_quality", "narrative_structure", "rewatchability"].includes(e.key))
			.sort((a, b) => b.v - a.v)
			.slice(0, 3)
			.map((e) => e.key)
	}, [inside, ex.zs, ex.n, ex.engine])

	const onCamera = (c: Camera) => {
		const now = performance.now()
		if (now - last.current < 90) return
		last.current = now
		setCam(c)
	}

	return (
		<div className="rx-stage flex flex-col bg-black text-white">
			<div className="relative flex-1 rx-atlas-bg">
				<Space
					ref={space}
					className="absolute inset-0"
					items={ex.items}
					pos={layout.pos}
					{...paint}
					markers={[{ id: "you", ...you, label: "You", color: "#fbbf24", kind: "pin" }]}
					onTap={(i) => i != null && setPeek(i)}
					onCamera={onCamera}
					initial={{ x: you.x, y: you.y, scale: 3.2 }}
					minScale={0.5}
					ariaLabel="Taste map. Drag it under the lens."
				/>
				{/* The lens stays put; the world moves. */}
				<div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400/90" style={{ width: lensPx * 2, height: lensPx * 2, boxShadow: "0 0 0 9999px rgba(0,0,0,.45), 0 0 40px rgba(251,191,36,.35) inset" }} />
				<div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-4 pb-8 pt-4 md:px-8">
					<h1 className="text-2xl font-bold md:text-4xl">Move the map under the lens</h1>
					<p className="mt-1 max-w-lg text-sm text-gray-300">{theme ? `In the lens: ${theme.map(labelOf).join(", ").toLowerCase()}.` : "Drag anywhere. Pinch or scroll to change how much the lens takes in."}</p>
					<div className="pointer-events-auto mt-3">
						<Filters ex={ex} showMode={false} />
					</div>
				</div>
				<ZoomControls className="absolute bottom-3 right-4 z-10" onIn={() => space.current?.zoomBy(1.6)} onOut={() => space.current?.zoomBy(1 / 1.6)} onYou={() => space.current?.flyTo(you.x, you.y, 3.2, 700)} />
			</div>
			<div className="border-t border-white/10 bg-gray-950 px-3 pb-16 pt-3 md:px-6">
				<div className="flex items-baseline justify-between gap-3">
					<h2 className="text-base font-bold">
						{inside.length ? `${inside.length} ${inside.length === 1 ? "title" : "titles"} in the lens` : "Nothing in the lens with these filters"}
					</h2>
					<WhoNote ex={ex} className="hidden md:block" />
				</div>
				<div className="mt-2 flex gap-3 overflow-x-auto pb-1">
					{inside.slice(0, 14).map((i) => (
						<div key={ex.items[i].key} className="w-24 shrink-0 md:w-28">
							<PosterCard item={ex.items[i]} services={ex.services} match={ex.match[i]} onClick={() => setPeek(i)} />
						</div>
					))}
				</div>
			</div>
			{peek != null && (
				<div className="absolute inset-x-3 bottom-16 z-40 md:inset-x-auto md:bottom-auto md:right-6 md:top-6">
					<Peek ex={ex} i={peek} wide={false} onClose={() => setPeek(null)} />
				</div>
			)}
		</div>
	)
}


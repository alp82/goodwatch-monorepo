// PROTOTYPE - throwaway. Your axes (existing components): the two axes are derived from your own ratings, the two
// directions in which the titles you rated differ most. Your rated titles stay lit with their vibe-colored
// rings, so you see your own taste as a shape, and the unseen titles around it. Tap opens a card at the poster.
import { useMemo, useRef, useState } from "react"
import { Filters, Peek, type PeekState, WhoNote, ZoomControls } from "../kit"
import { describeDir, pcaLayout, personalBasis } from "../model"
import { usePaint } from "../paint"
import { Space, type SpaceHandle } from "../Space"
import type { Explorer } from "../useExplorer"

export default function Mine({ ex }: { ex: Explorer }) {
	const space = useRef<SpaceHandle>(null)
	// Axes from the ratings the page loaded with, so they don't jump while you mark titles.
	const basis = useMemo(() => personalBasis(ex.items, ex.engine, ex.data.signals), [ex.items, ex.engine, ex.data.signals])
	const layout = useMemo(() => pcaLayout(ex.items, ex.engine, basis), [ex.items, ex.engine, basis])
	const [dx, dy] = basis.map((b) => describeDir(ex.engine, b))
	const base = usePaint(ex, { featured: 20, featuredSize: 2 })
	// Keep your own ratings bright: they're the point of this view.
	const paint = useMemo(() => {
		const alpha = Float32Array.from(base.alpha)
		const size = Float32Array.from(base.size)
		ex.items.forEach((it, i) => {
			const s = ex.signals[it.key]
			if (s?.kind === "score") {
				alpha[i] = 0.95
				size[i] = Math.max(size[i], 1.5)
			}
		})
		return { ...base, alpha, size }
	}, [base, ex.items, ex.signals])
	const [peek, setPeek] = useState<PeekState>(null)
	const you = ex.youIn(layout.pos)
	const rated = Object.values(ex.signals).filter((s) => s.kind === "score").length

	return (
		<div className="rx-stage rx-atlas-bg text-white">
			<Space
				ref={space}
				className="absolute inset-0"
				items={ex.items}
				pos={layout.pos}
				{...paint}
				markers={[{ id: "you", ...you, label: "You", color: "#fbbf24" }]}
				selected={peek?.i ?? null}
				onTap={(i, at) => setPeek(i == null ? null : { i, at })}
				onCamera={() => peek && setPeek(null)}
				initial="fit"
				minScale={0.4}
				ariaLabel="Titles placed on the two axes of your own taste"
			/>
			<div className="pointer-events-none absolute inset-0 text-base font-bold text-white/40 md:text-xl">
				<span className="absolute left-2 top-1/2 max-w-[40vh] -translate-y-1/2 rotate-180 truncate [writing-mode:vertical-rl]">{dx.negWord}</span>
				<span className="absolute right-2 top-1/2 max-w-[40vh] -translate-y-1/2 truncate [writing-mode:vertical-rl]">{dx.posWord}</span>
				<span className="absolute bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap md:bottom-3">{dy.negWord}</span>
			</div>
			<div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-4 pb-10 pt-4 md:px-8">
				<h1 className="text-2xl font-bold md:text-4xl">Your {rated} ratings pull two ways</h1>
				<p className="mt-1 max-w-2xl text-base text-gray-200 md:text-lg">
					{cap(`${dx.negWord} or ${dx.posWord}`.toLowerCase())}. {cap(`${dy.negWord} or ${dy.posWord}`.toLowerCase())}.
				</p>
				<p className="mt-2 hidden max-w-2xl text-sm text-gray-300 md:block">These axes come from what you rated, not from us. Ringed posters are yours, colored by your score. Everything else is placed on the same two axes.</p>
				<div className="pointer-events-auto mt-3">
					<Filters ex={ex} />
					<WhoNote ex={ex} className="mt-2" />
				</div>
				<p className="mt-3 text-center text-base font-bold text-white/40 md:text-xl">{dy.posWord}</p>
			</div>

			{peek && (
				<div
					className="absolute z-20 hidden md:block"
					style={{
						left: Math.min(peek.at.x + 28, (typeof window !== "undefined" ? window.innerWidth : 1440) - 380),
						top: Math.max(12, Math.min(peek.at.y - 120, (typeof window !== "undefined" ? window.innerHeight : 900) - 420)),
					}}
				>
					<Peek ex={ex} i={peek.i} onClose={() => setPeek(null)} />
				</div>
			)}
			{peek && (
				<div className="absolute inset-x-3 bottom-16 z-20 md:hidden">
					<Peek ex={ex} i={peek.i} wide onClose={() => setPeek(null)} />
				</div>
			)}
			<ZoomControls
				className={`absolute bottom-20 right-4 z-10 rx-md-bottom-6 ${peek ? "hidden md:flex" : ""}`}
				onIn={() => space.current?.zoomBy(1.8)}
				onOut={() => space.current?.zoomBy(1 / 1.8)}
				onYou={() => space.current?.flyTo(you.x, you.y, 3, 800)}
			/>
		</div>
	)
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

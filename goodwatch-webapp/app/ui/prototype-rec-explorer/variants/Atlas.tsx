// PROTOTYPE - throwaway. Taste atlas (existing components): the whole pool as islands of similar titles, each
// island named by its strongest title analysis attributes. Starts zoomed out, then flies to "You".
// Dots far out, posters close up; your best matches are big enough to read as posters from anywhere.
// Filtered titles are dimmed by default.
import { useEffect, useMemo, useRef, useState } from "react"
import { Filters, Peek, type PeekState, WhoNote, ZoomControls } from "../kit"
import { islandsLayout } from "../model"
import { usePaint } from "../paint"
import { type Label, Space, type SpaceHandle } from "../Space"
import type { Explorer } from "../useExplorer"

export default function Atlas({ ex }: { ex: Explorer }) {
	const space = useRef<SpaceHandle>(null)
	const layout = useMemo(() => islandsLayout(ex.items, ex.engine), [ex.items, ex.engine])
	const paint = usePaint(ex)
	const [peek, setPeek] = useState<PeekState>(null)
	const you = ex.youIn(layout.pos)

	const labels: Label[] = useMemo(() => {
		const max = Math.max(...layout.regions.map((r) => r.size))
		return layout.regions.map((r) => {
			const open = r.members.filter((i) => ex.pass[i]).length
			return { x: r.x, y: r.y, text: r.name, weight: r.size / max, sub: `${open} to watch` }
		})
	}, [layout, ex.pass])

	// One page-load moment: the whole map, then a flight to you.
	useEffect(() => {
		const t = setTimeout(() => space.current?.flyTo(you.x, you.y, 3.2, 1400), 900)
		return () => clearTimeout(t)
	}, [])

	const region = useMemo(() => {
		if (!peek) return null
		return layout.regions[layout.cluster[peek.i]]
	}, [peek, layout])

	return (
		<div className="rx-stage rx-atlas-bg text-white">
			<Space
				ref={space}
				className="absolute inset-0"
				items={ex.items}
				pos={layout.pos}
				{...paint}
				labels={labels}
				markers={[{ id: "you", x: you.x, y: you.y, label: "You", color: "#fbbf24", kind: "you" }]}
				selected={peek?.i ?? null}
				onTap={(i, at) => setPeek(i == null ? null : { i, at })}
				initial="fit"
				minScale={0.35}
				maxScale={30}
				ariaLabel="Taste atlas of about 2,500 films and shows"
			/>
			<div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/50 to-transparent px-4 pb-10 pt-3 md:px-8 md:pt-4">
				<h1 className="text-2xl font-bold tracking-tight md:text-5xl">Explore</h1>
				<p className="mt-1 max-w-xl text-sm text-gray-300 md:text-base">
					Films and shows grouped by their title analysis. Gold means close to your taste.<span className="hidden md:inline"> Pinch or scroll to zoom.</span>
				</p>
				<div className="pointer-events-auto mt-3">
					<Filters ex={ex} />
					<WhoNote ex={ex} className="mt-2" />
				</div>
			</div>

			{peek && (
				<div className="absolute right-4 top-4 z-20 hidden md:block">
					<Peek
						ex={ex}
						i={peek.i}
						onClose={() => setPeek(null)}
						extra={region && <p className="text-xs text-gray-400">On the island of {region.name.toLowerCase()}</p>}
					/>
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
				onYou={() => space.current?.flyTo(you.x, you.y, 3.2, 900)}
			/>
		</div>
	)
}

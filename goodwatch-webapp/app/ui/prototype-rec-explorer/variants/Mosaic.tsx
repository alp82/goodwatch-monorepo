// PROTOTYPE - throwaway. Poster wall (bolder): the taste space as an edge-to-edge wall of posters with no gaps and
// no overlaps. Each cell shows the best match for you among the titles that fall in it; zoom in and the cells
// split, revealing the next best. Region names float over the wall. Filtered titles are hidden.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { MatchText, Ring, ServiceLogos, href } from "~/ui/prototype-rec-taste/kit"
import { Actions, Filters, WhoNote, ZoomControls } from "../kit"
import { backdrop, img, islandsLayout, pcaLayout, regionName } from "../model"
import { usePaint } from "../paint"
import { type Label, Space, type SpaceHandle } from "../Space"
import type { Explorer } from "../useExplorer"

export default function Mosaic({ ex }: { ex: Explorer }) {
	const space = useRef<SpaceHandle>(null)
	// Stretch the space to the screen's shape so the wall runs edge to edge.
	const aspect = typeof window === "undefined" ? 1.6 : Math.max(0.8, Math.min(2.2, window.innerWidth / Math.max(1, window.innerHeight - 64)))
	const layout = useMemo(() => {
		const l = pcaLayout(ex.items, ex.engine)
		return { ...l, pos: l.pos.map((p) => ({ x: p.x * aspect, y: p.y })) }
	}, [ex.items, ex.engine, aspect])
	const islands = useMemo(() => islandsLayout(ex.items, ex.engine), [ex.items, ex.engine])
	const base = usePaint(ex, { featured: 0 })
	// Spots whose best title is a weak match for you sink back, so the wall glows where your taste is.
	const paint = useMemo(() => ({ ...base, alpha: Float32Array.from(base.alpha, (a, i) => (a > 0 && ex.match[i] < 80 ? 0.3 : a)) }), [base, ex.match])
	const priority = useMemo(() => Float32Array.from(ex.sims, (s, i) => s + (ex.pool.extra.has(ex.items[i].key) ? -5 : 0)), [ex.sims, ex.items, ex.pool.extra])
	const [peek, setPeek] = useState<number | null>(null)
	const you = ex.youIn(layout.pos)

	// Name the wall's regions where their titles land in this projection.
	const labels: Label[] = useMemo(() => {
		return islands.regions
			.sort((a, b) => b.size - a.size)
			.slice(0, 7)
			.map((r) => {
				const xs = r.members.map((i) => layout.pos[i].x).sort((a, b) => a - b)
				const ys = r.members.map((i) => layout.pos[i].y).sort((a, b) => a - b)
				const mid = Math.floor(r.members.length / 2)
				return { x: xs[mid], y: ys[mid], text: regionName(r.keys), weight: 0.75 }
			})
	}, [islands, layout])

	const it = peek != null ? ex.items[peek] : null
	return (
		<div className="rx-stage bg-black text-white">
			<Space
				ref={space}
				className="absolute inset-0"
				mode="mosaic"
				items={ex.items}
				pos={layout.pos}
				{...paint}
				priority={priority}
				labels={labels}
				selected={peek}
				onTap={(i) => setPeek(i)}
				initial={{ x: 0, y: 0, scale: 1.1 }}
				minScale={0.45}
				maxScale={14}
				ariaLabel="A wall of posters arranged by taste; zoom in to see more"
			/>
			<div className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-2xl bg-black/80 p-3 backdrop-blur md:left-6 md:top-6 md:p-4">
				<h1 className="text-xl font-black tracking-tight md:text-3xl">The wall</h1>
				<p className="mt-0.5 max-w-xs text-xs text-gray-300 md:text-sm">Your best match in every spot. Zoom in to split each spot into more.</p>
				<div className="mt-2">
					<Filters ex={ex} showMode={false} />
				</div>
				<WhoNote ex={ex} className="mt-2 hidden md:block" />
			</div>
			<ZoomControls
				className="absolute bottom-20 right-4 z-10 rx-md-bottom-6"
				onIn={() => space.current?.zoomBy(2)}
				onOut={() => space.current?.zoomBy(0.5)}
				onYou={() => space.current?.flyTo(you.x, you.y, 2.2, 800)}
			/>
			<AnimatePresence>
				{it && peek != null && (
					<motion.aside
						key={it.key}
						initial={{ x: 40, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: 40, opacity: 0 }}
						transition={{ type: "spring", stiffness: 380, damping: 36 }}
						className="absolute inset-x-0 bottom-0 z-30 max-h-[75%] overflow-y-auto bg-black md:inset-y-0 md:left-auto md:max-h-none md:w-[26rem] md:border-l md:border-white/10"
					>
						<div className="relative">
							<img src={backdrop(it, "w780")} alt="" className="aspect-video w-full object-cover opacity-70" />
							<div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
							<button type="button" aria-label="Close" onClick={() => setPeek(null)} className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-white">
								<XMarkIcon className="h-5 w-5" />
							</button>
							<img src={img(it, "w185")} alt={`Poster for ${it.title}`} className="absolute -bottom-10 left-4 h-36 w-24 rounded-md border-2 border-gray-800 object-cover shadow-2xl" />
						</div>
						<div className="min-h-14 px-4 pl-32 pt-3">
							<Link to={href(it)} className="block text-2xl font-black leading-tight hover:underline">
								{it.title}
							</Link>
							<p className="text-sm text-gray-400">
								{it.year} {it.type === "show" ? "series" : "film"}
							</p>
						</div>
						<div className="flex flex-col gap-3 px-4 pb-24 pt-5 md:pb-6">
							<div className="flex items-center gap-3">
								<Ring item={it} size={48} />
								<div>
									<MatchText match={ex.match[peek]} className="text-base" />
									<p className="text-sm text-gray-300">{ex.why(peek)}</p>
								</div>
							</div>
							<ServiceLogos item={it} services={ex.services} />
							<Actions ex={ex} i={peek} />
						</div>
					</motion.aside>
				)}
			</AnimatePresence>
		</div>
	)
}

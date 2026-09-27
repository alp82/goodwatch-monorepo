// PROTOTYPE - throwaway. Compass (bolder): one title at a time, full bleed, with its eight nearest neighbours in
// eight directions around it: darker above, lighter below, slower and faster to the sides. Tap a direction to
// travel; the trail runs along the bottom and a small atlas shows where you are. Starts at your best match.
// Filtered titles are skipped (hidden) when choosing neighbours.
import { ArrowPathIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { Link } from "@remix-run/react"
import { MatchText, Ring, ServiceLogos, href } from "~/ui/prototype-rec-taste/kit"
import { Actions, Filters, WhoNote } from "../kit"
import { type Vec, norm, seeded } from "../math"
import { DIRECTIONS, backdrop, directionVec, img, islandsLayout } from "../model"
import { usePaint } from "../paint"
import { Space } from "../Space"
import type { Explorer } from "../useExplorer"

// Compass cells, row by row; null is the current title.
const COMPASS: (string | null)[] = ["tenser", "darker", "stranger", "slower", null, "faster", "grounded", "lighter", "funnier"]

export default function Steer({ ex }: { ex: Explorer }) {
	const [trail, setTrail] = useState<number[]>(() => (ex.ranked.length ? [ex.ranked[0]] : [0]))
	const cur = trail[trail.length - 1]
	const it = ex.items[cur]
	const unit = (v: Vec) => {
		const l = norm(v) || 1
		return v.map((x) => x / l)
	}
	const neighbours = useMemo(() => {
		const from = unit(ex.zs[cur])
		const taken = new Set([...trail, cur])
		const out: Record<string, number> = {}
		for (const d of DIRECTIONS) {
			const dv = unit(directionVec(ex.engine, d, ex.n))
			const [i] = ex.nearest(
				from.map((v, k) => v + dv[k] * 0.6),
				1,
				taken,
			)
			if (i != null) {
				out[d.id] = i
				taken.add(i)
			}
		}
		return out
	}, [cur, trail, ex.zs, ex.engine, ex.n, ex.nearest])

	const atlas = useMemo(() => islandsLayout(ex.items, ex.engine), [ex.items, ex.engine])
	const paint = usePaint(ex, { featured: 0 })
	const mini = useMemo(() => {
		const size = new Float32Array(ex.items.length).fill(1)
		const glow = new Uint8Array(ex.items.length)
		for (const i of trail) size[i] = 2.5
		glow[cur] = 1
		return { ...paint, size, glow }
	}, [paint, trail, cur, ex.items.length])
	const rand = useRef(seeded(Date.now() % 1000))

	const travel = (i: number) => setTrail((t) => [...t, i])
	const dirLabel = (id: string) => DIRECTIONS.find((d) => d.id === id)?.label ?? id

	return (
		<div className="rx-stage bg-black text-white">
			<AnimatePresence mode="popLayout">
				<motion.img
					key={it.key}
					src={backdrop(it)}
					alt=""
					initial={{ opacity: 0, scale: 1.06 }}
					animate={{ opacity: 0.55, scale: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.7 }}
					className="absolute inset-0 h-full w-full object-cover"
				/>
			</AnimatePresence>
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
			<div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />

			<div className="relative flex h-full flex-col overflow-y-auto px-4 pb-20 pt-5 md:px-10 lg:flex-row lg:items-center lg:gap-10 lg:overflow-hidden lg:pb-28">
				{/* The title you're on. */}
				<div className="min-w-0 lg:w-[42%]">
					<div className="flex flex-wrap items-center gap-2">
						<Filters ex={ex} showMode={false} />
						<button
							type="button"
							onClick={() => setTrail([ex.ranked[Math.floor(rand.current() * Math.min(60, ex.ranked.length))]])}
							className="inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-white/15 bg-black/50 px-3 text-sm font-semibold text-gray-300 hover:text-white"
						>
							<ArrowPathIcon className="h-4 w-4" /> Somewhere else
						</button>
					</div>
					<AnimatePresence mode="wait">
						<motion.div key={it.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
							<p className="mt-6 text-sm font-semibold text-amber-300/90">{trail.length === 1 ? "Your best match right now" : `${trail.length - 1} ${trail.length === 2 ? "step" : "steps"} from where you started`}</p>
							<h1 className="mt-1 text-4xl font-black leading-[0.95] tracking-tight md:text-6xl xl:text-7xl">
								<Link to={href(it)} className="hover:underline">
									{it.title}
								</Link>
							</h1>
							<p className="mt-2 text-gray-300">
								{it.year} {it.type === "show" ? "series" : "film"}
								{it.genres.length ? `, ${it.genres.slice(0, 3).join(", ").toLowerCase()}` : ""}
							</p>
							<div className="mt-4 flex items-center gap-3">
								<Ring item={it} size={52} />
								<div>
									<MatchText match={ex.match[cur]} className="text-base" />
									<p className="max-w-md text-sm text-gray-300">{ex.why(cur)}</p>
								</div>
							</div>
							<div className="mt-4">
								<ServiceLogos item={it} services={ex.services} />
							</div>
							<div className="mt-4 max-w-md">
								<Actions ex={ex} i={cur} />
							</div>
						</motion.div>
					</AnimatePresence>
				</div>

				{/* The compass. */}
				<div className="rx-compass mt-8 grid shrink-0 grid-cols-3 gap-2 self-center md:gap-3 lg:mt-0">
					{COMPASS.map((id, k) => {
						if (id == null)
							return (
								<div key="here" className="relative">
									<img src={img(it, "w342")} alt={`Poster for ${it.title}`} className="aspect-[2/3] w-full rounded-lg object-cover shadow-[0_0_50px_rgba(245,158,11,.45)] ring-2 ring-amber-400" />
								</div>
							)
						const i = neighbours[id]
						if (i == null) return <div key={id} />
						const n = ex.items[i]
						return (
							<button key={id} type="button" onClick={() => travel(i)} className="group relative overflow-hidden rounded-lg text-left">
								<img src={img(n, "w342")} alt={`Poster for ${n.title}`} className="aspect-[2/3] w-full object-cover opacity-60 transition group-hover:scale-105 group-hover:opacity-100" />
								<span className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/90 to-transparent px-2 pb-6 pt-1.5 text-sm font-black md:text-base">{dirLabel(id)}</span>
								<span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6 text-xs font-semibold text-gray-200">{n.title}</span>
							</button>
						)
					})}
				</div>
			</div>

			{/* Trail along the bottom, with the atlas showing where it runs. */}
			<div className="absolute inset-x-0 bottom-14 flex items-end gap-4 px-4 md:bottom-4 md:px-10">
				<ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Your trail">
					{trail.map((i, k) => (
						<li key={`${i}-${k}`} className="flex shrink-0 items-center gap-1">
							{k > 0 && <span className="h-px w-3 bg-amber-400/60" />}
							<button type="button" onClick={() => setTrail((t) => t.slice(0, k + 1))} title={ex.items[i].title} className={`overflow-hidden rounded ${k === trail.length - 1 ? "ring-2 ring-amber-400" : "opacity-60 hover:opacity-100"}`}>
								<img src={img(ex.items[i], "w92")} alt={ex.items[i].title} className="h-12 w-8 object-cover" />
							</button>
						</li>
					))}
				</ol>
				<div className="relative hidden h-36 w-56 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black/80 lg:block">
					<Space
						key="mini"
						className="absolute inset-0"
						items={ex.items}
						pos={atlas.pos}
						{...mini}
						trail={trail.map((i) => atlas.pos[i])}
						markers={[{ id: "here", ...atlas.pos[cur], label: "Here", color: "#fbbf24", kind: "pin" }]}
						onTap={(i) => i != null && travel(i)}
						initial="fit"
						minScale={0.05}
						ariaLabel="Where this title sits in the atlas"
					/>
				</div>
			</div>
			<WhoNote ex={ex} className="absolute right-4 top-2 hidden lg:block" />
		</div>
	)
}

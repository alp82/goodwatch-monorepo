// PROTOTYPE - throwaway. Pick your axes (existing components): the Taste map the owner liked, grown to the full
// pool. Choose any two axes, pan and zoom, and drag "You" to steer: your picks re-rank live and the list
// follows. Filtered titles are hidden by default.
import { ArrowsRightLeftIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { MatchText } from "~/ui/prototype-rec-taste/kit"
import { Filters, Peek, type PeekState, WhoNote, ZoomControls } from "../kit"
import { type Pt, norm } from "../math"
import { AXES, axesLayout, axisById, axisDir, img } from "../model"
import { usePaint } from "../paint"
import { Space, type SpaceHandle } from "../Space"
import type { Explorer } from "../useExplorer"

const STEER = 1.6 // taste pull for dragging You across half the field

export default function Axes({ ex }: { ex: Explorer }) {
	const space = useRef<SpaceHandle>(null)
	const [xId, setX] = useState("mood")
	const [yId, setY] = useState("pace")
	const ax = axisById(xId)
	const ay = axisById(yId)
	const pos = useMemo(() => axesLayout(ex.items, ex.engine, ax, ay), [ex.items, ex.engine, ax, ay])
	const paint = usePaint(ex, { featured: 30, featuredSize: 2.4 })
	const [peek, setPeek] = useState<PeekState>(null)
	const [drag, setDrag] = useState<{ from: Pt; at: Pt; steer0: number[] } | null>(null)
	const you = ex.youIn(pos)
	const shownYou = drag?.at ?? you

	const steerFrom = (from: Pt, at: Pt, steer0: number[]) => {
		const dx = (at.x - from.x) / 480
		const dy = -(at.y - from.y) / 480
		const vx = axisDir(ex.engine, ax, ex.n)
		const vy = axisDir(ex.engine, ay, ex.n)
		const scale = norm(ex.base) || 1
		ex.setSteer(steer0.map((s, k) => s + (dx * vx[k] + dy * vy[k]) * STEER * scale * (ax.year || ay.year ? 0.5 : 1)))
	}
	const onMarker = (_: string, p: Pt, phase: "move" | "end") => {
		const d = drag ?? { from: you, at: p, steer0: ex.steer }
		if (phase === "move") {
			setDrag({ ...d, at: p })
			steerFrom(d.from, p, d.steer0)
		} else {
			steerFrom(d.from, p, d.steer0)
			setDrag(null)
		}
	}
	const steered = ex.steer.some((s) => Math.abs(s) > 1e-6)
	const top = ex.ranked.slice(0, 8)

	const select = (value: string, onChange: (v: string) => void, other: string, label: string) => (
		<label className="flex min-w-0 items-center gap-2 text-sm text-gray-300">
			<span className="hidden font-semibold text-gray-400 md:inline">{label}</span>
			<select
				value={value}
				// Arrow keys choose an axis here instead of switching prototype variants.
				onKeyDown={(e) => e.stopPropagation()}
				onChange={(e) => {
					onChange(e.target.value)
					setPeek(null)
				}}
				aria-label={label === "Up" ? "Vertical axis" : "Horizontal axis"}
				className="h-9 w-full min-w-0 rounded-full border-2 border-white/15 bg-black/70 px-2 text-xs font-semibold text-white md:w-auto md:px-3 md:text-sm"
			>
				{AXES.filter((a) => a.id !== other).map((a) => (
					<option key={a.id} value={a.id}>
						{a.negWord} to {a.posWord.toLowerCase()}
					</option>
				))}
			</select>
		</label>
	)

	return (
		<div className="bg-black text-white">
			<div className="block lg:flex">
				<div className="rx-stage flex flex-1 flex-col">
					<div className="border-b border-white/10 px-4 pb-3 pt-3 md:px-6 md:pt-4">
						<div className="flex flex-wrap items-end justify-between gap-2 md:gap-3">
							<div className="min-w-0">
								<h1 className="text-xl font-bold md:text-4xl">Steer by taste</h1>
								<p className="mt-1 hidden max-w-xl text-sm text-gray-300 md:block">Drag the gold crosshair toward what you're in the mood for. Your picks follow.</p>
							</div>
							<Filters ex={ex} className="w-full md:w-auto" />
						</div>
						<div className="mt-2 flex flex-nowrap items-center gap-2 md:mt-3 md:flex-wrap">
							{select(xId, setX, yId, "Across")}
							<button
								type="button"
								aria-label="Swap axes"
								onClick={() => {
									setX(yId)
									setY(xId)
								}}
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/15 bg-black/70 hover:bg-white/10"
							>
								<ArrowsRightLeftIcon className="h-4 w-4" />
							</button>
							{select(yId, setY, xId, "Up")}
							{steered && (
								<button type="button" onClick={() => ex.setSteer(new Array(ex.n).fill(0))} className="h-9 shrink-0 whitespace-nowrap rounded-full px-2 text-xs font-semibold text-amber-300 underline-offset-4 hover:underline md:px-3 md:text-sm">
									Reset steering
								</button>
							)}
						</div>
					</div>
					<div className="relative flex-1 rx-atlas-bg">
					<Space
						ref={space}
						className="absolute inset-0"
						items={ex.items}
						pos={pos}
						{...paint}
						lines={[
							[
								{ x: -500, y: 0 },
								{ x: 500, y: 0 },
							],
							[
								{ x: 0, y: -500 },
								{ x: 0, y: 500 },
							],
						]}
						markers={[{ id: "you", ...shownYou, label: drag ? "Steering" : "You", color: "#fbbf24", draggable: true }]}
						onMarkerDrag={onMarker}
						selected={peek?.i ?? null}
						onTap={(i, at) => setPeek(i == null ? null : { i, at })}
						initial={{ x: you.x, y: you.y, scale: 1.6 }}
						minScale={0.4}
						ariaLabel={`Titles placed from ${ax.negWord} to ${ax.posWord} and ${ay.negWord} to ${ay.posWord}`}
					/>
					{/* Axis words at the edges, as on the Taste map. */}
					<div className="pointer-events-none absolute inset-0 text-lg font-bold text-white/35 md:text-2xl">
						<span className="absolute left-2 top-1/2 -translate-y-1/2 rotate-180 [writing-mode:vertical-rl]">{ax.negWord}</span>
						<span className="absolute right-2 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl]">{ax.posWord}</span>
						<span className="absolute left-1/2 top-2 -translate-x-1/2">{ay.posWord}</span>
						<span className="absolute bottom-32 left-1/2 -translate-x-1/2 lg:bottom-2">{ay.negWord}</span>
					</div>
					{peek && (
						<div className="absolute inset-x-3 bottom-16 z-20 md:inset-x-auto md:bottom-6 md:left-12">
							<Peek ex={ex} i={peek.i} onClose={() => setPeek(null)} wide={false} />
						</div>
					)}
					<ZoomControls
						className={`absolute bottom-40 right-4 z-10 md:bottom-6 ${peek ? "hidden md:flex" : ""}`}
						onIn={() => space.current?.zoomBy(1.8)}
						onOut={() => space.current?.zoomBy(1 / 1.8)}
						onYou={() => space.current?.flyTo(you.x, you.y, 3, 800)}
					/>
					{/* Mobile: the picks as a strip. */}
					<div className="absolute inset-x-0 bottom-16 z-10 flex gap-2 overflow-x-auto px-3 pb-2 lg:hidden">
						{top.map((i) => (
							<button key={ex.items[i].key} type="button" onClick={() => setPeek({ i, at: { x: 0, y: 0 } })} className="w-14 shrink-0">
								<img src={img(ex.items[i], "w185")} alt={ex.items[i].title} className="aspect-[2/3] w-full rounded border-2 border-amber-500/50 object-cover" />
							</button>
						))}
					</div>
					</div>
				</div>
				<aside className="hidden w-80 shrink-0 border-l border-white/10 bg-black p-4 lg:block">
					<h2 className="text-lg font-bold">Your picks from here</h2>
					<p className="text-sm text-gray-400">The glowing posters on the map.</p>
					<ol className="mt-3 flex flex-col gap-2">
						<AnimatePresence initial={false}>
							{top.map((i) => (
								<motion.li key={ex.items[i].key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
									<button
										type="button"
										onClick={() => {
											setPeek({ i, at: { x: 0, y: 0 } })
											space.current?.flyTo(pos[i].x, pos[i].y, 4, 700)
										}}
										className="flex w-full items-center gap-3 rounded-lg bg-white/5 p-1.5 pr-3 text-left hover:bg-white/10"
									>
										<img src={img(ex.items[i], "w92")} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-bold">{ex.items[i].title}</span>
											<MatchText match={ex.match[i]} />
											<span className="block truncate text-xs text-gray-400">{ex.why(i)}</span>
										</span>
									</button>
								</motion.li>
							))}
						</AnimatePresence>
					</ol>
					<WhoNote ex={ex} className="mt-4" />
				</aside>
			</div>
		</div>
	)
}

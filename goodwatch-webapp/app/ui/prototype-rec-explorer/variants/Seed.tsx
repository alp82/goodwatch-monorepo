// PROTOTYPE - throwaway. Start from a title you love (existing components): pick one of your favorites (or start
// from you), and the space rearranges around it: the closer a poster, the more alike. "More like this, but
// darker" walks to the nearest title in that direction and leaves a trail you can step back along.
// Filtered titles are hidden by default.
import { ArrowUturnLeftIcon, SparklesIcon } from "@heroicons/react/24/solid"
import { useMemo, useRef, useState } from "react"
import { MatchText } from "~/ui/prototype-rec-taste/kit"
import { Filters, Peek, type PeekState, WhoNote, ZoomControls } from "../kit"
import { type Pt, type Vec, dot, norm, relax } from "../math"
import { DIRECTIONS, POSTER_W, directionVec, img } from "../model"
import { usePaint } from "../paint"
import { Space, type SpaceHandle } from "../Space"
import type { Explorer } from "../useExplorer"

const YOU = -1 // the seed is your taste vector rather than a title

export default function Seed({ ex }: { ex: Explorer }) {
	const space = useRef<SpaceHandle>(null)
	const [trail, setTrail] = useState<number[]>([])
	const [peek, setPeek] = useState<PeekState>(null)
	const seed = trail.length ? trail[trail.length - 1] : null
	const n = ex.n

	// Compass: up is darker, right is faster.
	const up = useMemo(() => unit(directionVec(ex.engine, DIRECTIONS[0], n)), [ex.engine, n])
	const right = useMemo(() => unit(directionVec(ex.engine, DIRECTIONS[2], n)), [ex.engine, n])
	const center: Vec = seed == null || seed === YOU ? ex.taste : ex.zs[seed]

	// Radial layout: distance by similarity rank, angle by which way a title differs. Angles are spread evenly
	// (keeping their order) so one crowded side doesn't swallow the view, then turned so "darker" stays on top.
	const pos = useMemo(() => {
		const sims = ex.zs.map((z) => cosine(z, center))
		const order = sims.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0])
		const fromSeed = seed === YOU || seed == null ? 0 : 1
		const raw = ex.zs.map((z) => {
			const d = z.map((v, k) => v - center[k] * fromSeed)
			return Math.atan2(-dot(d, up), dot(d, right) || 1e-6)
		})
		const byAngle = raw.map((a, i) => [a, i] as const).sort((a, b) => a[0] - b[0])
		const even = new Array(raw.length)
		byAngle.forEach(([, i], r) => {
			even[i] = -Math.PI + (r / raw.length) * Math.PI * 2
		})
		// Where does "straight up" (darker) land after spreading? Rotate it back to the top.
		const upRank = byAngle.findIndex(([a]) => a >= -Math.PI / 2)
		const shift = -Math.PI / 2 - (-Math.PI + (Math.max(0, upRank) / raw.length) * Math.PI * 2)
		const out: Pt[] = new Array(ex.items.length)
		order.forEach(([, i], r) => {
			const a = even[i] + shift
			const radius = seed === i ? 0 : 22 + Math.sqrt(r) * POSTER_W * 0.95
			out[i] = { x: Math.cos(a) * radius, y: Math.sin(a) * radius }
		})
		return relax(out, POSTER_W * 0.9, 16, (i) => i === seed)
	}, [center, ex.zs, ex.items.length, up, right, seed])

	const paint = usePaint(ex, { featured: 0 })
	const styled = useMemo(() => {
		const size = new Float32Array(ex.items.length).fill(1)
		const glow = new Uint8Array(ex.items.length)
		const ring = [...paint.ring]
		const alpha = Float32Array.from(paint.alpha)
		for (const i of trail) {
			if (i < 0) continue
			alpha[i] = 1
			size[i] = i === seed ? 3.4 : 1.8
			ring[i] = i === seed ? "#fbbf24" : "rgba(251,191,36,.6)"
			if (i === seed) glow[i] = 1
		}
		const order = [...paint.order].sort((a, b) => size[a] - size[b])
		return { ...paint, alpha, size, glow, ring, order }
	}, [paint, trail, seed, ex.items.length])

	const go = (dirId: string) => {
		const d = DIRECTIONS.find((x) => x.id === dirId)
		if (!d) return
		const from = seed == null || seed === YOU ? ex.taste : ex.zs[seed]
		const dv = unit(directionVec(ex.engine, d, n))
		const scale = norm(from) || 1
		const target = from.map((v, k) => v / scale + dv[k] * 0.55)
		const [next] = ex.nearest(target, 1, new Set(trail.filter((i) => i >= 0)))
		if (next == null) return
		setTrail((t) => [...(t.length ? t : [YOU]), next])
		setPeek({ i: next, at: { x: 0, y: 0 } })
		space.current?.flyTo(0, 0, 2.2, 800)
	}
	const start = (i: number) => {
		setTrail([i])
		setPeek(null)
		space.current?.flyTo(0, 0, 2.2, 900)
	}
	const trailPts = trail.filter((i) => i >= 0).map((i) => pos[i])

	// First step: choose where to start.
	if (seed == null) {
		const favs = ex.favorites.length >= 4 ? ex.favorites : ex.loved
		return (
			<div className="rx-stage overflow-y-auto bg-black px-4 py-8 text-white md:px-10">
				<h1 className="text-3xl font-bold md:text-5xl">Start from a title you love</h1>
				<p className="mt-2 max-w-xl text-gray-300">We'll lay out everything else around it, closest first. Then steer: more like this, but darker, faster, or stranger.</p>
				<button type="button" onClick={() => start(YOU)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-amber-500 px-4 font-semibold text-black hover:bg-amber-400">
					<SparklesIcon className="h-5 w-5" />
					Start from my taste instead
				</button>
				<div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
					{favs.slice(0, 16).map((i) => {
						const it = ex.items[i]
						const s = ex.signals[it.key]
						return (
							<button key={it.key} type="button" onClick={() => start(i)} className="group text-left">
								<div className="overflow-hidden rounded-lg border-4 border-gray-800 bg-gray-900 group-hover:border-amber-600">
									<img src={img(it, "w342")} alt={`Poster for ${it.title}`} className="aspect-[2/3] w-full object-cover" />
								</div>
								<span className="mt-1 block truncate text-sm font-bold">{it.title}</span>
								{s?.kind === "score" && <span className="text-xs text-gray-400">You rated it {s.score}</span>}
							</button>
						)
					})}
				</div>
				<WhoNote ex={ex} className="mt-6 pb-20" />
			</div>
		)
	}

	const seedItem = seed >= 0 ? ex.items[seed] : null
	return (
		<div className="rx-stage rx-atlas-bg text-white">
			<Space
				ref={space}
				className="absolute inset-0"
				items={ex.items}
				pos={pos}
				{...styled}
				trail={trailPts}
				markers={seed === YOU ? [{ id: "you", x: 0, y: 0, label: "You", color: "#fbbf24", kind: "you" }] : []}
				selected={peek?.i ?? null}
				onTap={(i, at) => setPeek(i == null ? null : { i, at })}
				initial={{ x: 0, y: 0, scale: 2.2 }}
				minScale={0.3}
				ariaLabel="Titles arranged around your starting point, closest first"
			/>
			<div className="pointer-events-none absolute inset-0 text-sm font-bold text-white/35 md:text-lg">
				<span className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-[160px]">Darker</span>
				<span className="absolute left-1/2 top-[55%] -translate-x-1/2 translate-y-[140px]">Lighter</span>
				<span className="absolute left-3 top-[55%] -translate-y-1/2">Slower</span>
				<span className="absolute right-3 top-[55%] -translate-y-1/2">Faster</span>
			</div>

			<div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/90 via-black/70 to-transparent px-4 pb-6 pt-3 md:px-8">
				<div className="flex items-center gap-3">
					<button type="button" onClick={() => setTrail([])} className="shrink-0 rounded-full border-2 border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white">
						Change start
					</button>
					<h1 className="min-w-0 truncate text-lg font-bold md:text-2xl">{seedItem ? `More like ${seedItem.title}, but...` : "More like your taste, but..."}</h1>
				</div>
				<div className="mt-2 flex gap-2 overflow-x-auto pb-1">
					{DIRECTIONS.map((d) => (
						<button key={d.id} type="button" onClick={() => go(d.id)} className="h-9 shrink-0 rounded-full border-2 border-white/15 bg-black/60 px-4 text-sm font-semibold hover:border-amber-500 hover:text-amber-200">
							{d.label}
						</button>
					))}
				</div>
				<div className="mt-2 flex flex-wrap items-center gap-3">
					<Filters ex={ex} showMode={false} />
				</div>
				{/* The trail: every step so far, tap to go back. */}
				{trail.length > 1 && (
					<ol className="mt-3 flex items-center gap-1.5 overflow-x-auto" aria-label="Your trail">
						{trail.map((i, k) => (
							<li key={`${i}-${k}`} className="flex shrink-0 items-center gap-1.5">
								{k > 0 && <span className="text-amber-400/70">&rsaquo;</span>}
								<button
									type="button"
									onClick={() => setTrail((t) => t.slice(0, k + 1))}
									className={`overflow-hidden rounded ${k === trail.length - 1 ? "ring-2 ring-amber-400" : "opacity-70 hover:opacity-100"}`}
									title={i >= 0 ? ex.items[i].title : "Your taste"}
								>
									{i >= 0 ? <img src={img(ex.items[i], "w92")} alt={ex.items[i].title} className="h-12 w-8 object-cover" /> : <span className="flex h-12 w-8 items-center justify-center bg-amber-500 text-[10px] font-bold text-black">You</span>}
								</button>
							</li>
						))}
						<li>
							<button type="button" onClick={() => setTrail((t) => t.slice(0, -1))} className="ml-1 flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white">
								<ArrowUturnLeftIcon className="h-4 w-4" /> Step back
							</button>
						</li>
					</ol>
				)}
			</div>

			{peek && peek.i >= 0 && (
				<div className="absolute inset-x-3 bottom-16 z-20 md:inset-x-auto md:bottom-6 md:right-20">
					<Peek
						ex={ex}
						i={peek.i}
						onClose={() => setPeek(null)}
						wide={false}
						extra={
							peek.i !== seed && (
								<button type="button" onClick={() => start(peek.i)} className="h-9 rounded-lg border-2 border-amber-500/50 text-sm font-semibold text-amber-200 hover:bg-white/5">
									Start from here
								</button>
							)
						}
					/>
				</div>
			)}
			{!peek && seedItem && (
				<div className="absolute bottom-16 left-4 z-10 flex items-center gap-3 rounded-xl bg-black/70 p-2 pr-4 backdrop-blur md:bottom-6">
					<img src={img(seedItem, "w92")} alt="" className="h-14 w-10 rounded object-cover" />
					<div>
						<p className="text-sm font-bold">{seedItem.title}</p>
						<MatchText match={ex.match[seed]} />
					</div>
				</div>
			)}
			<ZoomControls
				className={`absolute bottom-20 right-4 z-10 rx-md-bottom-6 ${peek ? "hidden md:flex" : ""}`}
				onIn={() => space.current?.zoomBy(1.8)}
				onOut={() => space.current?.zoomBy(1 / 1.8)}
				onYou={() => space.current?.flyTo(0, 0, 2.2, 700)}
				youLabel="Back to start"
			/>
		</div>
	)
}

const unit = (v: Vec) => {
	const l = norm(v) || 1
	return v.map((x) => x / l)
}
const cosine = (a: Vec, b: Vec) => dot(a, b) / ((norm(a) || 1) * (norm(b) || 1))

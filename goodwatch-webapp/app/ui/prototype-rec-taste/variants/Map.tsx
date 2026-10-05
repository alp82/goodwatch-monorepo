// PROTOTYPE - throwaway. Taste map (bolder): posters laid out on two title analysis axes, with your
// taste as a crosshair among them. Drag the crosshair to steer; tap a poster to triage it.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useRef, useState } from "react"
import { getVibeColorValue } from "~/utils/ratings"
import type { Score } from "~/server/scores.server"
import { reasonText } from "../engine"
import { MatchText, Moved, ServicesSwitch, layoutSpring } from "../kit"
import { type PoolItem, type Signal, posterUrl } from "../model"
import type { Taste } from "../useTaste"

type Axis = { pos: string; neg?: string; posWord: string; negWord: string }
const AXES: Record<string, Axis> = {
	mood: { pos: "bleakness", neg: "hopefulness", posWord: "Bleak", negWord: "Hopeful" },
	pace: { pos: "fast_pace", neg: "slow_burn", posWord: "Fast", negWord: "Slow burn" },
	world: { pos: "fantasy", neg: "contemporary_realism", posWord: "Fantastical", negWord: "Grounded" },
	humor: { pos: "dark_humor", neg: "wholesome", posWord: "Dark humor", negWord: "Light" },
	mind: { pos: "complexity", neg: "pathos", posWord: "Head", negWord: "Heart" },
	nerve: { pos: "tension", neg: "wholesome", posWord: "Tense", negWord: "Calm" },
}
const PRESETS = [
	{ name: "Mood and pace", x: "mood", y: "pace" },
	{ name: "Real or fantastical", x: "world", y: "humor" },
	{ name: "Head or heart", x: "mind", y: "nerve" },
]
const STEP_PCT = 11 // how far a drag must go for one dial step

export default function TasteMap({ taste }: { taste: Taste }) {
	const [preset, setPreset] = useState(0)
	const ax = AXES[PRESETS[preset].x]
	const ay = AXES[PRESETS[preset].y]
	const [selected, setSelected] = useState<string | null>(null)
	const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
	const field = useRef<HTMLDivElement>(null)

	const picks = taste.picks.slice(0, 24)
	const pickRank = new Map(picks.map((p, i) => [p.item.key, i]))

	// ~70 titles: your next picks, what you rated, and popular titles around them. Stable while you steer
	// so posters glide instead of popping.
	const base = useMemo(() => {
		const keys = new Set<string>()
		for (const p of taste.everywhere.slice(0, 36)) keys.add(p.item.key)
		for (const [k, s] of Object.entries(taste.signals)) if (s.kind === "score" && keys.size < 60) keys.add(k)
		for (const it of taste.pool.items) {
			if (keys.size >= 74) break
			keys.add(it.key)
		}
		return keys
	}, [taste.pool])
	const shownKeys = [...new Set([...base, ...picks.map((p) => p.item.key)])]
	const shownId = shownKeys.join(",")
	const shown = useMemo(() => shownKeys.map((k) => taste.item(k)).filter(Boolean), [shownId])

	const axisValue = (it: PoolItem, a: Axis) => {
		const z = taste.engine.z.get(it.key) as number[]
		const pos = z[taste.engine.keyIndex.get(a.pos) as number]
		const neg = a.neg ? z[taste.engine.keyIndex.get(a.neg) as number] : 0
		return pos - neg
	}
	// Rank-spread positions so posters fill the field instead of clumping.
	const positions = useMemo(() => {
		const spread = (vals: { key: string; v: number }[]) => {
			const sorted = [...vals].sort((a, b) => a.v - b.v)
			return new Map(sorted.map((e, i) => [e.key, 10 + (i / Math.max(1, sorted.length - 1)) * 80]))
		}
		const xs = spread(shown.map((it) => ({ key: it.key, v: axisValue(it, ax) })))
		const ys = spread(shown.map((it) => ({ key: it.key, v: axisValue(it, ay) })))
		// y grows downward on screen; "pos" end sits on top.
		return new Map(shown.map((it) => [it.key, { x: xs.get(it.key) as number, y: 100 - (ys.get(it.key) as number) }]))
	}, [shown, preset])

	// Your taste: the center of your top eight picks on this map.
	const top = picks.slice(0, 8).map((p) => positions.get(p.item.key)).filter((p): p is { x: number; y: number } => !!p)
	const cross = top.length ? { x: top.reduce((a, p) => a + p.x, 0) / top.length, y: top.reduce((a, p) => a + p.y, 0) / top.length } : { x: 50, y: 50 }
	const shownCross = drag ?? cross

	const toPct = (e: React.PointerEvent) => {
		const r = field.current?.getBoundingClientRect()
		if (!r) return cross
		return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) }
	}
	const steer = (a: Axis, delta: number) => {
		const steps = Math.round(delta / STEP_PCT)
		if (!steps) return
		const cur = taste.dials[a.pos] ?? 0
		const next = Math.max(-2, Math.min(2, cur + steps))
		taste.dial(a.pos, next)
		if (a.neg) taste.dial(a.neg, -next)
	}
	const onUp = (e: React.PointerEvent) => {
		if (!drag) return
		const end = toPct(e)
		steer(ax, end.x - cross.x)
		steer(ay, cross.y - end.y)
		setDrag(null)
	}
	const pull = (a: Axis) => {
		const s = taste.dials[a.pos] ?? 0
		return s ? `${Math.abs(s) === 2 ? "Strongly toward" : "Toward"} ${s > 0 ? a.posWord : a.negWord}` : null
	}
	const pulls = [pull(ax), pull(ay)].filter(Boolean)
	const resetAxes = () => {
		for (const a of [ax, ay]) {
			taste.dial(a.pos, 0)
			if (a.neg) taste.dial(a.neg, 0)
		}
	}

	const sel = selected ? taste.item(selected) : null
	const selPos = selected ? positions.get(selected) : null
	const selPick = selected ? taste.picks.find((p) => p.item.key === selected) : null
	const selSig = selected ? taste.signals[selected] : undefined
	const answer = (sig: Signal) => {
		if (!selected) return
		taste.set(selected, sig)
		setSelected(null)
	}

	const popover = sel && (
		<div className="w-64 rounded-xl border border-white/10 bg-black/90 p-3 shadow-2xl backdrop-blur">
			<div className="flex gap-3">
				<img src={posterUrl(sel, "w185")} alt="" className="h-24 w-16 shrink-0 rounded object-cover" />
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-1">
						<p className="font-bold leading-tight text-white">{sel.title}</p>
						<button type="button" aria-label="Close" onClick={() => setSelected(null)} className="-mr-1 -mt-1 p-1 text-gray-400 hover:text-white">
							<XMarkIcon className="h-4 w-4" />
						</button>
					</div>
					<p className="text-xs text-gray-400">{sel.year}</p>
					{selSig?.kind === "score" ? (
						<p className="mt-1 text-sm font-bold" style={{ color: getVibeColorValue(selSig.score as Score) }}>
							You rated it {selSig.score}
						</p>
					) : selPick ? (
						<>
							<MatchText match={selPick.match} />
							<p className="mt-0.5 line-clamp-2 text-xs text-gray-300">{reasonText(selPick)}</p>
						</>
					) : null}
				</div>
			</div>
			{selSig?.kind !== "score" && (
				<div className="mt-3 grid grid-cols-3 gap-1">
					{[
						{ label: "Seen it", sig: { kind: "seen" } as Signal, cls: "bg-emerald-800 hover:bg-emerald-700" },
						{ label: "Not seen", sig: { kind: "unseen" } as Signal, cls: "bg-sky-800 hover:bg-sky-700" },
						{ label: "Not interested", sig: { kind: "no" } as Signal, cls: "bg-stone-800 hover:bg-stone-700" },
					].map((b) => (
						<button key={b.label} type="button" onClick={() => answer(b.sig)} className={`rounded-lg border-2 border-white/10 px-1 py-1.5 text-[11px] font-semibold leading-tight text-white ${b.cls}`}>
							{b.label}
						</button>
					))}
				</div>
			)}
		</div>
	)

	return (
		<div className="min-h-screen bg-black pb-40 text-white">
			<div className="mx-auto max-w-[1500px] px-4 pt-6 md:px-8">
				<header className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h1 className="text-3xl font-bold md:text-5xl">Where your taste sits</h1>
						<p className="mt-2 max-w-xl text-gray-400">Every poster is placed by its title analysis. The crosshair is you. Drag it to pull your picks somewhere else.</p>
					</div>
					<ServicesSwitch taste={taste} />
				</header>
				<div className="mt-5 flex flex-wrap items-center gap-2">
					{PRESETS.map((p, i) => (
						<button
							key={p.name}
							type="button"
							aria-pressed={i === preset}
							onClick={() => {
								setPreset(i)
								setSelected(null)
							}}
							className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${i === preset ? "bg-white text-black" : "bg-white/5 text-gray-300 hover:bg-white/10"}`}
						>
							{p.name}
						</button>
					))}
					{pulls.length > 0 && (
						<span className="ml-auto flex items-center gap-3 text-sm text-amber-300">
							{pulls.join(", ")}
							<button type="button" onClick={resetAxes} className="text-gray-400 underline-offset-4 hover:text-white hover:underline">
								Reset
							</button>
						</span>
					)}
				</div>

				<div className="mt-4 flex flex-col gap-6 lg:flex-row">
					<div
						ref={field}
						className="relative h-[62vh] min-h-[420px] flex-1 touch-none select-none overflow-hidden rounded-2xl lg:h-[72vh]"
						style={{ background: "radial-gradient(ellipse at center, #1c1917 0%, #0c0a09 55%, #000 100%)" }}
						onPointerMove={(e) => drag && setDrag(toPct(e))}
						onPointerUp={onUp}
						onPointerLeave={onUp}
						onClick={(e) => e.target === e.currentTarget && setSelected(null)}
					>
						{/* Axis words at the edges, no chart chrome. */}
						<div className="pointer-events-none absolute inset-0 z-[45] text-xl font-bold text-white/25 md:text-3xl">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] rotate-180 md:left-4">{ax.negWord}</span>
							<span className="absolute right-3 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] md:right-4">{ax.posWord}</span>
							<span className="absolute left-1/2 top-2 -translate-x-1/2">{ay.posWord}</span>
							<span className="absolute bottom-2 left-1/2 -translate-x-1/2">{ay.negWord}</span>
							<div className="absolute inset-x-12 top-1/2 h-px bg-white/5" />
							<div className="absolute inset-y-12 left-1/2 w-px bg-white/5" />
						</div>

						{shown.map((it) => {
							const pos = positions.get(it.key)
							if (!pos) return null
							const sig = taste.signals[it.key]
							const rank = pickRank.get(it.key)
							const isPick = rank != null
							const scored = sig?.kind === "score" ? sig.score : null
							const gone = sig && sig.kind !== "score" && sig.kind !== "unseen"
							return (
								<motion.button
									key={it.key}
									type="button"
									aria-label={it.title}
									onClick={() => setSelected(it.key)}
									initial={false}
									animate={{ left: `${pos.x}%`, top: `${pos.y}%`, opacity: gone ? 0.12 : isPick ? 1 : scored ? 0.85 : 0.3, scale: selected === it.key ? 1.35 : isPick && rank < 8 ? 1.12 : 1 }}
									transition={{ type: "spring", stiffness: 120, damping: 20 }}
									whileHover={{ scale: 1.3, opacity: 1, zIndex: 60 }}
									className="absolute w-9 -translate-x-1/2 -translate-y-1/2 md:w-12"
									style={{ zIndex: selected === it.key ? 50 : isPick ? 40 - (rank as number) : scored ? 10 : 1 }}
								>
									<img
										src={posterUrl(it, "w185")}
										alt=""
										draggable="false"
										className={`aspect-[2/3] w-full rounded-[3px] object-cover ${isPick || scored ? "" : "grayscale"}`}
										style={{
											boxShadow: scored
												? `0 0 0 2px ${getVibeColorValue(scored as Score)}`
												: isPick
													? `0 0 0 1.5px rgba(251,191,36,.9), 0 0 ${rank < 8 ? 22 : 12}px rgba(245,158,11,${rank < 8 ? 0.7 : 0.4})`
													: undefined,
										}}
									/>
								</motion.button>
							)
						})}

						{/* The crosshair: you. */}
						<div
							role="slider"
							aria-label="Your taste. Drag to steer your picks."
							aria-valuetext={pulls.join(", ") || "Where your ratings put you"}
							aria-valuenow={Math.round(shownCross.x)}
							tabIndex={0}
							onPointerDown={(e) => {
								e.preventDefault()
								;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
								setSelected(null)
								setDrag(toPct(e))
							}}
							className="absolute z-[70] -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
							style={{ left: `${shownCross.x}%`, top: `${shownCross.y}%`, transition: drag ? "none" : "left .6s cubic-bezier(.2,.8,.2,1), top .6s cubic-bezier(.2,.8,.2,1)" }}
						>
							<div className="relative h-20 w-20">
								<div className="absolute inset-0 rounded-full border-2 border-amber-400/90 shadow-[0_0_30px_rgba(245,158,11,.45)]" />
								<div className="absolute inset-[34px] rounded-full bg-amber-400" />
								<div className="absolute left-1/2 top-[-14px] h-4 w-px bg-amber-400/80" />
								<div className="absolute bottom-[-14px] left-1/2 h-4 w-px bg-amber-400/80" />
								<div className="absolute left-[-14px] top-1/2 h-px w-4 bg-amber-400/80" />
								<div className="absolute right-[-14px] top-1/2 h-px w-4 bg-amber-400/80" />
								<span className="absolute left-1/2 top-full mt-4 -translate-x-1/2 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-black">You</span>
							</div>
						</div>

						{sel && selPos && (
							<div
								className="absolute z-[80] hidden md:block"
								style={{
									left: `${selPos.x}%`,
									top: `${selPos.y}%`,
									transform: `translate(${selPos.x > 60 ? "calc(-100% - 36px)" : "36px"}, ${selPos.y > 60 ? "-85%" : "-15%"})`,
								}}
							>
								{popover}
							</div>
						)}
					</div>

					<aside className="w-full lg:w-80">
						<h2 className="text-lg font-bold">Your picks from here</h2>
						<p className="text-sm text-gray-400">The glowing posters on the map.</p>
						<ol className="mt-3 flex flex-col gap-2">
							<AnimatePresence initial={false}>
								{picks.slice(0, 8).map((p, i) => (
									<motion.li key={p.item.key} layout transition={layoutSpring} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
										<button
											type="button"
											onClick={() => setSelected(p.item.key)}
											className="flex w-full items-center gap-3 rounded-lg bg-white/[.04] p-1.5 pr-3 text-left hover:bg-white/10"
										>
											<img src={posterUrl(p.item, "w185")} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-bold">{p.item.title}</span>
												<MatchText match={p.match} />
												<span className="block truncate text-xs text-gray-400">{reasonText(p)}</span>
											</span>
											<Moved delta={taste.moved(p.item.key, i)} />
										</button>
									</motion.li>
								))}
							</AnimatePresence>
						</ol>
					</aside>
				</div>
			</div>

			{/* Mobile: the popover docks above the bottom nav and switcher. */}
			{sel && <div className="fixed inset-x-0 bottom-32 z-[90] flex justify-center px-4 md:hidden">{popover}</div>}
		</div>
	)
}

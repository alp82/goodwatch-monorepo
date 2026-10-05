// PROTOTYPE - throwaway. Six compact takes on round 4's mood dial (#176, round 5). Each keeps what the dial
// allowed (a continuous mood, length, services, order, soft fit ranking) in at most about 80 px at rest.
// A variant returns the parts it adds to the page: a band above the hero, a sticky strip, something over
// the hero's backdrop, the hero's first line, or the hero's right column.
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, LayoutGroup, motion, useSpring } from "framer-motion"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { posterUrl } from "~/ui/prototype-rec-watch-next/model"
import type { Mood, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { ORDERS, type Sel } from "~/ui/prototype-rec-watch-next-4/select"
import { type Aside, type Ctx, DISPLAY, FitCount, type M, MoodName, MoodStack, OptsButton, Opts, Track, ViewLine, WRAP, mLabel } from "./kit5"
import { ANCHOR, HUE, LONG, NAME, type P, PATH, RADIUS, TRACK, along, coord, describe5, dist, hueAt, hueFor } from "./mood"

export type Parts = { above?: React.ReactNode; sticky?: React.ReactNode; top?: React.ReactNode; eyebrow?: React.ReactNode; aside?: Aside }
export type VariantFn = (c: Ctx, first: WTitle | undefined) => Parts

const EASE = [0.2, 0.7, 0.2, 1] as const
const moodColor = (m: M) => (m ? (m.s != null ? hueAt(m.s) : hueFor(m.p)) : "rgba(255,255,255,.55)")

// ============================================================ 1. Slider band

// A slim gradient track with the mood's name in large type beside it; the options sit on the same line.
function SliderBand({ c }: { c: Ctx }) {
	return (
		<div data-sel>
			<div className="hidden h-11 items-center gap-5 md:flex">
				<span className="w-[17rem] shrink-0">
					<MoodStack m={c.m} color={moodColor(c.m)} main={`${DISPLAY} text-[1.75rem] leading-[1.05]`} lean="text-sm font-semibold leading-tight" />
				</span>
				<Track m={c.m} setM={c.setM} thick={10} className="min-w-40 flex-1" />
				<FitCount c={c} className="w-12 shrink-0 text-sm" />
				<Opts c={c} id="slider" tone="solid" className="shrink-0 flex-nowrap" />
			</div>
			<div className="flex items-center gap-3 md:hidden">
				<span className="w-[6.5rem] shrink-0">
					<MoodStack m={c.m} color={moodColor(c.m)} main="text-sm font-bold leading-tight" lean="text-xs leading-tight" />
				</span>
				<Track m={c.m} setM={c.setM} thick={10} className="h-11 min-w-0 flex-1" />
				<OptsButton c={c} id="slider-m" />
			</div>
			<ViewLine c={c} className="mt-1" />
		</div>
	)
}
export const slider: VariantFn = (c) => ({ above: <SliderBand c={c} />, aside: "then" })

// ============================================================ 2. Knob in the hero's corner

const START = 225
const SWEEP = 270
const CONIC = `conic-gradient(from ${START}deg, ${PATH.map((m, i) => `${HUE[m]} ${(i * SWEEP) / 4}deg`).join(", ")}, transparent ${SWEEP}deg)`

// A round knob: turn it by dragging around its centre, or use the arrow keys. A tap without a turn opens it.
function Knob({ m, setM, size, onTap }: { m: M; setM: (m: M) => void; size: number; onTap?: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	const moved = useRef(0)
	const [drag, setDrag] = useState(false)
	const s = m?.s ?? null
	const rot = useSpring(START + (s ?? 0) * SWEEP, { stiffness: 260, damping: 24 })
	useEffect(() => rot.set(START + (s ?? 0) * SWEEP), [s])
	const put = (v: number | null) => setM(v == null ? null : { p: along(v), s: v })
	const at = (e: React.PointerEvent) => {
		const r = ref.current!.getBoundingClientRect()
		const a = (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI
		const k = (((a - START) % 360) + 360) % 360
		return k <= SWEEP ? k / SWEEP : k < SWEEP + 45 ? 1 : 0
	}
	const ring = Math.max(5, size / 10)
	return (
		<div
			ref={ref}
			role="slider"
			tabIndex={0}
			aria-label="Mood"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round((s ?? 0) * 100)}
			aria-valuetext={mLabel(m)}
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId)
				moved.current = 0
				setDrag(true)
			}}
			onPointerMove={(e) => {
				if (!drag) return
				moved.current += Math.abs(e.movementX) + Math.abs(e.movementY)
				if (moved.current > 6) put(at(e))
			}}
			onPointerUp={(e) => {
				setDrag(false)
				if (moved.current <= 6) (onTap ? onTap() : put(at(e)))
			}}
			onKeyDown={(e) => {
				if (e.key === "ArrowRight" || e.key === "ArrowUp") put(Math.min(1, (s ?? -0.05) + 0.05))
				else if (e.key === "ArrowLeft" || e.key === "ArrowDown") put(Math.max(0, (s ?? 0.05) - 0.05))
				else if (e.key === "Home" || e.key === "Delete") put(null)
				else if (e.key === "Enter" && onTap) onTap()
				else return
				e.preventDefault()
				e.stopPropagation()
			}}
			className="relative shrink-0 cursor-grab touch-none select-none rounded-full outline-none focus-visible:ring-4 focus-visible:ring-white/50 active:cursor-grabbing"
			style={{ width: size, height: size }}
		>
			<motion.div className="absolute inset-0 rounded-full shadow-[0_10px_30px_-8px_rgba(0,0,0,.9)]" style={{ background: CONIC, opacity: s == null ? 0.45 : 1 }} animate={{ scale: drag ? 1.06 : 1 }} transition={{ type: "spring", stiffness: 400, damping: 22 }} />
			<div className="absolute rounded-full bg-gray-900 ring-1 ring-white/10" style={{ inset: ring }} />
			<motion.div className="absolute inset-0" style={{ rotate: rot }}>
				<span className="absolute left-1/2 top-0 block -translate-x-1/2 rounded-full bg-white shadow" style={{ width: ring + 3, height: ring + 3, marginTop: -1.5 }} />
			</motion.div>
			<span className="absolute inset-0 flex items-center justify-center">
				<span className="rounded-full transition-colors duration-300" style={{ width: size * 0.26, height: size * 0.26, background: moodColor(m), boxShadow: m ? `0 0 ${size / 4}px ${moodColor(m)}` : "none" }} />
			</span>
		</div>
	)
}

function KnobCorner({ c }: { c: Ctx }) {
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const off = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => (window.removeEventListener("pointerdown", off), window.removeEventListener("keydown", esc))
	}, [open])
	const extras = [c.sel.length !== "any" ? c.sel.length : null, c.sel.services ? "on my services" : null, c.sel.by !== "mine" ? ORDERS.find((o) => o.key === c.sel.by)!.short : null].filter(Boolean).join(", ")
	return (
		<div ref={box} className="relative ml-auto flex shrink-0 items-center gap-3">
			<button type="button" onClick={() => setOpen(!open)} className="hidden min-w-0 cursor-pointer text-right sm:block" aria-expanded={open}>
				<span className="block text-base font-bold leading-tight md:text-lg" style={{ color: c.m ? moodColor(c.m) : "white" }}>
					<MoodName m={c.m} />
				</span>
				<span className="block truncate text-xs text-gray-300">{extras ? `${extras[0].toUpperCase()}${extras.slice(1)}` : c.m ? "" : "Turn to pick"}</span>
			</button>
			<Knob m={c.m} setM={c.setM} size={60} onTap={() => setOpen(!open)} />
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, scale: 0.6 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.6 }}
						transition={{ type: "spring", stiffness: 420, damping: 32 }}
						className="absolute right-0 top-0 z-50 w-[min(22rem,calc(100vw-2rem))] origin-top-right rounded-3xl bg-gray-900/95 p-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
					>
						<div className="flex items-start justify-between">
							<div>
								<p className={`${DISPLAY} text-2xl leading-tight`} style={{ color: moodColor(c.m) }}>
									<MoodName m={c.m} />
								</p>
								<p className="text-sm text-gray-400">
									<FitCount c={c} /> {c.m ? "on your Wishlist" : "Turn the knob or pick a mood"}
								</p>
							</div>
							<button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-1 -mt-1 cursor-pointer rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white">
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="relative mx-auto my-4 h-52 w-52">
							<div className="absolute inset-8">
								<Knob m={c.m} setM={c.setM} size={144} />
							</div>
							{PATH.map((mood, i) => {
								const a = ((START + (i * SWEEP) / 4 - 90) * Math.PI) / 180
								const on = c.m?.s != null && Math.abs(c.m.s - i / 4) < 0.07
								return (
									<button
										key={mood}
										type="button"
										onClick={() => c.setM({ p: ANCHOR[mood], s: i / 4 })}
										className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${on ? "text-black" : "bg-black/50 text-white/85 hover:text-white"}`}
										style={{ left: `${50 + Math.cos(a) * 50}%`, top: `${50 + Math.sin(a) * 50}%`, background: on ? HUE[mood] : undefined }}
									>
										{NAME[mood]}
									</button>
								)
							})}
							<button type="button" onClick={() => c.setM(null)} className={`absolute -bottom-3 left-1/2 -translate-x-1/2 cursor-pointer rounded-full px-3 py-1 text-xs font-bold ${c.m ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-black"}`}>
								Any mood
							</button>
						</div>
						<Opts c={c} id="knob" tone="solid" />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
export const knob: VariantFn = (c) => ({
	top: (
		<div data-sel className="flex items-start justify-between gap-3">
			<ViewLine c={c} className="min-w-0 flex-1 pt-3" />
			<KnobCorner c={c} />
		</div>
	),
	aside: "poster",
})

// ============================================================ 3. Mood pad in the poster's place

const pct = (p: P) => ({ left: `${((p.x + 1) / 2) * 100}%`, top: `${((1 - p.y) / 2) * 100}%` })
const PAD_BG = [...PATH.map((m) => `radial-gradient(circle at ${pct(ANCHOR[m]).left} ${pct(ANCHOR[m]).top}, ${HUE[m]}cc 0%, transparent 55%)`), "linear-gradient(#111827, #111827)"].join(", ")

// Two axes, light to dark and calm to intense. Every Wishlist title is a dot; the ones near your point light up.
function Pad({ c, first, shape }: { c: Ctx; first: WTitle | undefined; shape: "poster" | "strip" }) {
	const ref = useRef<HTMLDivElement>(null)
	const [drag, setDrag] = useState(false)
	const p = c.m?.p ?? null
	const put = (e: React.PointerEvent) => {
		const r = ref.current!.getBoundingClientRect()
		const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1))
		const y = Math.max(-1, Math.min(1, 1 - ((e.clientY - r.top) / r.height) * 2))
		c.setM({ p: { x, y }, s: null })
	}
	const nudge = (dx: number, dy: number) => {
		const b = p ?? { x: 0, y: 0 }
		c.setM({ p: { x: Math.max(-1, Math.min(1, b.x + dx)), y: Math.max(-1, Math.min(1, b.y + dy)) }, s: null })
	}
	const dots = c.q.order.slice(0, 400).map((k) => c.q.T(k)).filter((t): t is WTitle => !!t)
	const poster = shape === "poster"
	return (
		<div className={poster ? "hidden w-64 md:block lg:w-72" : "min-w-0 flex-1"}>
			<div
				ref={ref}
				role="slider"
				tabIndex={0}
				aria-label="Mood, light to dark and calm to intense"
				aria-valuetext={mLabel(c.m)}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId)
					setDrag(true)
					put(e)
				}}
				onPointerMove={(e) => drag && put(e)}
				onPointerUp={() => setDrag(false)}
				onPointerCancel={() => setDrag(false)}
				onKeyDown={(e) => {
					const d = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key]
					if (d) nudge(d[0], d[1])
					else if (e.key === "Home" || e.key === "Delete") c.setM(null)
					else return
					e.preventDefault()
					e.stopPropagation()
				}}
				className={`relative cursor-crosshair touch-none select-none overflow-hidden outline-none ring-1 ring-white/15 focus-visible:ring-4 focus-visible:ring-white/50 ${poster ? "aspect-[2/3] rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]" : "h-12 rounded-2xl"}`}
				style={{ background: PAD_BG }}
			>
				<div className={`absolute inset-0 bg-black transition-opacity duration-500 ${p ? "opacity-25" : "opacity-45"}`} />
				<div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
				<div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
				{dots.map((t) => {
					const on = p ? dist(coord(t), p) <= RADIUS : false
					return <span key={t.key} className={`absolute block -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-opacity duration-300 ${poster ? "h-1.5 w-1.5" : "h-1 w-1"}`} style={{ ...pct(coord(t)), opacity: p ? (on ? 0.95 : 0.14) : 0.4 }} />
				})}
				{poster &&
					PATH.map((m) => (
						<span key={m} className="pointer-events-none absolute whitespace-nowrap text-[11px] font-bold text-white/75 [text-shadow:0_1px_4px_#000]" style={{ ...pct(ANCHOR[m]), transform: `translate(${ANCHOR[m].x > 0.5 ? -88 : ANCHOR[m].x < -0.5 ? -12 : -50}%, -50%)` }}>
							{NAME[m]}
						</span>
					))}
				<span className={`pointer-events-none absolute font-semibold text-white/55 ${poster ? "left-2 top-1/2 -translate-y-1/2 text-[11px]" : "left-2 top-1/2 -translate-y-1/2 text-[10px]"}`}>Light</span>
				<span className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-semibold text-white/55 ${poster ? "text-[11px]" : "text-[10px]"}`}>Dark</span>
				{poster && <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[11px] font-semibold text-white/55">Intense</span>}
				{poster && <span className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white/55">Calm</span>}
				{p && (
					<motion.span
						className="pointer-events-none absolute rounded-[50%] border border-white/60 bg-white/5"
						initial={false}
						animate={{ left: pct(p).left, top: pct(p).top, scale: drag ? 1.05 : 1 }}
						transition={drag ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
						style={{ width: `${RADIUS * 100}%`, height: `${RADIUS * 100}%`, x: "-50%", y: "-50%" }}
					/>
				)}
				<motion.span
					className="pointer-events-none absolute block"
					initial={false}
					animate={{ ...pct(p ?? { x: 0, y: 0 }), scale: drag ? 1.15 : 1 }}
					transition={drag ? { duration: 0, scale: { type: "spring", stiffness: 500, damping: 25 } } : { type: "spring", stiffness: 300, damping: 30 }}
					style={{ x: "-50%", y: "-50%" }}
				>
					{poster && first && p ? (
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.img key={first.key} src={posterUrl(first, "w92")} alt="" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="block w-11 rounded-md shadow-[0_6px_20px_rgba(0,0,0,.8)] ring-2 ring-white" />
						</AnimatePresence>
					) : (
						<span className={`block rounded-full border-[3px] border-white shadow-[0_4px_14px_rgba(0,0,0,.7)] ${poster ? "h-7 w-7" : "h-6 w-6"} ${p ? "" : "border-dashed bg-white/10"}`} style={{ background: p ? hueFor(p) : undefined }} />
					)}
				</motion.span>
				{poster && (
					<div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
						<div className="min-w-0">
							<p className="truncate text-base font-bold leading-tight text-white">
								<MoodName m={c.m} any="Drag to set a mood" />
							</p>
							<p className="text-xs text-gray-300">{p ? <FitCount c={c} /> : "Light to dark, calm to intense"}</p>
						</div>
						{p && (
							<button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => c.setM(null)} className="pointer-events-auto shrink-0 cursor-pointer rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/25">
								Any mood
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
export const pad: VariantFn = (c, first) => ({
	top: (
		<div data-sel>
			<div className="hidden items-center justify-between gap-4 md:flex">
				<ViewLine c={c} className="min-w-0 flex-1" />
				<Opts c={c} id="pad" className="ml-auto shrink-0" />
			</div>
			<div className="flex items-center gap-3 md:hidden">
				<Pad c={c} first={first} shape="strip" />
				<OptsButton c={c} id="pad-m" />
			</div>
			<ViewLine c={c} className="mt-2 md:hidden" />
		</div>
	),
	aside: <Pad c={c} first={first} shape="poster" />,
})

// ============================================================ 4. Swatches that blend

// Pick one mood, or two to blend them; a short track between the two sets how much of each.
function Swatches({ c }: { c: Ctx }) {
	const [picks, setPicks] = useState<Mood[]>([])
	const [w, setW] = useState(0.5)
	const emit = (ps: Mood[], k: number) => {
		if (!ps.length) return c.setM(null)
		if (ps.length === 1) return c.setM({ p: ANCHOR[ps[0]], s: null, name: LONG[ps[0]] })
		const [a, b] = ps
		const p = { x: ANCHOR[a].x + (ANCHOR[b].x - ANCHOR[a].x) * k, y: ANCHOR[a].y + (ANCHOR[b].y - ANCHOR[a].y) * k }
		const name = k < 0.2 ? LONG[a] : k > 0.8 ? LONG[b] : Math.abs(k - 0.5) < 0.12 ? `${NAME[a]} and ${NAME[b].toLowerCase()}` : k < 0.5 ? `${NAME[a]}, a little ${NAME[b].toLowerCase()}` : `${NAME[b]}, a little ${NAME[a].toLowerCase()}`
		c.setM({ p, s: null, name })
	}
	// Mirror a reset from outside ("Back to my order").
	useEffect(() => {
		if (!c.m && picks.length) setPicks([])
	}, [c.m])
	const tap = (m: Mood) => {
		const ps = (picks.includes(m) ? picks.filter((x) => x !== m) : [...picks, m].slice(-2)).sort((a, b) => PATH.indexOf(a) - PATH.indexOf(b))
		setPicks(ps)
		setW(0.5)
		emit(ps, 0.5)
	}
	const blend = picks.length === 2
	const track = useRef<HTMLDivElement>(null)
	const [drag, setDrag] = useState(false)
	const at = (x: number) => {
		const r = track.current!.getBoundingClientRect()
		return Math.max(0, Math.min(1, (x - r.left) / r.width))
	}
	return (
		<LayoutGroup>
			<div className="flex min-w-0 items-center gap-2" role="group" aria-label="Mood">
				{PATH.map((m) => {
					const on = picks.includes(m)
					return (
						<motion.button
							layout
							key={m}
							type="button"
							aria-pressed={on}
							aria-label={LONG[m]}
							onClick={() => tap(m)}
							transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
							className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full pl-1.5 text-sm font-semibold transition-colors duration-200 max-md:w-10 max-md:justify-center max-md:pl-0 md:pr-4 ${on ? "text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
							style={{ background: on ? HUE[m] : undefined, order: on ? picks.indexOf(m) * 2 : 3 }}
							whileTap={{ scale: 0.94 }}
						>
							<span className={`block h-7 w-7 rounded-full ring-2 ${on ? "ring-black/25" : "ring-white/10"}`} style={{ background: HUE[m] }} />
							<span className="hidden md:inline">{NAME[m]}</span>
						</motion.button>
					)
				})}
				<AnimatePresence initial={false}>
					{blend && (
						<motion.div
							layout
							key="blend"
							initial={{ opacity: 0, width: 0 }}
							animate={{ opacity: 1, width: "auto" }}
							exit={{ opacity: 0, width: 0 }}
							transition={{ duration: 0.25, ease: EASE }}
							className="shrink-0 overflow-hidden"
							style={{ order: 1 }}
						>
							<div
								ref={track}
								role="slider"
								tabIndex={0}
								aria-label="Blend"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={Math.round(w * 100)}
								onPointerDown={(e) => {
									e.currentTarget.setPointerCapture(e.pointerId)
									setDrag(true)
									const k = at(e.clientX)
									setW(k)
									emit(picks, k)
								}}
								onPointerMove={(e) => {
									if (!drag) return
									const k = at(e.clientX)
									setW(k)
									emit(picks, k)
								}}
								onPointerUp={() => setDrag(false)}
								onKeyDown={(e) => {
									const d = e.key === "ArrowRight" ? 0.1 : e.key === "ArrowLeft" ? -0.1 : 0
									if (!d) return
									e.preventDefault()
									e.stopPropagation()
									const k = Math.max(0, Math.min(1, w + d))
									setW(k)
									emit(picks, k)
								}}
								className="relative mx-1 flex h-10 w-24 cursor-pointer touch-none items-center outline-none md:w-32"
							>
								<div className="h-2.5 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${HUE[picks[0]]}, ${HUE[picks[1]]})` }} />
								<motion.span className="absolute top-1/2 block h-5 w-5 rounded-full border-[3px] border-white bg-gray-900 shadow" initial={false} animate={{ left: `${w * 100}%`, x: "-50%", y: "-50%", scale: drag ? 1.2 : 1 }} transition={drag ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }} />
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</LayoutGroup>
	)
}
function SwatchBand({ c }: { c: Ctx }) {
	return (
		<div data-sel>
			<div className="flex items-center gap-3">
				<div className="-ml-4 min-w-0 flex-1 overflow-x-auto pl-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0">
					<Swatches c={c} />
				</div>
				<OptsButton c={c} id="sw-m" className="md:hidden" />
			</div>
			<div className="mt-1 flex items-center justify-between gap-4">
				<ViewLine c={c} className="min-w-0 flex-1" />
				<Opts c={c} id="sw" tone="solid" className="ml-auto hidden shrink-0 flex-nowrap md:flex" />
			</div>
		</div>
	)
}
export const swatches: VariantFn = (c) => ({ above: <SwatchBand c={c} />, aside: "then" })

// ============================================================ 5. Strip under the header, folds on scroll

function Strip({ c }: { c: Ctx }) {
	const [folded, setFolded] = useState(false)
	const opened = useRef<number | null>(null)
	useEffect(() => {
		const on = () => {
			const y = window.scrollY
			if (opened.current != null && Math.abs(y - opened.current) < 240) return
			opened.current = null
			setFolded(y > 160)
		}
		on()
		window.addEventListener("scroll", on, { passive: true })
		return () => window.removeEventListener("scroll", on)
	}, [])
	const summary = describe5(c.sel, c.m?.p ?? null, c.m?.name)
	return (
		<motion.div data-sel className="sticky top-16 z-40 border-b border-white/10 bg-gray-900/85 backdrop-blur-md" initial={false} animate={{ height: folded ? 40 : 48 }} transition={{ duration: 0.25, ease: EASE }}>
			<div className={`${WRAP} relative h-full`}>
				<AnimatePresence mode="wait" initial={false}>
					{folded ? (
						<motion.button
							key="folded"
							type="button"
							initial={{ opacity: 0, y: -6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 0.18 }}
							onClick={() => {
								opened.current = window.scrollY
								setFolded(false)
							}}
							className="flex h-full w-full cursor-pointer items-center gap-2.5 text-left text-sm"
						>
							<span className="h-3 w-3 shrink-0 rounded-full" style={{ background: moodColor(c.m) }} />
							<span className="min-w-0 truncate font-semibold text-white">{summary[0].toUpperCase() + summary.slice(1)}</span>
							{c.n > 0 && (c.m || c.sel.services || c.sel.length !== "any") && <span className="shrink-0 text-gray-400">{c.n} fit</span>}
							<ChevronUpDownIcon className="ml-auto h-5 w-5 shrink-0 text-gray-400" />
						</motion.button>
					) : (
						<motion.div key="open" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }} className="flex h-full items-center gap-4">
							<span className="w-28 shrink-0 md:w-48">
								<MoodStack m={c.m} color={moodColor(c.m)} main="text-sm font-bold leading-tight md:text-base" lean="text-xs leading-tight" />
							</span>
							<Track m={c.m} setM={c.setM} thick={6} className="min-w-0 flex-1 md:max-w-80" />
							<FitCount c={c} className="hidden w-12 shrink-0 text-sm md:block" />
							<Opts c={c} id="strip" tone="solid" className="hidden shrink-0 flex-nowrap md:ml-auto lg:flex" />
							<OptsButton c={c} id="strip-m" className="lg:hidden md:ml-auto" />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</motion.div>
	)
}
export const strip: VariantFn = (c) => ({
	sticky: (
		<>
			<Strip c={c} />
			<div data-sel className={WRAP}>
				<ViewLine c={c} />
			</div>
		</>
	),
	aside: "then",
})

// ============================================================ 6. Mood in the hero's first line

// "In the mood for Comfort watch": drag the mood sideways to scrub, or step with the arrows. The options
// read as the rest of the sentence.
function Scrub({ c }: { c: Ctx }) {
	const start = useRef<{ x: number; s: number; moved: number } | null>(null)
	const [drag, setDrag] = useState(false)
	const s = c.m?.s ?? null
	const put = (v: number | null) => c.setM(v == null ? null : { p: along(v), s: v })
	const step = (d: 1 | -1) => {
		if (s == null) return put(d === 1 ? 0 : 1)
		const stops = [0, 0.25, 0.5, 0.75, 1]
		const next = d === 1 ? stops.find((x) => x > s + 0.01) : [...stops].reverse().find((x) => x < s - 0.01)
		put(next ?? null)
	}
	const color = moodColor(c.m)
	return (
		<span className="inline-flex min-w-0 items-center gap-0.5">
			<button type="button" onClick={() => step(-1)} aria-label="Previous mood" className="flex h-9 w-8 md:hidden shrink-0 cursor-pointer items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
				<ChevronLeftIcon className="h-5 w-5" />
			</button>
			<span
				role="slider"
				tabIndex={0}
				aria-label="Mood"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round((s ?? 0) * 100)}
				aria-valuetext={mLabel(c.m, "anything")}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId)
					start.current = { x: e.clientX, s: s ?? 0, moved: 0 }
					setDrag(true)
				}}
				onPointerMove={(e) => {
					const st = start.current
					if (!st) return
					st.moved = Math.abs(e.clientX - st.x)
					if (st.moved > 5) put(Math.max(0, Math.min(1, st.s + (e.clientX - st.x) / 320)))
				}}
				onPointerUp={() => {
					if (start.current && start.current.moved <= 5) step(1)
					start.current = null
					setDrag(false)
				}}
				onKeyDown={(e) => {
					if (e.key === "ArrowRight" || e.key === "ArrowUp") put(Math.min(1, (s ?? -0.05) + 0.05))
					else if (e.key === "ArrowLeft" || e.key === "ArrowDown") put(Math.max(0, (s ?? 0.05) - 0.05))
					else if (e.key === "Home" || e.key === "Delete") put(null)
					else return
					e.preventDefault()
					e.stopPropagation()
				}}
				title="Drag sideways, or click for the next mood"
				className={`${DISPLAY} relative min-w-0 cursor-ew-resize [text-shadow:0_2px_14px_rgba(0,0,0,.85)] touch-none select-none whitespace-nowrap pb-1 text-2xl leading-tight outline-none focus-visible:rounded focus-visible:bg-white/10 md:text-[2rem]`}
				style={{ color }}
			>
				<MoodName m={c.m} any="anything" />
				<span className="absolute inset-x-0 bottom-0 block h-[3px] rounded-full opacity-50" style={{ background: TRACK }} />
				<motion.span className="absolute bottom-0 block h-2 w-2 rounded-full bg-white" initial={false} animate={{ left: `${(s ?? 0) * 100}%`, x: "-50%", y: "25%", opacity: s == null ? 0 : 1, scale: drag ? 1.5 : 1 }} transition={drag ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }} />
			</span>
			<button type="button" onClick={() => step(1)} aria-label="Next mood" className="flex h-9 w-8 md:hidden shrink-0 cursor-pointer items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
				<ChevronRightIcon className="h-5 w-5" />
			</button>
		</span>
	)
}

// A word in the sentence that cycles through its options.
function Word<T extends string | boolean>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
	const i = Math.max(0, options.findIndex(([k]) => k === value))
	const on = i !== 0
	return (
		<button
			type="button"
			aria-label={`${label}: ${options[i][1]}`}
			onClick={() => onChange(options[(i + 1) % options.length][0])}
			className={`relative cursor-pointer whitespace-nowrap border-b-2 leading-tight transition-colors ${on ? "border-amber-400 text-white" : "border-dotted border-white/35 text-white/65 hover:text-white"}`}
		>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span key={options[i][1]} className="inline-block" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
					{options[i][1]}
				</motion.span>
			</AnimatePresence>
		</button>
	)
}

function TitleLine({ c }: { c: Ctx }) {
	const { sel, setSel } = c
	return (
		<div data-sel className="mb-5 [text-shadow:0_2px_12px_rgba(0,0,0,.7)]">
			<div className="flex min-w-0 items-center gap-2 md:flex-wrap md:gap-x-0 md:gap-y-1">
				<span className="hidden text-lg font-semibold text-white/70 sm:inline md:mr-3 md:text-xl">In the mood for</span>
				<Scrub c={c} />
				<span className="hidden items-baseline text-lg font-semibold text-white/60 md:flex md:text-xl">
					,&nbsp;
					<Word<Sel["length"]> label="Length" value={sel.length} onChange={(v) => setSel({ ...sel, length: v })} options={[["any", "any length"], ["short", "short"], ["long", "long"]]} />
					,&nbsp;
					<Word<boolean> label="Where" value={sel.services} onChange={(v) => setSel({ ...sel, services: v })} options={[[false, "anywhere"], [true, "on my services"]]} />
					,&nbsp;
					<Word<Sel["by"]> label="Order" value={sel.by} onChange={(v) => setSel({ ...sel, by: v })} options={ORDERS.map((o) => [o.key, o.key === "mine" ? "in my order" : o.short] as [Sel["by"], string])} />
				</span>
				<OptsButton c={c} id="title-m" className="ml-auto md:hidden" align="right" />
			</div>
			<ViewLine c={c} className="mt-1" />
		</div>
	)
}
export const title: VariantFn = (c) => ({ eyebrow: <TitleLine c={c} />, aside: "then" })

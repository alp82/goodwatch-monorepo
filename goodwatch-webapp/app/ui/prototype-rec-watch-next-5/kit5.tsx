// PROTOTYPE - throwaway. Shared pieces for round 5 of Watch next (#176): the start hero (with the "Then"
// column back, or the poster, or any control in that slot), the line that says whether you see a view or
// your saved order, a slim continuous mood track, and the compact length / services / order options.
import { AdjustmentsHorizontalIcon, CheckIcon, ChevronDownIcon, PlayIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ServiceTiles, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { DISPLAY, WRAP, WantButton } from "~/ui/prototype-rec-watch-next-3/kit3"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import { ANY, type By, ORDERS, type Sel, type View, adopt } from "~/ui/prototype-rec-watch-next-4/select"
import { type P, TRACK, along as alongP, describe5, hueAt, isPlain, label, labelParts } from "./mood"

export { DISPLAY, WRAP }

// The mood a control holds: a point in mood space, and where it sits along the path for one-axis controls.
export type M = { p: P; s: number | null; name?: string } | null
export const mLabel = (m: M, any = "Any mood") => (m ? (m.name ?? label(m.p)) : any)

export type Ctx = {
	q: Queue
	v: View
	sel: Sel
	setSel: (s: Sel) => void
	m: M
	setM: (m: M) => void
	// Live count of Wishlist titles that fit everything, for the mood as it is right now.
	n: number
	reset: () => void
}

const EASE = [0.2, 0.7, 0.2, 1] as const
const SWAP = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { duration: 0.3, ease: EASE } } as const

// ------------------------------------------------------------------ hero

function PlayButton({ t }: { t: WTitle }) {
	const w = watchLine(t)
	if (!w.offer) return null
	return (
		<a
			href={`#play-${t.key}`}
			onClick={(e) => e.preventDefault()}
			className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200"
		>
			<img src={w.offer.logo} alt="" className="h-8 w-8 rounded-md" />
			<PlayIcon className="h-5 w-5" />
			{w.owned ? `Play on ${w.offer.name}` : `Open ${w.offer.name}`}
		</a>
	)
}

export type Aside = "then" | "poster" | React.ReactNode

// The start hero, fed by the view. `top` sits over the backdrop above the title; `eyebrow` replaces the
// "Watch next" line; `aside` is the right column: the Then list, the poster, or a control.
export function Hero5({
	c,
	onPeek,
	onPass,
	top,
	eyebrow,
	aside = "poster",
	offer,
}: { c: Ctx; onPeek: (t: WTitle) => void; onPass: (k: string) => void; top?: React.ReactNode; eyebrow?: React.ReactNode; aside?: Aside; offer?: WTitle }) {
	const { q, v, sel, m } = c
	const first = v.keys[0] ? q.T(v.keys[0]) : undefined
	const stage = first ?? offer
	const plain = isPlain(sel, m?.p ?? null)
	const saved = first ? q.pos(first.key) : 0
	const fitsAll = first && v.need ? v.fit.get(first.key) === v.need : true
	return (
		<section className="relative isolate overflow-hidden" aria-label="Your next watch">
			<AnimatePresence mode="popLayout" initial={false}>
				{stage && (
					<motion.img
						key={stage.key}
						src={backdropUrl(stage, "original")}
						alt=""
						initial={{ opacity: 0, scale: 1.06 }}
						animate={{ opacity: first ? 1 : 0.5, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.9, ease: EASE }}
						className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
					/>
				)}
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-gradient-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
			<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-gray-900 to-transparent" />
			{top && <div className="absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-gray-900/90 to-transparent" />}
			{top && <div className={`${WRAP} relative z-20 pt-4 md:pt-6`}>{top}</div>}

			<div className={`${WRAP} grid items-end gap-6 pb-8 md:grid-cols-[1fr_auto] md:items-center md:gap-10 ${top ? "min-h-[30rem] pt-24 md:min-h-[36rem] md:pt-6" : "min-h-[34rem] pt-40 md:min-h-[40rem] md:pt-10"}`}>
				<div className="min-w-0">
					{eyebrow}
					<AnimatePresence mode="wait" initial={false}>
						{first ? (
							<motion.div key={first.key} {...SWAP} className="min-w-0 max-w-2xl">
								{!eyebrow && (
									<p className="flex flex-wrap items-baseline gap-x-3 text-sm font-semibold">
										<span className="text-amber-300">{plain ? "Watch next" : fitsAll ? "Top of this view" : "Closest to this view"}</span>
										{!plain && saved > 0 && <span className="text-gray-300">#{saved} in your saved order</span>}
									</p>
								)}
								<button type="button" onClick={() => onPeek(first)} className="block cursor-pointer text-left">
									<h1 className={`${DISPLAY} mt-1 leading-[0.9] text-white ${first.title.length > 22 ? "text-4xl md:text-6xl lg:text-7xl" : "text-5xl md:text-7xl lg:text-[7rem]"}`}>{first.title}</h1>
								</button>
								<p className="mt-3 text-base text-gray-200 md:text-lg">{first.tagline || first.genres.join(", ")}</p>
								<p className="mt-1 text-sm text-gray-400">
									{[first.year, runtimeLabel(first), first.match ? `${first.match}% taste match` : null, first.leavingInDays != null ? `Leaves in ${first.leavingInDays} days` : null].filter(Boolean).join(", ")}
								</p>
								<div className="mt-5">
									<ServiceTiles title={first} size={44} max={3} names />
								</div>
								<div className="mt-6 flex flex-wrap items-center gap-2">
									<PlayButton t={first} />
									<button type="button" onClick={() => q.watched(first.key)} className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20">
										<CheckIcon className="h-5 w-5 text-green-400" />I watched it
									</button>
									{v.keys.length > 1 && (
										<button type="button" onClick={() => onPass(first.key)} className="inline-flex h-12 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10">
											Not tonight
										</button>
									)}
								</div>
							</motion.div>
						) : (
							<motion.div key={`none-${offer?.key ?? ""}`} {...SWAP} className="min-w-0 max-w-2xl">
								<p className="text-sm font-semibold text-amber-300">Your Wishlist is empty</p>
								{offer ? (
									<>
										<button type="button" onClick={() => onPeek(offer)} className="block cursor-pointer text-left">
											<h1 className={`${DISPLAY} mt-1 text-5xl leading-[0.9] text-white md:text-7xl`}>{offer.title}</h1>
										</button>
										<p className="mt-3 text-base text-gray-200 md:text-lg">
											Start with this? {offer.match ? `${offer.match}% taste match. ` : ""}
											{runtimeLabel(offer)}.
										</p>
										<div className="mt-5">
											<ServiceTiles title={offer} size={44} max={3} names />
										</div>
										<div className="mt-6 flex flex-wrap gap-2">
											<WantButton q={q} t={offer} size="lg" />
										</div>
									</>
								) : (
									<h1 className={`${DISPLAY} mt-1 text-5xl leading-[0.9] text-white md:text-6xl`}>Nothing here yet</h1>
								)}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
				{aside === "then" ? (
					<Then c={c} onPeek={onPeek} />
				) : aside === "poster" ? (
					<AnimatePresence mode="wait" initial={false}>
						{stage && (
							<motion.button
								type="button"
								key={stage.key}
								onClick={() => onPeek(stage)}
								initial={{ opacity: 0, y: 24, rotate: 2 }}
								animate={{ opacity: first ? 1 : 0.8, y: 0, rotate: 0 }}
								exit={{ opacity: 0, y: -24 }}
								transition={{ duration: 0.35, ease: EASE }}
								className="hidden w-64 cursor-pointer md:block lg:w-72"
								aria-label={`${stage.title} details`}
							>
								<img src={posterUrl(stage, "w500")} alt="" className="w-full rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10" />
							</motion.button>
						)}
					</AnimatePresence>
				) : (
					aside
				)}
			</div>
		</section>
	)
}

export const THEN = 3

// The next three in this view, as in the start hero the owner kept from round 1.
function Then({ c, onPeek }: { c: Ctx; onPeek: (t: WTitle) => void }) {
	const { q, v } = c
	const rest = v.keys.slice(1, 1 + THEN).map(q.T).filter((t): t is WTitle => !!t)
	if (!rest.length) return null
	return (
		<div className="min-w-0">
			<p className="mb-2 text-sm font-semibold text-gray-300">Then</p>
			<ol className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-[20rem] md:flex-col md:overflow-visible md:px-0">
				<AnimatePresence mode="popLayout" initial={false}>
					{rest.map((t, i) => (
						<motion.li
							key={t.key}
							layout
							initial={{ opacity: 0, x: 24 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -24 }}
							transition={{ duration: 0.3, delay: i * 0.05, ease: EASE }}
							className="w-28 shrink-0 md:w-auto"
						>
							<button type="button" onClick={() => onPeek(t)} className="flex w-full cursor-pointer flex-col gap-2 rounded-lg bg-black/50 p-1.5 text-left backdrop-blur-md hover:bg-black/70 md:flex-row md:items-center md:gap-3">
								<span className="relative block shrink-0">
									<img src={posterUrl(t, "w185")} alt="" className="aspect-[2/3] w-full rounded-md object-cover md:h-24 md:w-16" />
									<span className={`${DISPLAY} absolute -bottom-1 left-1 text-3xl text-white [text-shadow:0_2px_8px_#000]`}>{i + 2}</span>
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-bold text-white">{t.title}</span>
									<span className="block truncate text-xs text-gray-400">{watchLine(t).text}</span>
									<span className="hidden truncate text-xs text-gray-500 md:block">{runtimeLabel(t)}</span>
								</span>
							</button>
						</motion.li>
					))}
				</AnimatePresence>
			</ol>
		</div>
	)
}

// ------------------------------------------------------------------ view or saved order

// One short line: your saved order, or "Just a view" with the two ways out. `short` drops the description
// for places where the control already shows it.
export function ViewLine({ c, className = "", short = false }: { c: Ctx; className?: string; short?: boolean }) {
	const { q, v, sel, m } = c
	if (q.count < 2) return null
	const plain = isPlain(sel, m?.p ?? null)
	const changes = v.keys.slice(0, 12).some((k, i) => q.order[i] !== k)
	const use = () => {
		const first = q.T(v.keys[0])
		q.setOrder(adopt(q, v), `Saved as your order. ${first?.title ?? "The top title"} is #1 on your Wishlist.`)
		c.reset()
	}
	return (
		<div className={`flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm ${className}`} role="status" data-viewline>
			{plain ? (
				<p className="text-gray-300">
					Your saved order, {q.count} titles.<span className="hidden text-gray-400 sm:inline"> Pick a mood; your order stays as it is.</span>
				</p>
			) : (
				<>
					<p className="min-w-0 truncate text-gray-200">
						<span className="font-semibold text-white">Just a view</span>
						{short ? "" : <span className="hidden sm:inline">: {describe5(sel, m?.p ?? null, m?.name)}</span>}.<span className="hidden text-gray-400 lg:inline"> Your saved order stays.</span>
					</p>
					<span className="flex shrink-0 gap-1.5">
						{changes && v.keys.length > 0 && (
							<button type="button" onClick={use} className="h-8 cursor-pointer rounded-md bg-amber-400 px-3 text-sm font-bold text-black hover:bg-amber-300" title="Save this view as your Wishlist order">
								Use this order
							</button>
						)}
						<button type="button" onClick={c.reset} className="h-8 cursor-pointer rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20">
							Back to my order
						</button>
					</span>
				</>
			)}
		</div>
	)
}

// ------------------------------------------------------------------ continuous mood track

// A slim track you drag along the five moods. Null means any mood: the track dims and the thumb waits
// at the start. Arrow keys nudge it, Home clears it.
export function Track({ m, setM, className = "", thick = 8, onDrag }: { m: M; setM: (m: M) => void; className?: string; thick?: number; onDrag?: (on: boolean) => void }) {
	const ref = useRef<HTMLDivElement>(null)
	const [drag, setDrag] = useState(false)
	const s = m?.s ?? null
	const at = (x: number) => {
		const r = ref.current!.getBoundingClientRect()
		return Math.max(0, Math.min(1, (x - r.left) / r.width))
	}
	const put = (v: number | null) => setM(v == null ? null : { p: alongP(v), s: v })
	const hue = s == null ? "#9ca3af" : hueAt(s)
	return (
		<div
			ref={ref}
			role="slider"
			tabIndex={0}
			aria-label="Mood"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={s == null ? 0 : Math.round(s * 100)}
			aria-valuetext={mLabel(m)}
			onPointerDown={(e) => {
				e.currentTarget.setPointerCapture(e.pointerId)
				setDrag(true)
				onDrag?.(true)
				put(at(e.clientX))
			}}
			onPointerMove={(e) => drag && put(at(e.clientX))}
			onPointerUp={() => (setDrag(false), onDrag?.(false))}
			onPointerCancel={() => (setDrag(false), onDrag?.(false))}
			onKeyDown={(e) => {
				if (e.key === "ArrowRight" || e.key === "ArrowUp") put(Math.min(1, (s ?? -0.05) + 0.05))
				else if (e.key === "ArrowLeft" || e.key === "ArrowDown") put(Math.max(0, (s ?? 0.05) - 0.05))
				else if (e.key === "Home" || e.key === "Escape") put(null)
				else return
				e.preventDefault()
				e.stopPropagation()
			}}
			className={`group relative flex h-10 cursor-pointer touch-none select-none items-center outline-none ${className}`}
		>
			<div className="relative w-full rounded-full transition-opacity duration-300" style={{ height: thick, background: TRACK, opacity: s == null ? 0.35 : 1 }}>
				{[0.25, 0.5, 0.75].map((k) => (
					<span key={k} className="absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/40" style={{ left: `${k * 100}%` }} />
				))}
			</div>
			<motion.span
				className="pointer-events-none absolute top-1/2 block h-6 w-6 rounded-full border-[3px] border-white group-focus-visible:ring-4 group-focus-visible:ring-white/40"
				style={{ background: hue, boxShadow: s == null ? "0 2px 8px rgba(0,0,0,.6)" : `0 0 0 6px ${hue}33, 0 4px 14px rgba(0,0,0,.6)` }}
				initial={false}
				animate={{ left: `${(s ?? 0) * 100}%`, x: "-50%", y: "-50%", scale: drag ? 1.25 : 1 }}
				transition={drag ? { left: { duration: 0 }, scale: { type: "spring", stiffness: 500, damping: 26 } } : { type: "spring", stiffness: 380, damping: 30 }}
			/>
		</div>
	)
}

// The mood's name, crossfading as it changes.
export function MoodName({ m, className = "", any = "Any mood" }: { m: M; className?: string; any?: string }) {
	const text = mLabel(m, any)
	return (
		<span className={`relative inline-grid ${className}`}>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={text}
					initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
					transition={{ duration: 0.22, ease: EASE }}
					className="col-start-1 row-start-1 whitespace-nowrap"
				>
					{text}
				</motion.span>
			</AnimatePresence>
		</span>
	)
}

// The mood's name over its lean, for one-axis controls: "Comfort" over "leaning escape".
export function MoodStack({ m, main = "", lean = "", color }: { m: M; main?: string; lean?: string; color: string }) {
	const x = labelParts(m?.p ?? null)
	return (
		<span className="relative grid min-w-0">
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={x.main + (x.lean ?? "")}
					initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
					transition={{ duration: 0.22, ease: EASE }}
					className="col-start-1 row-start-1 flex min-w-0 flex-col justify-center"
				>
					<span className={`block truncate transition-colors duration-300 ${main}`} style={{ color }}>
						{x.main}
					</span>
					{x.lean && <span className={`block truncate text-gray-300 ${lean}`}>{x.lean}</span>}
				</motion.span>
			</AnimatePresence>
		</span>
	)
}

// "42 fit", counting up and down with the mood.
export function FitCount({ c, className = "" }: { c: Ctx; className?: string }) {
	if (!c.m && c.sel.length === "any" && !c.sel.services) return null
	return (
		<span className={`tabular-nums text-gray-400 ${className}`}>
			<motion.span key={c.n} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="font-semibold text-white">
				{c.n}
			</motion.span>{" "}
			fit
		</span>
	)
}

// ------------------------------------------------------------------ length, services, order

const LEN: [Sel["length"], string][] = [
	["any", "Any length"],
	["short", "Short"],
	["long", "Long"],
]

// Length as a segmented control, services as a toggle, order as a menu. `id` keeps the sliding
// highlight separate when two copies are on the page.
export function Opts({ c, id, tone = "glass", className = "" }: { c: Ctx; id: string; tone?: "glass" | "solid"; className?: string }) {
	const { sel, setSel } = c
	const base = tone === "glass" ? "bg-black/45 backdrop-blur-md ring-1 ring-white/10" : "bg-white/10"
	return (
		<div className={`flex flex-wrap items-center gap-2 ${className}`}>
			<div className={`inline-flex h-9 items-center rounded-full p-1 ${base}`} role="radiogroup" aria-label="Length">
				{LEN.map(([k, l]) => (
					<button key={k} type="button" role="radio" aria-checked={sel.length === k} onClick={() => setSel({ ...sel, length: k })} className={`relative h-7 cursor-pointer whitespace-nowrap rounded-full px-3 text-sm font-semibold ${sel.length === k ? "text-black" : "text-gray-200 hover:text-white"}`}>
						{sel.length === k && <motion.span layoutId={`len-${id}`} className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
						<span className="relative">{l}</span>
					</button>
				))}
			</div>
			<button
				type="button"
				aria-pressed={sel.services}
				onClick={() => setSel({ ...sel, services: !sel.services })}
				className={`inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors ${sel.services ? "bg-white text-black" : `${base} text-gray-100 hover:text-white`}`}
			>
				<AnimatePresence initial={false}>
					{sel.services && (
						<motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 16, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="inline-flex overflow-hidden">
							<CheckIcon className="h-4 w-4 shrink-0" />
						</motion.span>
					)}
				</AnimatePresence>
				On my services
			</button>
			<OrderPick c={c} base={base} />
		</div>
	)
}

export function OrderPick({ c, base = "bg-white/10", className = "" }: { c: Ctx; base?: string; className?: string }) {
	const { sel, setSel } = c
	const on = sel.by !== "mine"
	return (
		<span className={`relative inline-flex shrink-0 ${className}`}>
			<select
				aria-label="Order"
				value={sel.by}
				onChange={(e) => setSel({ ...sel, by: e.target.value as By })}
				className={`field-sizing-content h-9 cursor-pointer appearance-none rounded-full pl-3.5 pr-8 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white ${on ? "bg-white text-black" : `${base} text-gray-100`}`}
			>
				{ORDERS.map((o) => (
					<option key={o.key} value={o.key} className="bg-gray-900 text-white">
						{o.label}
					</option>
				))}
			</select>
			<ChevronDownIcon className={`pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${on ? "text-black" : "text-gray-400"}`} />
		</span>
	)
}

// On a phone the options fold into one button with a count; it opens a small panel under it.
export function OptsButton({ c, id, className = "", align = "right" }: { c: Ctx; id: string; className?: string; align?: "left" | "right" }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const n = (c.sel.length !== "any" ? 1 : 0) + (c.sel.services ? 1 : 0) + (c.sel.by !== "mine" ? 1 : 0)
	useEffect(() => {
		if (!open) return
		const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => (window.removeEventListener("pointerdown", off), window.removeEventListener("keydown", esc))
	}, [open])
	return (
		<div ref={ref} className={`relative shrink-0 ${className}`}>
			<button
				type="button"
				aria-expanded={open}
				aria-label="Length, services, and order"
				onClick={() => setOpen(!open)}
				className={`relative inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full ${open || n ? "bg-white text-black" : "bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md"}`}
			>
				<AdjustmentsHorizontalIcon className="h-5 w-5" />
				{n > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-black ring-2 ring-gray-900">{n}</span>}
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, y: -6, scale: 0.97 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -6, scale: 0.97 }}
						transition={{ duration: 0.18, ease: EASE }}
						className={`absolute top-full z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-2xl bg-gray-900/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"}`}
					>
						<Opts c={c} id={`pop-${id}`} tone="solid" />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export const resetSel = (s: Sel): Sel => ({ ...s, ...ANY })

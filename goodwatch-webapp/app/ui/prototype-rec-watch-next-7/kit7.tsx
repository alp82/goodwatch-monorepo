// PROTOTYPE - throwaway. Shared pieces for round 7 of Watch next (#176): the strip docked to the hero's top
// edge (round 6's `docked`), its chip line pinned under the header after scrolling, the "On my services"
// toggle (on by default), the sort-view menu that never touches the saved order, and the floating layer the
// mood dropdown opens in. Variants only decide how the dropdown looks and how picked moods show in the strip.
import { ArrowsUpDownIcon, CheckIcon, ChevronDownIcon, GlobeAltIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { backdropUrl } from "~/ui/prototype-rec-watch-next/model"
import type { WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { WRAP } from "~/ui/prototype-rec-watch-next-3/kit3"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import type { View } from "~/ui/prototype-rec-watch-next-4/select"
import { MAX_MOODS, MOOD, type MoodKey } from "./moods"
import { type Per, SORT, SORTS, type Sel7, type SortKey7, type X, moodWords } from "./view"

export const EASE = [0.2, 0.7, 0.2, 1] as const

export type Ctx7 = {
	q: Queue
	x: X
	sel: Sel7
	setSel: (s: Sel7) => void
	v: View & { hit: Map<string, number> }
	n: number
	per: Per
	tap: (m: MoodKey) => void
	// The mood that was refused because three are picked, with a counter so the hint replays.
	blocked: { m: MoodKey; at: number } | null
	open: boolean
	setOpen: (o: boolean) => void
	services: { id: number; name: string; logo: string }[]
	reset: () => void
}

// How a variant draws the picked moods in the strip, and the dropdown.
export type Look = {
	name: string
	// anchor: a panel under the mood button; wide: a panel the width of the strip; sheet: a bottom sheet.
	mode: "anchor" | "wide" | "sheet"
	Picked: (p: { c: Ctx7; pinned: boolean }) => React.ReactElement
	Panel: (p: { c: Ctx7; pinned: boolean }) => React.ReactElement
	// Width of an anchored panel.
	width?: string
}

// ------------------------------------------------------------------ mood art

// A mood's picture: the backdrop of its first title, washed in its colour.
export function MoodArt({ m, art, className = "", wash = "side", size = "w300" }: { m: MoodKey; art?: WTitle; className?: string; wash?: "side" | "full" | "bottom"; size?: string }) {
	const hue = MOOD[m].hue
	const bg = wash === "side" ? `linear-gradient(90deg, ${hue}f0 0%, ${hue}a6 40%, ${hue}1f 100%)` : wash === "bottom" ? `linear-gradient(0deg, ${hue}f2 0%, ${hue}99 35%, ${hue}14 80%)` : `${hue}8c`
	return (
		<span className={`absolute inset-0 -z-10 overflow-hidden ${className}`} aria-hidden>
			<span className="absolute inset-0" style={{ background: hue }} />
			{art && <img src={backdropUrl(art, size)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-85" />}
			<span className="absolute inset-0" style={{ background: bg }} />
			<span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
		</span>
	)
}

// "12 on your services" or "12 on your Wishlist", for one mood.
export const countWords = (c: Ctx7, m: MoodKey) => {
	const n = c.per[m].n
	return c.sel.everywhere ? `${n} on your Wishlist` : `${n} on your services`
}

// ------------------------------------------------------------------ the dropdown's shared parts

// The panel's top line: how many are picked, the hint when a fourth is refused, and Clear.
export function PanelHead({ c, className = "", title = "Pick up to three moods" }: { c: Ctx7; className?: string; title?: string }) {
	const k = c.sel.moods.length
	const [hint, setHint] = useState<string | null>(null)
	useEffect(() => {
		if (!c.blocked) return
		setHint(`Three is the most. Remove one to add ${MOOD[c.blocked.m].name}.`)
		const id = setTimeout(() => setHint(null), 3200)
		return () => clearTimeout(id)
	}, [c.blocked?.at])
	return (
		<div className={`flex min-h-9 items-center gap-3 ${className}`}>
			<AnimatePresence mode="wait" initial={false}>
				{hint ? (
					<motion.p key="hint" role="status" data-hint initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="min-w-0 flex-1 text-sm font-semibold text-amber-300">
						{hint}
					</motion.p>
				) : (
					<motion.p key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} className="min-w-0 flex-1 text-sm text-gray-300">
						<span className="font-semibold text-white">{title}</span>
						<span className="hidden sm:inline">. A title fits when it is in any of them.</span>
					</motion.p>
				)}
			</AnimatePresence>
			<span className={`shrink-0 text-sm tabular-nums ${k === MAX_MOODS ? "font-semibold text-amber-300" : "text-gray-400"}`}>
				{k} of {MAX_MOODS}
			</span>
			{k > 0 && (
				<button type="button" onClick={() => c.setSel({ ...c.sel, moods: [] })} className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10">
					Clear
				</button>
			)}
			<button type="button" onClick={() => c.setOpen(false)} className="shrink-0 cursor-pointer rounded-full bg-white px-3 py-1 text-sm font-bold text-black hover:bg-gray-200">
				Done
			</button>
		</div>
	)
}

// Whether an option can't be picked right now (three are picked and it isn't one of them).
export const full = (c: Ctx7, m: MoodKey) => c.sel.moods.length >= MAX_MOODS && !c.sel.moods.includes(m)

// ------------------------------------------------------------------ floating layer

// Renders the dropdown in a layer over the page, under `anchor`. It follows the anchor while the page moves
// and closes on a tap outside or Escape. The hero clips its overflow, so the panel can't live inside it.
// On a phone every panel takes the strip's full width (`strip`), whatever its anchor.
export function Float({ c, anchor, strip, look, pinned, children }: { c: Ctx7; anchor: React.RefObject<HTMLElement | null>; strip: React.RefObject<HTMLElement | null>; look: Look; pinned: boolean; children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<{ top: number; left: number; width: number; max: number } | null>(null)
	const sheet = look.mode === "sheet"
	useLayoutEffect(() => {
		if (!c.open || sheet) return
		const place = () => {
			const vw = window.innerWidth
			const el = vw < 640 ? strip.current : anchor.current
			if (!el) return
			const r = el.getBoundingClientRect()
			const top = r.bottom + 8
			if (r.bottom < 60) return c.setOpen(false)
			const width = look.mode === "wide" || vw < 640 ? Math.min(r.width, vw - 16) : Math.min(Number.parseFloat(look.width ?? "26") * 16, vw - 16)
			const left = Math.max(8, Math.min(r.left, vw - width - 8))
			setBox({ top, left, width, max: window.innerHeight - top - 12 })
		}
		place()
		// Picking a mood can wrap the strip onto another line on a phone: follow its new height too.
		const ro = new ResizeObserver(place)
		for (const x of [anchor.current, strip.current]) if (x) ro.observe(x)
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => (ro.disconnect(), window.removeEventListener("scroll", place), window.removeEventListener("resize", place))
	}, [c.open, sheet, look.mode])
	useEffect(() => {
		if (!c.open) return
		const off = (e: PointerEvent) => {
			const t = e.target as HTMLElement
			if (!ref.current?.contains(t) && !t.closest("[data-moodbutton]")) c.setOpen(false)
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && c.setOpen(false)
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => (window.removeEventListener("pointerdown", off), window.removeEventListener("keydown", esc))
	}, [c.open])
	if (typeof document === "undefined") return null
	return createPortal(
		<AnimatePresence>
			{c.open &&
				(sheet ? (
					<motion.div key="sheet" className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
						<motion.div
							ref={ref}
							role="dialog"
							aria-label="Moods"
							data-panel
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ duration: 0.32, ease: EASE }}
							drag="y"
							dragConstraints={{ top: 0, bottom: 0 }}
							dragElastic={{ top: 0, bottom: 0.6 }}
							onDragEnd={(_, i) => i.offset.y > 90 && c.setOpen(false)}
							className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-gray-900 shadow-[0_-20px_60px_rgba(0,0,0,.6)] ring-1 ring-white/10"
						>
							{children}
						</motion.div>
					</motion.div>
				) : (
					box && (
						<motion.div
							key="panel"
							ref={ref}
							role="dialog"
							aria-label="Moods"
							data-panel
							initial={{ opacity: 0, y: -8, scale: 0.985 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -8, scale: 0.985 }}
							transition={{ duration: 0.2, ease: EASE }}
							className={`fixed z-[70] origin-top overflow-hidden rounded-2xl bg-gray-900/95 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12 backdrop-blur-xl ${pinned ? "" : ""}`}
							style={{ top: box.top, left: box.left, width: box.width, maxHeight: box.max }}
						>
							{children}
						</motion.div>
					)
				))}
		</AnimatePresence>,
		document.body,
	)
}

// ------------------------------------------------------------------ strip controls

export function ServicesToggle({ c, compact = false }: { c: Ctx7; compact?: boolean }) {
	const on = !c.sel.everywhere
	const logos = c.services.slice(0, 3)
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={() => c.setSel({ ...c.sel, everywhere: on })}
			title={on ? "Showing what you can play on your services first. Tap to include everywhere." : "Including titles on any service. Tap to put your services first."}
			className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full pl-1.5 pr-3 text-sm font-semibold transition-colors ${on ? "bg-white text-black hover:bg-gray-200" : "bg-white/10 text-gray-100 ring-1 ring-white/15 hover:bg-white/20"}`}
		>
			{on ? (
				<span className="flex -space-x-1.5">
					{logos.map((s) => (
						<img key={s.id} src={s.logo} alt="" className="h-6 w-6 rounded-full ring-2 ring-white" />
					))}
				</span>
			) : (
				<GlobeAltIcon className="ml-0.5 h-5 w-5 text-gray-300" />
			)}
			{on ? (compact ? <span className="hidden md:inline">On my services</span> : "On my services") : compact ? "All" : "Everywhere"}
		</button>
	)
}

// The sort menu. "My order" is the saved order; the rest are views over it and say so.
export function OrderMenu({ c, compact = false }: { c: Ctx7; compact?: boolean }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const btn = useRef<HTMLButtonElement>(null)
	const [box, setBox] = useState<{ top: number; right: number } | null>(null)
	const by = c.sel.by
	useLayoutEffect(() => {
		if (!open) return
		const place = () => {
			const r = btn.current?.getBoundingClientRect()
			if (!r) return
			if (r.bottom < 60) return setOpen(false)
			setBox({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
		}
		place()
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => (window.removeEventListener("scroll", place), window.removeEventListener("resize", place))
	}, [open])
	useEffect(() => {
		if (!open) return
		const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node) && setOpen(false)
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => (window.removeEventListener("pointerdown", off), window.removeEventListener("keydown", esc))
	}, [open])
	const pick = (k: SortKey7) => (c.setSel({ ...c.sel, by: k }), setOpen(false))
	return (
		<>
			<button
				ref={btn}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`Order: ${SORT[by].label}`}
				data-order
				onClick={() => setOpen(!open)}
				className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold transition-colors ${by === "mine" ? "bg-white/10 text-gray-100 ring-1 ring-white/15 hover:bg-white/20" : "bg-sky-300 text-black hover:bg-sky-200"}`}
			>
				<ArrowsUpDownIcon className="h-4 w-4 opacity-70" />
				{compact && by === "mine" ? <span className="hidden md:inline">My order</span> : SORT[by].label}
				<ChevronDownIcon className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			{typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{open && box && (
							<motion.div
								ref={ref}
								role="menu"
								aria-label="Order"
								initial={{ opacity: 0, y: -6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18, ease: EASE }}
								className="fixed z-[70] w-[min(22rem,calc(100vw-1rem))] rounded-2xl bg-gray-900/95 p-1.5 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12 backdrop-blur-xl"
								style={{ top: box.top, right: box.right }}
							>
								{SORTS.map((s, i) => (
									<div key={s.key}>
										{i === 1 && <p className="px-3 pb-1 pt-2.5 text-xs text-gray-400">Views. Each one sorts for a look; your order stays as you set it.</p>}
										<button
											type="button"
											role="menuitemradio"
											aria-checked={by === s.key}
											data-sort={s.key}
											onClick={() => pick(s.key)}
											className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-white/8 ${by === s.key ? "bg-white/10" : ""}`}
										>
											<span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${by === s.key ? "bg-white text-black" : "ring-1 ring-white/30"}`}>{by === s.key && <CheckIcon className="h-3 w-3" />}</span>
											<span className="min-w-0">
												<span className="block text-sm font-semibold text-white">
													{s.label}
													{s.key === "mine" && <span className="ml-2 rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[11px] font-bold text-amber-200">Saved</span>}
												</span>
												<span className="block text-xs text-gray-400">{s.line}</span>
											</span>
										</button>
									</div>
								))}
							</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</>
	)
}

// "23 fit" after the moods, or how many are on your services.
export function Count({ c, className = "" }: { c: Ctx7; className?: string }) {
	if (!c.v.need) return <span className={`whitespace-nowrap text-sm tabular-nums text-gray-400 max-sm:hidden ${className}`}>{c.q.count} titles</span>
	// On a phone, the count only shows once a mood is picked; "On my services" already says the rest.
	return (
		<span className={`whitespace-nowrap text-sm tabular-nums text-gray-400 ${c.sel.moods.length ? "" : "max-sm:hidden"} ${className}`} data-count>
			<motion.span key={c.n} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="font-semibold text-white">
				{c.n}
			</motion.span>{" "}
			{c.sel.moods.length ? "fit" : "on your services"}
		</span>
	)
}

// The button that opens the dropdown. With nothing picked it reads "Any mood"; with picks it is a small
// "+" or "Change" next to them.
export function MoodButton({ c, picked, pinned = false }: { c: Ctx7; picked: boolean; pinned?: boolean }) {
	const k = c.sel.moods.length
	// On a phone the pinned line has no room for the chips: the button says how many are picked instead.
	const word = k < MAX_MOODS ? "Add" : "Change"
	return (
		<button
			type="button"
			data-moodbutton
			aria-expanded={c.open}
			aria-haspopup="dialog"
			onClick={() => c.setOpen(!c.open)}
			className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-semibold transition-colors ${picked ? "bg-white/10 px-2.5 text-gray-100 ring-1 ring-white/15 hover:bg-white/20" : "bg-white/10 pl-1.5 pr-3 text-white ring-1 ring-white/15 hover:bg-white/20"} ${c.open ? "bg-white/15" : ""}`}
		>
			{!picked && <Spectrum />}
			{!picked ? (
				"Any mood"
			) : pinned ? (
				<>
					<span className="md:hidden">{k === 1 ? MOOD[c.sel.moods[0]].name : `${k} moods`}</span>
					<span className="hidden md:inline">{word}</span>
				</>
			) : (
				<span className="hidden sm:inline">{word}</span>
			)}
			<ChevronDownIcon className={`h-4 w-4 opacity-70 transition-transform ${c.open ? "rotate-180" : ""}`} />
		</button>
	)
}

// Four mood colours in a small fan, for the "Any mood" button.
function Spectrum() {
	const hs = ["funny", "romance", "crime", "worlds"] as MoodKey[]
	return (
		<span className="flex -space-x-2">
			{hs.map((m) => (
				<span key={m} className="h-6 w-6 rounded-full ring-2 ring-gray-900" style={{ background: MOOD[m].hue }} />
			))}
		</span>
	)
}

// A small remove button inside a picked chip.
export function Unpick({ c, m, ink = "#fff" }: { c: Ctx7; m: MoodKey; ink?: string }) {
	return (
		<span
			role="button"
			tabIndex={0}
			aria-label={`Remove ${MOOD[m].name}`}
			onClick={(e) => (e.stopPropagation(), c.tap(m))}
			onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.stopPropagation(), c.tap(m))}
			className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/25 hover:bg-black/50"
			style={{ color: ink }}
		>
			<XMarkIcon className="h-3.5 w-3.5" />
		</span>
	)
}

// ------------------------------------------------------------------ the docked strip

function StripBody({ c, look, pinned }: { c: Ctx7; look: Look; pinned: boolean }) {
	const anchor = useRef<HTMLDivElement>(null)
	const moodRef = useRef<HTMLDivElement>(null)
	const picked = c.sel.moods.length > 0
	const { Picked, Panel } = look
	return (
		<div ref={anchor} className="relative">
			<div className={`flex gap-2 ${pinned ? "h-12 items-center" : "flex-col rounded-2xl bg-black/45 p-1.5 ring-1 ring-white/10 backdrop-blur-md md:h-14 md:flex-row md:items-center md:px-2"}`}>
				{/* On a phone the picked chips wrap onto a second line instead of scrolling out of sight. */}
				<div ref={moodRef} className={`flex min-w-0 flex-1 items-center gap-1.5 ${pinned ? "" : "flex-wrap md:flex-nowrap"}`}>
					{picked && (
						<div className={`-my-1 min-w-0 items-center gap-1.5 py-1 [scrollbar-width:none] md:overflow-x-auto ${pinned ? "hidden md:flex" : "contents md:flex"}`} role="group" aria-label="Picked moods">
							<Picked c={c} pinned={pinned} />
						</div>
					)}
					<MoodButton c={c} picked={picked} pinned={pinned} />
					<Count c={c} className={`shrink-0 pl-1 pr-1.5 ${pinned ? "hidden lg:inline" : ""}`} />
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<ServicesToggle c={c} compact={pinned} />
					<OrderMenu c={c} compact={pinned} />
				</div>
			</div>
			<Float c={c} anchor={look.mode === "anchor" ? moodRef : anchor} strip={anchor} look={look} pinned={pinned}>
				<Panel c={c} pinned={pinned} />
			</Float>
		</div>
	)
}

// Under the strip, only for a sort view: what you're looking at, and the way back.
export function ViewNote({ c, className = "" }: { c: Ctx7; className?: string }) {
	if (c.sel.by === "mine" || c.q.count < 2) return null
	return (
		<div className={`flex min-h-9 items-center gap-2 text-sm ${className}`} role="status" data-viewnote>
			<p className="min-w-0 flex-1 text-gray-200 [text-shadow:0_1px_6px_rgba(0,0,0,.8)]">
				<span className="font-semibold text-sky-200">Sorted by {SORT[c.sel.by].label.toLowerCase()}</span>
				<span className="text-gray-300"> for now. Your order is unchanged.</span>
			</p>
			<button type="button" onClick={() => c.setSel({ ...c.sel, by: "mine" })} className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/20">
				Back to my order
			</button>
		</div>
	)
}

// The strip on the hero's top edge. Once it scrolls away, the same controls wait under the page header.
export function Docked7({ c, look }: { c: Ctx7; look: Look }) {
	const ref = useRef<HTMLDivElement>(null)
	const [gone, setGone] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(([e]) => setGone(!e.isIntersecting && e.boundingClientRect.top < 80), { rootMargin: "-64px 0px 0px 0px" })
		io.observe(el)
		return () => io.disconnect()
	}, [])
	// Switching between the strip and the pinned line closes an open dropdown so it never jumps.
	useEffect(() => c.setOpen(false), [gone])
	return (
		<>
			<div ref={ref} data-sel>
				{gone ? <div className="h-[5.75rem] md:h-14" /> : <StripBody c={c} look={look} pinned={false} />}
				<ViewNote c={c} className="mt-1 px-1" />
			</div>
			{gone &&
				typeof document !== "undefined" &&
				createPortal(
					<motion.div data-pinned initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }} className="fixed inset-x-0 top-16 z-40 border-b border-white/10 bg-gray-900/90 backdrop-blur-md">
						<div className={WRAP}>
							<StripBody c={c} look={look} pinned />
						</div>
					</motion.div>,
					document.body,
				)}
		</>
	)
}

// ------------------------------------------------------------------ hero line

// The line above the hero's title: what the pick is, where it sits in your order, and its moods.
export function Eyebrow({ c, t }: { c: Ctx7; t: WTitle }) {
	const { sel, v } = c
	const fitsAll = !v.need || v.fit.get(t.key) === v.need
	const pos = c.q.pos(t.key)
	const moods = c.x[t.key]?.m ?? []
	const label = !fitsAll
		? sel.moods.length
			? "Closest to your moods"
			: "Nothing on your services; closest"
		: sel.moods.length
			? sel.moods.length > 1
				? "Top pick for your moods"
				: `Top pick for ${moodWords(sel.moods)}`
			: sel.by !== "mine"
				? `Top of ${SORT[sel.by].label.toLowerCase()}`
				: "Watch next"
	return (
		<motion.div key={t.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold">
			<span className="text-amber-300">{label}</span>
			{pos > 0 && <span className="text-gray-300">#{pos} in your order</span>}
			{moods.length > 0 && (
				<span className="flex flex-wrap items-center gap-1.5">
					{moods.slice(0, 3).map((m) => {
						const on = sel.moods.includes(m)
						return (
							<span key={m} className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs ${on ? "text-black" : "bg-black/40 text-gray-200 ring-1 ring-white/15"}`} style={on ? { background: MOOD[m].hue } : undefined}>
								{!on && <span className="h-2 w-2 rounded-full" style={{ background: MOOD[m].hue }} />}
								{MOOD[m].name}
							</span>
						)
					})}
				</span>
			)}
		</motion.div>
	)
}

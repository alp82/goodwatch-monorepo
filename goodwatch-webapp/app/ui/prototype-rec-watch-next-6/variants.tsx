// PROTOTYPE - throwaway. Seven takes between round 5's `strip` and `swatches` (#176, round 6). Each picks
// the mood with colour swatches (one, or two blended), keeps length, services and order, the "N fit" count
// and the view line, and stays within about 80 px at rest on desktop and one thumb row on a phone.
// A variant returns the parts it adds to the page, as in round 5, plus an optional bottom dock.
import { AdjustmentsHorizontalIcon, ChevronUpDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { backdropUrl } from "~/ui/prototype-rec-watch-next/model"
import type { Mood, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { LENGTHS, ORDERS, adopt } from "~/ui/prototype-rec-watch-next-4/select"
import { DISPLAY, FitCount, Opts, OptsButton, WRAP } from "~/ui/prototype-rec-watch-next-5/kit5"
import type { Parts } from "~/ui/prototype-rec-watch-next-5/variants"
import { HUE, LONG, NAME, PATH, describe5 } from "~/ui/prototype-rec-watch-next-5/mood"
import { Blend, ChipLine, type Ctx6, EASE, type Facet, MoodChip, Pop, Swatches, plainSel, useFold } from "./kit6"
import { blendName, inkOn, mixHue, tapMix } from "./mix"

export type Parts6 = Parts & { dock?: React.ReactNode }
export type VariantFn6 = (c: Ctx6, first: WTitle | undefined) => Parts6

// The folded strip: the selection as a line of chips; tap to open the strip again.
function Folded({ c, onOpen }: { c: Ctx6; onOpen: () => void }) {
	return (
		<motion.button
			key="folded"
			type="button"
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -6 }}
			transition={{ duration: 0.18 }}
			onClick={onOpen}
			aria-label="Change the selection"
			className="flex h-full w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden text-left"
		>
			<ChipLine c={c} className="min-w-0 flex-1 overflow-hidden" />
			<ChevronUpDownIcon className="h-5 w-5 shrink-0 text-gray-400" />
		</motion.button>
	)
}

// A sticky strip under the page header that folds to the chip line once the page scrolls.
function FoldingStrip({ c, children }: { c: Ctx6; children: React.ReactNode }) {
	const [folded, open] = useFold()
	return (
		<motion.div data-sel className="sticky top-16 z-40 border-b border-white/10 bg-gray-900/85 backdrop-blur-md" initial={false} animate={{ height: folded ? 44 : 48 }} transition={{ duration: 0.25, ease: EASE }}>
			<div className={`${WRAP} relative h-full`}>
				<AnimatePresence mode="wait" initial={false}>
					{folded ? (
						<Folded c={c} onOpen={open} />
					) : (
						<motion.div key="open" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }} className="flex h-full items-center gap-3 md:gap-4">
							{children}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</motion.div>
	)
}

// Round 5's view line, kept to one line on a phone: "Just a view" with "Use this order" and "Back".
function ViewLine6({ c, className = "", short = false }: { c: Ctx6; className?: string; short?: boolean }) {
	if (c.q.count < 2) return null
	if (!c.m && c.sel.length === "any" && !c.sel.services && c.sel.by === "mine")
		return (
			<p className={`flex min-h-8 items-center text-sm text-gray-300 ${className}`} role="status" data-viewline>
				Your saved order, {c.q.count} titles.<span className="hidden text-gray-400 sm:inline">&nbsp;Pick a mood; your order stays as it is.</span>
			</p>
		)
	const changes = c.v.keys.slice(0, 12).some((k, i) => c.q.order[i] !== k)
	const use = () => {
		const first = c.q.T(c.v.keys[0])
		c.q.setOrder(adopt(c.q, c.v), `Saved as your order. ${first?.title ?? "The top title"} is #1 on your Wishlist.`)
		c.reset()
	}
	return (
		<div className={`flex min-h-8 min-w-0 items-center gap-1.5 text-sm ${className}`} role="status" data-viewline>
			<p className="mr-auto min-w-0 truncate text-gray-200 md:mr-2">
				<span className="font-semibold text-white">Just a view</span>
				{!short && <span className="hidden md:inline">: {describe5(c.sel, c.m?.p ?? null, c.m?.name)}</span>}
				<span className="hidden text-gray-400 lg:inline">. Your saved order stays.</span>
			</p>
			{changes && c.v.keys.length > 0 && (
				<button type="button" onClick={use} className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-md bg-amber-400 px-3 text-sm font-bold text-black hover:bg-amber-300" title="Save this view as your Wishlist order">
					Use this order
				</button>
			)}
			<button type="button" onClick={c.reset} className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-md bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20">
				<span className="md:hidden">Back</span>
				<span className="hidden md:inline">Back to my order</span>
			</button>
			<span className="hidden flex-1 md:block" />
		</div>
	)
}

const viewRow = (c: Ctx6) => (
	<div data-sel className={WRAP}>
		<ViewLine6 c={c} />
	</div>
)

// ============================================================ 1. The strip, with swatches for its mood

function DotStripBody({ c }: { c: Ctx6 }) {
	return (
		<>
			<div className="-ml-4 min-w-0 flex-1 overflow-x-auto py-1 pl-4 [scrollbar-width:none] md:ml-0 md:flex-none md:overflow-visible md:pl-0">
				<Swatches c={c} look={{ dot: 26, names: "md" }} />
			</div>
			<FitCount c={c} className="hidden shrink-0 text-sm md:block" />
			<Opts c={c} id="dots" tone="solid" className="ml-auto hidden shrink-0 flex-nowrap xl:flex" />
			<OptsButton c={c} id="dots-m" className="md:ml-auto xl:hidden" />
		</>
	)
}
export const dots: VariantFn6 = (c) => ({
	sticky: (
		<>
			<FoldingStrip c={c}>
				<DotStripBody c={c} />
			</FoldingStrip>
			{viewRow(c)}
		</>
	),
	aside: "then",
})

// ============================================================ 2. Poster chips

// Each swatch is a small chip showing the backdrop of the first title in that mood, washed in its colour.
function PosterChip({ c, m }: { c: Ctx6; m: Mood }) {
	const { n, top } = c.per[m]
	const on = c.mix.picks.includes(m)
	const dim = c.mix.picks.length > 0 && !on
	const img = top ? backdropUrl(top, "w300") : ""
	return (
		<motion.button
			layout
			type="button"
			aria-pressed={on}
			aria-label={`${LONG[m]}, ${n} fit${top ? `, first is ${top.title}` : ""}`}
			title={top ? `${LONG[m]}: ${top.title} first` : LONG[m]}
			onClick={() => c.setMix(tapMix(c.mix, m))}
			whileTap={{ scale: 0.95 }}
			transition={{ layout: { type: "spring", stiffness: 420, damping: 34 } }}
			className={`group relative isolate h-10 w-[3.4rem] shrink-0 cursor-pointer overflow-hidden rounded-xl text-left transition-[opacity,box-shadow] duration-200 md:w-auto md:min-w-[7.5rem] ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${dim ? "opacity-55 hover:opacity-100" : ""}`}
			style={{ order: on ? c.mix.picks.indexOf(m) * 2 : 3, boxShadow: on ? `0 6px 24px -6px ${HUE[m]}` : undefined, background: HUE[m] }}
		>
			{img && <img src={img} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-110" />}
			<span className="absolute inset-0 -z-10" style={{ background: `linear-gradient(90deg, ${HUE[m]}f2 0%, ${HUE[m]}b3 38%, ${HUE[m]}26 100%)` }} />
			<span className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-black/45 to-transparent" />
			<span className="flex h-full flex-col justify-between px-2 py-1 md:px-2.5 md:pr-4">
				<span className="hidden whitespace-nowrap text-[13px] font-bold leading-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,.5)] md:block">{NAME[m]}</span>
				<span className="mt-auto text-xs font-bold tabular-nums leading-tight text-white/90 [text-shadow:0_1px_4px_rgba(0,0,0,.6)]">
					{n}
					<span className="hidden font-semibold md:inline"> fit</span>
				</span>
			</span>
		</motion.button>
	)
}
function PosterBand({ c }: { c: Ctx6 }) {
	return (
		<div data-sel>
			<div className="flex items-center gap-3">
				<div className="-ml-4 min-w-0 flex-1 overflow-x-auto py-0.5 pl-4 [scrollbar-width:none] md:ml-0 md:overflow-visible md:pl-0">
					<div className="flex items-center gap-1.5 md:gap-2" role="group" aria-label="Mood">
						{PATH.map((m) => (
							<PosterChip key={m} c={c} m={m} />
						))}
						<AnimatePresence initial={false}>
							{c.mix.picks.length === 2 && (
								<motion.div layout key="blend" initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.25, ease: EASE }} className="shrink-0 overflow-hidden" style={{ order: 1 }}>
									<Blend c={c} className="mx-1 w-20 md:w-28" />
								</motion.div>
							)}
						</AnimatePresence>
						<span className="order-last hidden pl-2 md:block">
							<MoodLabel c={c} />
						</span>
					</div>
				</div>
				<OptsButton c={c} id="po-m" className="md:hidden" />
			</div>
			<div className="flex items-center justify-between gap-4">
				<ViewLine6 c={c} className="min-w-0 flex-1" short />
				<Opts c={c} id="po" tone="solid" className="ml-auto hidden shrink-0 flex-nowrap md:flex" />
			</div>
		</div>
	)
}
// The mood's name in its colour, crossfading, with the count.
function MoodLabel({ c }: { c: Ctx6 }) {
	const text = c.m?.name ?? "Any mood"
	return (
		<span className="flex items-baseline gap-2 whitespace-nowrap">
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span key={text} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }} className={`${DISPLAY} text-lg`} style={{ color: c.m ? mixHue(c.mix) : "#9ca3af" }}>
					{text}
				</motion.span>
			</AnimatePresence>
			<FitCount c={c} className="text-sm" />
		</span>
	)
}
export const posters: VariantFn6 = (c) => ({ above: <PosterBand c={c} />, aside: "then" })

// ============================================================ 3. One bar, drag across to blend

const GROW = 2.4

// Five colour segments in one bar. Tap one for that mood. Press on one and drag onto another to blend
// the two; where you let go inside the second sets the lean. Picked segments widen to show their names.
function SwatchBar({ c, className = "" }: { c: Ctx6; className?: string }) {
	const ref = useRef<HTMLDivElement>(null)
	const [a, b] = c.mix.picks
	const grows = PATH.map((m) => (c.mix.picks.includes(m) ? GROW : 1))
	const frozen = useRef<number[] | null>(null)
	const drag = useRef<{ a: number; x0: number; moved: boolean } | null>(null)
	const [live, setLive] = useState(false)
	const g = frozen.current ?? grows
	const total = g.reduce((s, x) => s + x, 0)
	const start = (i: number) => g.slice(0, i).reduce((s, x) => s + x, 0)
	const center = (i: number) => (start(i) + g[i] / 2) / total
	// Segment and fraction inside it, for a pointer x.
	const at = (x: number) => {
		const r = ref.current!.getBoundingClientRect()
		const u = Math.max(0, Math.min(0.9999, (x - r.left) / r.width)) * total
		let i = 0
		while (i < 4 && u >= start(i + 1)) i++
		return { i, f: (u - start(i)) / g[i] }
	}
	const pick = (x: number, end = false) => {
		const d = drag.current!
		const { i, f } = at(x)
		if (i === d.a) {
			if (end && !d.moved && c.mix.picks.length === 1 && a === PATH[i]) return c.setMix({ picks: [], w: 0.5 })
			return c.setMix({ picks: [PATH[i]], w: 0.5 })
		}
		// Near edge of the second segment leans to the first mood; far edge leans to the second.
		const near = i > d.a ? f : 1 - f
		c.setMix({ picks: [PATH[d.a], PATH[i]], w: 0.25 + near * 0.6 })
	}
	const mark = a && b ? center(PATH.indexOf(a)) + (center(PATH.indexOf(b)) - center(PATH.indexOf(a))) * ((c.mix.w - 0.25) / 0.6) : null
	return (
		<div className={`flex min-w-0 items-center ${className}`}>
			<div
				ref={ref}
				role="group"
				aria-label="Mood: tap a colour, or drag from one colour onto another to blend them"
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId)
					frozen.current = grows
					drag.current = { a: at(e.clientX).i, x0: e.clientX, moved: false }
					setLive(true)
				}}
				onPointerMove={(e) => {
					const d = drag.current
					if (!d) return
					if (!d.moved && Math.abs(e.clientX - d.x0) < 6) return
					d.moved = true
					pick(e.clientX)
				}}
				onPointerUp={(e) => {
					if (drag.current) pick(e.clientX, true)
					drag.current = null
					frozen.current = null
					setLive(false)
				}}
				onPointerCancel={() => ((drag.current = null), (frozen.current = null), setLive(false))}
				className="relative flex h-10 w-full cursor-pointer touch-none select-none overflow-hidden rounded-full ring-1 ring-white/10"
			>
				{PATH.map((m, i) => {
					const on = c.mix.picks.includes(m)
					const dim = c.mix.picks.length > 0 && !on
					return (
						<button
							key={m}
							type="button"
							tabIndex={0}
							aria-pressed={on}
							aria-label={LONG[m]}
							onClick={(e) => e.detail === 0 && c.setMix(on && c.mix.picks.length === 1 ? { picks: [], w: 0.5 } : { picks: [m], w: 0.5 })}
							className="relative flex h-full min-w-0 items-center justify-center overflow-hidden px-2 text-[13px] font-bold outline-none transition-[flex-grow,opacity] duration-300 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
							style={{ flexGrow: g[i], flexBasis: 0, background: HUE[m], color: inkOn(HUE[m]), opacity: dim ? 0.4 : 1 }}
						>
							<span className={`truncate ${on ? "" : "max-md:hidden"}`}>{NAME[m]}</span>
						</button>
					)
				})}
				{mark != null && (
					<motion.span
						className="pointer-events-none absolute top-1/2 h-6 w-6 rounded-full border-[3px] border-white shadow-lg"
						style={{ background: mixHue(c.mix) }}
						initial={false}
						animate={{ left: `${mark * 100}%`, x: "-50%", y: "-50%", scale: live ? 1.15 : 1 }}
						transition={live ? { duration: 0.05 } : { type: "spring", stiffness: 300, damping: 30 }}
					/>
				)}
			</div>
		</div>
	)
}
function DragStripBody({ c }: { c: Ctx6 }) {
	return (
		<>
			<SwatchBar c={c} className="min-w-0 flex-1 md:max-w-[44rem]" />
			<FitCount c={c} className="hidden w-14 shrink-0 text-sm md:block" />
			<Opts c={c} id="drag" tone="solid" className="ml-auto hidden shrink-0 flex-nowrap xl:flex" />
			<OptsButton c={c} id="drag-m" className="md:ml-auto xl:hidden" />
		</>
	)
}
export const drag: VariantFn6 = (c) => ({
	sticky: (
		<>
			<FoldingStrip c={c}>
				<DragStripBody c={c} />
			</FoldingStrip>
			<div data-sel className={`${WRAP} flex items-center gap-3`}>
				<ViewLine6 c={c} className="min-w-0 flex-1" short />
				{c.m && <span className="hidden shrink-0 text-sm font-semibold md:inline" style={{ color: mixHue(c.mix) }}>{c.m.name}</span>}
			</div>
		</>
	),
	aside: "then",
})

// ============================================================ 4. Swatches with counts; hover previews the hero

function CountBand({ c }: { c: Ctx6 }) {
	return (
		<div data-sel>
			<div className="flex items-center gap-3">
				<div className="-ml-4 min-w-0 flex-1 overflow-x-auto py-0.5 pl-4 [scrollbar-width:none] md:ml-0 md:overflow-visible md:pl-0">
					<Swatches c={c} look={{ dot: 28, names: "md", counts: true, preview: true }} />
				</div>
				<OptsButton c={c} id="ct-m" className="md:hidden" />
			</div>
			<div className="mt-1 flex items-center justify-between gap-4">
				<ViewLine6 c={c} className="min-w-0 flex-1" />
				<Opts c={c} id="ct" tone="solid" className="ml-auto hidden shrink-0 flex-nowrap md:flex" />
			</div>
		</div>
	)
}
function PreviewEyebrow({ c }: { c: Ctx6 }) {
	if (!c.pv) return null
	const [a, b] = c.pv.picks
	const name = !a ? "Any mood" : b ? blendName(a, b, c.pv.w) : LONG[a]
	return (
		<p className="flex items-center gap-2 text-sm font-semibold" aria-live="polite">
			<span className="h-2.5 w-2.5 rounded-full" style={{ background: mixHue(c.pv) }} />
			<span style={{ color: mixHue(c.pv, "#fcd34d") }}>{name}</span>
			<span className="text-gray-300">would put this first. Click to pick it.</span>
		</p>
	)
}
export const counts: VariantFn6 = (c) => ({ above: <CountBand c={c} />, eyebrow: c.pv ? <PreviewEyebrow c={c} /> : undefined, aside: "then" })

// ============================================================ 5. A line of coloured chips

function LengthPick({ c, done }: { c: Ctx6; done: () => void }) {
	return (
		<div className="flex gap-1.5" role="radiogroup" aria-label="Length">
			{LENGTHS.map((l) => (
				<button key={l.key} type="button" role="radio" aria-checked={c.sel.length === l.key} onClick={() => (c.setSel({ ...c.sel, length: l.key }), done())} className={`h-9 cursor-pointer rounded-full px-3.5 text-sm font-semibold ${c.sel.length === l.key ? "bg-white text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}>
					{l.label}
				</button>
			))}
		</div>
	)
}
function OrderList({ c, done }: { c: Ctx6; done: () => void }) {
	return (
		<ul className="flex w-64 flex-col" role="listbox" aria-label="Order">
			{ORDERS.map((o) => (
				<li key={o.key}>
					<button type="button" role="option" aria-selected={c.sel.by === o.key} onClick={() => (c.setSel({ ...c.sel, by: o.key }), done())} className={`flex w-full cursor-pointer flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-white/10 ${c.sel.by === o.key ? "bg-white/10" : ""}`}>
						<span className={`text-sm font-semibold ${c.sel.by === o.key ? "text-amber-300" : "text-white"}`}>{o.label}</span>
						<span className="text-xs text-gray-400">{o.note}</span>
					</button>
				</li>
			))}
		</ul>
	)
}
function WordsStrip({ c }: { c: Ctx6 }) {
	const [open, setOpen] = useState<Facet | null>(null)
	const [left, setLeft] = useState(0)
	const [folded] = useFold()
	const box = useRef<HTMLDivElement>(null)
	const tap = (f: Facet) => {
		if (f === "services") return c.setSel({ ...c.sel, services: !c.sel.services }), setOpen(null)
		setOpen(open === f ? null : f)
	}
	return (
		<motion.div data-sel className="sticky top-16 z-40 border-b border-white/10 bg-gray-900/85 backdrop-blur-md" initial={false} animate={{ height: folded ? 44 : 48 }} transition={{ duration: 0.25, ease: EASE }}>
			<div ref={box} className={`${WRAP} relative flex h-full items-center gap-3`}>
				<AnimatePresence initial={false}>
					{!folded && (
						<motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className={`${DISPLAY} hidden shrink-0 overflow-hidden whitespace-nowrap text-xl text-white md:block`}>
							Tonight
						</motion.span>
					)}
				</AnimatePresence>
				<div
					data-chipline
					className="-mr-4 min-w-0 flex-1 overflow-x-auto py-1 pr-4 [scrollbar-width:none] md:mr-0 md:pr-0"
					onClickCapture={(e) => {
						const b = (e.target as HTMLElement).closest("button")
						const r = box.current?.getBoundingClientRect()
						if (b && r) setLeft(Math.max(16, Math.min(b.getBoundingClientRect().left - r.left, r.width - 376)))
					}}
				>
					<ChipLine c={c} onTap={tap} all open={open} />
				</div>
				<Pop open={open != null} onClose={() => setOpen(null)} className="absolute top-full mt-1 max-w-[calc(100vw-2rem)]" style={{ left }}>
					{open === "mood" && (
						<div className="flex flex-col gap-2 pr-6 md:pr-0">
							<Swatches c={c} look={{ dot: 26, names: "always" }} className="flex-wrap" blendW="w-28" />
							<p className="text-xs text-gray-400">Pick one colour, or two to blend them.</p>
						</div>
					)}
					{open === "length" && <LengthPick c={c} done={() => setOpen(null)} />}
					{open === "order" && <OrderList c={c} done={() => setOpen(null)} />}
				</Pop>
			</div>
		</motion.div>
	)
}
export const words: VariantFn6 = (c) => ({
	sticky: (
		<>
			<WordsStrip c={c} />
			{viewRow(c)}
		</>
	),
	aside: "then",
})

// ============================================================ 6. The strip docked to the hero's top edge

function Docked({ c }: { c: Ctx6 }) {
	const ref = useRef<HTMLDivElement>(null)
	const [gone, setGone] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(([e]) => setGone(!e.isIntersecting && e.boundingClientRect.top < 80), { rootMargin: "-64px 0px 0px 0px" })
		io.observe(el)
		return () => io.disconnect()
	}, [])
	return (
		<>
			<div ref={ref} data-sel>
				<div className="flex h-12 items-center gap-3 rounded-2xl bg-black/45 px-1.5 ring-1 ring-white/10 backdrop-blur-md md:gap-4 md:px-3">
					<div className="-ml-2 min-w-0 flex-1 overflow-x-auto py-1 pl-2 [scrollbar-width:none] md:ml-0 md:flex-none md:overflow-visible md:pl-0">
						<Swatches c={c} look={{ dot: 28, names: "md", tone: "glass" }} />
					</div>
					<FitCount c={c} className="hidden shrink-0 text-sm md:block" />
					<Opts c={c} id="dock" className="ml-auto hidden shrink-0 flex-nowrap xl:flex" />
					<OptsButton c={c} id="dock-m" className="md:ml-auto xl:hidden" />
				</div>
				<ViewLine6 c={c} className="px-1 [text-shadow:0_1px_6px_rgba(0,0,0,.8)]" />
			</div>
			{/* Once the hero's strip scrolls away, its chip line waits under the page header. */}
			{gone && createPortal(<DockedFold c={c} />, document.body)}
		</>
	)
}
function DockedFold({ c }: { c: Ctx6 }) {
	return (
		<motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }} className="fixed inset-x-0 top-16 z-40 h-11 border-b border-white/10 bg-gray-900/85 backdrop-blur-md">
			<div className={`${WRAP} h-full`}>
				<Folded c={c} onOpen={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
			</div>
		</motion.div>
	)
}
export const docked: VariantFn6 = (c) => ({ top: <Docked c={c} />, aside: "then" })

// ============================================================ 7. A bottom strip for the thumb

function OptsUp({ c }: { c: Ctx6 }) {
	const [open, setOpen] = useState(false)
	const n = (c.sel.length !== "any" ? 1 : 0) + (c.sel.services ? 1 : 0) + (c.sel.by !== "mine" ? 1 : 0)
	return (
		<div className="relative shrink-0">
			<button
				type="button"
				data-chipline
				aria-expanded={open}
				aria-label="Length, services, and order"
				onClick={() => setOpen(!open)}
				className={`relative inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold ${open || n ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
			>
				<AdjustmentsHorizontalIcon className="h-5 w-5 md:hidden" />
				{n > 0 && <span className="tabular-nums md:hidden">{n}</span>}
				<span className="hidden md:inline">{n ? `Length, services, order (${n})` : "Length, services, order"}</span>
				<ChevronUpIcon className={`hidden h-4 w-4 transition-transform md:block ${open ? "rotate-180" : ""}`} />
			</button>
			<Pop open={open} onClose={() => setOpen(false)} className="absolute bottom-full right-0 mb-3 w-[min(21rem,calc(100vw-2rem))] origin-bottom-right">
				<Opts c={c} id="up" tone="solid" className="pr-6 md:pr-0" />
			</Pop>
		</div>
	)
}
function ThumbDock({ c }: { c: Ctx6 }) {
	const [folded, open] = useFold(220, true)
	const plain = plainSel(c)
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-[5.75rem] z-40 px-3 lg:bottom-5">
			<motion.div data-sel layout transition={{ duration: 0.25, ease: EASE }} className="pointer-events-auto mx-auto w-fit max-w-full rounded-[1.4rem] bg-gray-900/90 p-1.5 shadow-[0_18px_50px_-10px_rgba(0,0,0,.9)] ring-1 ring-white/15 backdrop-blur-xl">
				<AnimatePresence mode="popLayout" initial={false}>
					{folded ? (
						<motion.button key="f" type="button" onClick={open} aria-label="Change the selection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-8 max-w-full cursor-pointer items-center gap-2 px-1">
							<ChipLine c={c} className="min-w-0 overflow-hidden" />
							<ChevronUpIcon className="h-4 w-4 shrink-0 text-gray-400" />
						</motion.button>
					) : (
						<motion.div key="o" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
							<div className="flex items-center gap-2">
								<Swatches c={c} look={{ dot: 30, names: "md" }} blendW="w-16 md:w-28" />
								<OptsUp c={c} />
							</div>
							<AnimatePresence initial={false}>
								{!plain && c.q.count >= 2 && (
									<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
										<div className="flex items-center gap-2 px-1.5 pt-1.5">
											<MoodChip c={c} className="max-md:hidden" />
											<FitCount c={c} className="text-sm max-md:hidden" />
											<ViewLine6 c={c} className="min-w-0 flex-1 md:ml-2" short />
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>
		</div>
	)
}
export const thumb: VariantFn6 = (c) => ({
	dock: <ThumbDock c={c} />,
	aside: "then",
})

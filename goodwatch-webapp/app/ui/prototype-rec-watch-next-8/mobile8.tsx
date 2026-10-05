// PROTOTYPE - throwaway. The phone controls for round 8 of Watch next (#176): a compact bottom bar that says
// which moods, services, and sort are on, and a drawer sheet (drag handle, two snap points) that holds all
// three. Two bars, the only thing the variants change:
//   slab   the bar and the site's bottom nav are one surface (the filter bar's round-2 decision); the nav
//          folds away while you scroll down and comes back on the way up.
//   float  a capsule that sits just above the site's own bottom nav, which stays as it is.
// Everything here is below md only; from md up the docked strip on the hero does the job.
import { ArrowsUpDownIcon, CheckIcon, GlobeAltIcon } from "@heroicons/react/24/solid"
import { CubeIcon, FilmIcon, FingerPrintIcon, HomeIcon, TvIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { DragSheet, SPRING, TAP, buzz, useScrollHide } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { MoodArt, countWords, full } from "~/ui/prototype-rec-watch-next-7/kit7"
import { MAX_MOODS, MOOD, MOODS, type MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { type Ctx8, as7 } from "./kit8"
import { SORT8, SORTS8 } from "./view8"

export type BarKind = "slab" | "float"
type Section = "moods" | "services" | "sort"

// ------------------------------------------------------------------ what the bar shows

function MoodDots({ c, size = 14 }: { c: Ctx8; size?: number }) {
	const ms: MoodKey[] = c.sel.moods.length ? c.sel.moods : ["funny", "romance", "crime", "worlds"]
	return (
		<span className="flex -space-x-1">
			{ms.map((m) => (
				<motion.span key={m} layout initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="rounded-full ring-2 ring-gray-950" style={{ width: size, height: size, background: MOOD[m].hue, opacity: c.sel.moods.length ? 1 : 0.55 }} />
			))}
		</span>
	)
}

function Logos({ c, size = 16 }: { c: Ctx8; size?: number }) {
	if (c.sel.everywhere) return <GlobeAltIcon className="text-gray-300" style={{ width: size + 2, height: size + 2 }} />
	return (
		<span className="flex -space-x-1.5">
			{c.services.slice(0, 3).map((s) => (
				<img key={s.id} src={s.logo} alt="" className="rounded-full ring-2 ring-gray-950" style={{ width: size, height: size }} />
			))}
		</span>
	)
}

const moodText = (c: Ctx8) => {
	const ms = c.sel.moods
	if (!ms.length) return "Any mood"
	if (ms.length === 1) return MOOD[ms[0]].name
	return `${MOOD[ms[0]].name} +${ms.length - 1}`
}
const servicesText = (c: Ctx8) => (c.sel.everywhere ? "Everywhere" : "My services")

// ------------------------------------------------------------------ slab: bar and nav as one

function NavRow() {
	const items = [
		{ title: "Home", Icon: HomeIcon, to: "/", on: true },
		{ title: "Discover", Icon: CubeIcon, to: "/discover" },
		null,
		{ title: "Movies", Icon: FilmIcon, to: "/movies" },
		{ title: "Shows", Icon: TvIcon, to: "/shows" },
	]
	return (
		<nav className="grid h-16 grid-cols-5" aria-label="Site">
			{items.map((n) =>
				n ? (
					<a key={n.title} href={n.to} className="flex flex-col items-center justify-center pb-3 pt-2">
						<n.Icon className={`mb-1 h-5 w-5 ${n.on ? "text-amber-600" : "text-gray-400"}`} />
						<span className="text-xs text-gray-200">{n.title}</span>
					</a>
				) : (
					<a key="taste" href="/taste" className="flex items-center justify-center" aria-label="Taste">
						<span className="grid h-11 w-11 place-items-center rounded-full bg-linear-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-900/40">
							<FingerPrintIcon className="h-6 w-6 text-white" />
						</span>
					</a>
				),
			)}
		</nav>
	)
}

function SlabBar({ c, onOpen }: { c: Ctx8; onOpen: (s: Section) => void }) {
	const { hidden } = useScrollHide()
	const seg = "relative flex h-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] px-1.5 text-[12px] font-bold transition-colors active:bg-white/10"
	return (
		<div className="fixed inset-x-0 bottom-0 z-[60] md:hidden" data-mobilebar="slab">
			<div className="rounded-t-[26px] bg-gray-950/92 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)] ring-1 ring-white/10 backdrop-blur-2xl">
				<div className="px-3 pb-2.5 pt-2.5">
					<div className="flex h-[54px] items-stretch gap-1 rounded-[18px] bg-white/[0.05] p-1 ring-1 ring-white/10">
						<motion.button type="button" whileTap={TAP} data-seg="moods" onClick={() => onOpen("moods")} className={`${seg} flex-[1.25] ${c.sel.moods.length ? "bg-white/[0.07] text-white" : "text-gray-300"}`}>
							<MoodDots c={c} />
							<span className="w-full truncate text-center">{moodText(c)}</span>
						</motion.button>
						<motion.button type="button" whileTap={TAP} data-seg="services" onClick={() => onOpen("services")} className={`${seg} flex-1 ${c.sel.everywhere ? "text-gray-300" : "text-white"}`}>
							<Logos c={c} />
							<span className="w-full truncate text-center">{servicesText(c)}</span>
						</motion.button>
						<motion.button type="button" whileTap={TAP} data-seg="sort" onClick={() => onOpen("sort")} className={`${seg} flex-1 text-white`}>
							<ArrowsUpDownIcon className="h-4 w-4 text-amber-400" />
							<span className="w-full truncate text-center">{SORT8[c.sel.by].short}</span>
						</motion.button>
					</div>
				</div>
				<AnimatePresence initial={false}>
					{!hidden && (
						<motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={SPRING} className="overflow-hidden border-t border-white/5">
							<NavRow />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	)
}

// ------------------------------------------------------------------ float: a capsule above the site's nav

function FloatBar({ c, onOpen }: { c: Ctx8; onOpen: (s: Section) => void }) {
	const seg = "flex h-full min-w-0 cursor-pointer items-center gap-2 px-3 text-[13px] font-bold text-white active:bg-white/10"
	return (
		<div className="fixed inset-x-3 bottom-[6.25rem] z-[60] flex justify-center md:hidden" data-mobilebar="float">
			<div className="flex h-12 max-w-full items-stretch divide-x divide-white/10 overflow-hidden rounded-full bg-gray-900/90 shadow-[0_16px_40px_-10px_rgba(0,0,0,.95)] ring-1 ring-white/15 backdrop-blur-xl">
				<motion.button type="button" whileTap={TAP} data-seg="moods" onClick={() => onOpen("moods")} className={`${seg} pl-4`}>
					<MoodDots c={c} size={16} />
					<span className={`truncate ${c.sel.moods.length ? "" : "text-gray-300"}`}>{moodText(c)}</span>
				</motion.button>
				<motion.button type="button" whileTap={TAP} data-seg="services" onClick={() => onOpen("services")} className={`${seg} shrink-0`} aria-label={servicesText(c)}>
					<Logos c={c} size={20} />
				</motion.button>
				<motion.button type="button" whileTap={TAP} data-seg="sort" onClick={() => onOpen("sort")} className={`${seg} shrink-0 pr-4`}>
					<ArrowsUpDownIcon className="h-4 w-4 text-amber-400" />
					<span className="whitespace-nowrap">{SORT8[c.sel.by].short}</span>
				</motion.button>
			</div>
		</div>
	)
}

// ------------------------------------------------------------------ the sheet

function MoodsHead({ c }: { c: Ctx8 }) {
	const k = c.sel.moods.length
	const [hint, setHint] = useState<string | null>(null)
	useEffect(() => {
		if (!c.blocked) return
		setHint(`Three is the most. Remove one to add ${MOOD[c.blocked.m].name}.`)
		const id = setTimeout(() => setHint(null), 3200)
		return () => clearTimeout(id)
	}, [c.blocked?.at])
	return (
		<div className="sticky top-0 z-10 -mx-4 flex min-h-11 items-center gap-3 bg-gray-950/95 px-4 backdrop-blur">
			<AnimatePresence mode="wait" initial={false}>
				{hint ? (
					<motion.p key="hint" role="status" data-hint initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="min-w-0 flex-1 text-sm font-semibold text-amber-300">
						{hint}
					</motion.p>
				) : (
					<motion.h3 key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} className="min-w-0 flex-1 text-base font-bold text-white">
						Moods <span className="text-sm font-normal text-gray-400">up to three</span>
					</motion.h3>
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
		</div>
	)
}

function SheetBody({ c }: { c: Ctx8 }) {
	const c7 = as7(c)
	return (
		<div className="flex flex-col gap-6 px-4 pb-4 pt-1">
			<section data-section="moods" className="scroll-mt-2">
				<MoodsHead c={c} />
				<div className="mt-2 grid grid-cols-2 gap-2">
					{MOODS.map(({ key: m, name }) => {
						const on = c.sel.moods.includes(m)
						const off = full(c7, m)
						return (
							<motion.button
								key={m}
								type="button"
								role="checkbox"
								aria-checked={on}
								aria-disabled={off || undefined}
								aria-label={`${name}. ${countWords(c7, m)}.`}
								data-mood={m}
								onClick={() => (buzz(), c.tap(m))}
								whileTap={{ scale: off ? 1 : 0.97 }}
								className={`relative isolate flex h-[4.75rem] cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-opacity ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${off ? "opacity-40" : ""}`}
								style={{ boxShadow: on ? `0 8px 24px -10px ${MOOD[m].hue}` : undefined }}
							>
								<MoodArt m={m} art={c.per[m].art} />
								<span className="flex items-start justify-between gap-2">
									<span className="text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{name}</span>
									<span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`}>{on && <CheckIcon className="h-3.5 w-3.5" />}</span>
								</span>
								<span className="text-[11px] font-semibold tabular-nums text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">{countWords(c7, m)}</span>
							</motion.button>
						)
					})}
				</div>
			</section>

			<section data-section="services" className="scroll-mt-2">
				<h3 className="text-base font-bold text-white">Where to watch</h3>
				<button
					type="button"
					role="switch"
					aria-checked={!c.sel.everywhere}
					data-services
					onClick={() => (buzz(), c.setSel({ ...c.sel, everywhere: !c.sel.everywhere }))}
					className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/[0.05] p-3 text-left ring-1 ring-white/10"
				>
					<Logos c={{ ...c, sel: { ...c.sel, everywhere: false } }} size={28} />
					<span className="min-w-0 flex-1">
						<span className="block text-sm font-bold text-white">On my services</span>
						<span className="block text-xs text-gray-400">{c.sel.everywhere ? "Off: titles on any service count the same." : "What you can play right now comes first."}</span>
					</span>
					<span className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${c.sel.everywhere ? "bg-white/15" : "bg-emerald-500"}`}>
						<motion.span layout transition={SPRING} className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${c.sel.everywhere ? "left-1" : "right-1"}`} />
					</span>
				</button>
			</section>

			<section data-section="sort" className="scroll-mt-2">
				<h3 className="text-base font-bold text-white">Sort</h3>
				<div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sort">
					{SORTS8.map((s) => {
						const on = c.sel.by === s.key
						return (
							<motion.button
								key={s.key}
								type="button"
								role="radio"
								aria-checked={on}
								data-sort={s.key}
								whileTap={TAP}
								onClick={() => (buzz(), c.setSel({ ...c.sel, by: s.key }))}
								className={`flex cursor-pointer flex-col items-start rounded-xl p-2.5 text-left transition-colors ${on ? "bg-amber-400 text-black" : "bg-white/[0.05] text-white ring-1 ring-white/10"}`}
							>
								<span className="text-sm font-bold">{s.label}</span>
								<span className={`mt-0.5 line-clamp-2 text-[11px] leading-snug ${on ? "text-black/70" : "text-gray-400"}`}>{s.line}</span>
							</motion.button>
						)
					})}
				</div>
			</section>
		</div>
	)
}

function Footer({ c, onDone }: { c: Ctx8; onDone: () => void }) {
	const what = !c.v.need ? `${c.q.count} titles` : c.sel.moods.length ? `${c.n} that fit` : `${c.n} on your services`
	return (
		<div className="shrink-0 border-t border-white/10 bg-gray-950/95 px-4 pb-4 pt-3">
			<motion.button type="button" whileTap={TAP} onClick={onDone} data-sheetdone className="h-12 w-full cursor-pointer rounded-2xl bg-white text-base font-bold text-black">
				{c.q.count ? `Show ${what}` : "Done"}
			</motion.button>
		</div>
	)
}

// The bar plus its sheet. `snap` is the sheet's snap index, -1 closed.
export function MobileControls({ c, kind }: { c: Ctx8; kind: BarKind }) {
	const [snap, setSnap] = useState(-1)
	const [focus, setFocus] = useState<Section>("moods")
	const open = (s: Section) => (buzz(), setFocus(s), setSnap(0))
	// Bring the tapped part into view once the sheet's content is in the page.
	useEffect(() => {
		if (snap < 0) return
		const id = setTimeout(() => document.querySelector(`[data-sheet8] [data-section=${focus}]`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 120)
		return () => clearTimeout(id)
	}, [snap < 0, focus])
	return (
		<div className="md:hidden" data-sheet8 data-snap={snap}>
			{/* The slab replaces the site's nav on a phone; the dev-only query button would sit on the bar. */}
			<style>{`@media (max-width: 767px){${kind === "slab" ? "div.fixed.bottom-0.left-0.z-50.w-full.border-t," : ""}.tsqd-open-btn-container{display:none!important}}`}</style>
			{kind === "slab" ? <SlabBar c={c} onOpen={open} /> : <FloatBar c={c} onOpen={open} />}
			<DragSheet index={snap} onIndex={setSnap} snaps={[0.62, 0.96]} backdropFrom={0} label="Moods, services, and sort" footer={snap >= 0 && <Footer c={c} onDone={() => setSnap(-1)} />}>
				<SheetBody c={c} />
			</DragSheet>
		</div>
	)
}

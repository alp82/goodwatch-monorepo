// PROTOTYPE - throwaway. The settled bar for /prototype/rec-discover-3 (#179, round 3), shared by every variant:
// desktop studio row plus sub-bar, mobile slab, no big count, and round 2's `motion` For you control with `split`'s
// amber glow and the fingerprint icon inside it (hover or tap the icon for what For you does).
// Variants only differ in where the query lives, so the shell has slots for a page head, a lead in the row,
// a query chip in the sub-bar, and the slab's top line. Round 2's row pieces aren't exported, so they're copied
// here with layout ids of their own; exported atoms (Knob, Pop, SlabMenu) are imported.
import { AdjustmentsHorizontalIcon, ArrowUpIcon, ArrowsUpDownIcon, CheckIcon, ChevronDownIcon, EyeIcon, EyeSlashIcon, GlobeAltIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { Knob, MENU, Pop, SEG, SHELL, SlabMenu } from "~/ui/prototype-rec-discover-2/bar2"
import { listSentence } from "~/ui/prototype-rec-discover/rank"
import type { SearchList } from "~/ui/prototype-rec-discover/types"
import { DragSheet, FilterPanel, HiddenMeter, NavTabs, RecoveryList, RollingNumber, SPRING, SearchField, ServiceStack, ShowButton, TAP, buzz, clearMoreFilters, useCosts, useScrollHide } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { activeChips } from "~/ui/prototype-rec-filter-bar/kit"
import type { Bar } from "~/ui/prototype-rec-filter-bar/model"
import { type D3, SEARCH_MAX_MOVE, matchQuery, sortLabel, sortsFor, suggestions, wantWords } from "./rank3"

export { Knob, MENU, Pop, SEG, SHELL, SlabMenu }

// ---------------------------------------------------------------- For you: explanation

export function ForYouExplain({ d, className = "" }: { d: D3; className?: string }) {
	const who = d.data.who
	const search = d.mode === "search"
	return (
		<div className={className}>
			<p className="flex items-center gap-2 text-sm font-bold text-white">
				<FingerPrintIcon className="h-4 w-4 text-amber-400" />
				For you
				<span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${d.forYou ? "bg-amber-500 text-gray-950" : "text-gray-400 ring-1 ring-inset ring-white/15"}`}>{d.forYou ? "On" : "Off"}</span>
			</p>
			<p className="mt-2 text-[13px] leading-relaxed text-gray-300">
				{search
					? `Your search stays in charge. Taste only swaps close matches, so a result moves ${SEARCH_MAX_MOVE} places at most.`
					: `Leans ${sortLabel(d)} toward titles you'd likely rate highly, learned from ${who.mode === "demo" ? "the demo member's" : "your"} ${who.rated.toLocaleString("en")} ratings. It reorders; nothing is hidden.`}
			</p>
			<p className={`mt-2 text-[13px] ${d.forYou ? "text-amber-300" : "text-gray-500"}`}>
				{!d.forYou ? "Off: the same order everyone sees." : d.moves ? `Right now ${d.moves} ${search ? "results" : "titles"} moved up${search ? `, the furthest by ${d.maxMove}` : ""}.` : "Right now your taste agrees with this order."}
			</p>
		</div>
	)
}

// Hover (mouse), focus (keyboard) or tap (touch) the icon to show the explanation. Fixed width, never resizes.
function FingerTip({ d, on }: { d: D3; on: boolean }) {
	const [open, setOpen] = useState(false)
	const id = useId()
	const ref = useRef<HTMLSpanElement>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => {
		if (!open) return
		const down = (e: Event) => !ref.current?.contains(e.target as Node) && setOpen(false)
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [open])
	const show = () => (clearTimeout(timer.current), setOpen(true))
	const hide = () => (clearTimeout(timer.current), (timer.current = setTimeout(() => setOpen(false), 120)))
	return (
		<span ref={ref} className="relative flex h-full items-center" onPointerEnter={(e) => e.pointerType === "mouse" && show()} onPointerLeave={(e) => e.pointerType === "mouse" && hide()}>
			<button
				type="button"
				aria-label="What For you does"
				aria-describedby={open ? id : undefined}
				onFocus={show}
				onBlur={hide}
				onClick={() => setOpen((o) => !o)}
				className={`grid h-9 w-9 place-items-center rounded-xl cursor-help transition-colors ${on ? "text-amber-400 hover:bg-amber-500/15" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"}`}
			>
				<FingerPrintIcon className="h-5 w-5" />
			</button>
			<AnimatePresence>
				{open && (
					<motion.div
						id={id}
						role="tooltip"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.14 }}
						className={`absolute top-full left-0 z-50 mt-3 w-[320px] p-4 ${MENU}`}
					>
						<ForYouExplain d={d} />
					</motion.div>
				)}
			</AnimatePresence>
		</span>
	)
}

// ---------------------------------------------------------------- For you: the desktop control

function MovesCount({ d, className = "" }: { d: D3; className?: string }) {
	return (
		<span className={`inline-flex items-center gap-0.5 tabular-nums ${d.forYou && d.moves ? "text-amber-300" : "text-transparent"} ${className}`}>
			<ArrowUpIcon className="h-3 w-3" />
			{d.moves}
		</span>
	)
}

// round 2's `motion` control (next to the sort, "↑29 moved") in `split`'s amber glow, with the fingerprint inside.
export function ForYouDesk({ d }: { d: D3 }) {
	const on = d.forYou
	return (
		<div
			className={`relative flex h-12 w-56 items-center rounded-2xl pl-1.5 transition-[background-color,box-shadow] duration-300 ${
				on
					? "bg-amber-500/[0.14] ring-1 ring-amber-500/45 shadow-[0_0_30px_-8px_rgba(245,158,11,.6),inset_0_1px_0_rgba(255,255,255,.06)]"
					: "bg-white/[0.04] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
			}`}
		>
			<FingerTip d={d} on={on} />
			<motion.button
				type="button"
				role="switch"
				aria-checked={on}
				aria-label="For you"
				whileTap={TAP}
				onClick={() => (buzz(), d.setForYou(!on))}
				className={`flex h-full flex-1 items-center gap-2 pr-4 pl-1.5 text-sm font-bold whitespace-nowrap cursor-pointer ${on ? "text-amber-100" : "text-gray-400 hover:text-gray-200"}`}
			>
				<span className="flex-1 text-left">For you</span>
				<MovesCount d={d} className="w-9 justify-end text-xs" />
				<Knob on={on} />
			</motion.button>
		</div>
	)
}

// ---------------------------------------------------------------- sort

function SortRows3({ d, onPick, dense = false, id }: { d: D3; onPick?: () => void; dense?: boolean; id: string }) {
	return (
		<div className="flex flex-col">
			<AnimatePresence initial={false}>
				{sortsFor(d.mode).map((s) => {
					const on = s.key === d.sort
					return (
						<motion.button
							key={s.key}
							type="button"
							role="menuitemradio"
							aria-checked={on}
							whileTap={TAP}
							onClick={() => (buzz(), d.setSort(s.key), onPick?.())}
							className={`relative flex items-center gap-3 rounded-xl px-3 ${dense ? "py-2" : "py-2.5"} text-left cursor-pointer ${on ? "" : "hover:bg-white/5"}`}
						>
							{on && <motion.span layoutId={`d3-sort-hl-${id}`} transition={SPRING} className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10" />}
							<span className="relative flex-1">
								<span className={`block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}>{s.label}</span>
								<span className="block text-xs text-gray-500">{s.hint}</span>
							</span>
							<CheckIcon className={`relative h-4 w-4 text-white ${on ? "" : "invisible"}`} />
						</motion.button>
					)
				})}
			</AnimatePresence>
			{d.mode === "browse" && <p className="px-3 pt-1.5 pb-2 text-xs text-gray-500">Relevance joins once you search.</p>}
		</div>
	)
}

// Fixed width trigger; the label rolls when a query switches it to Relevance and back.
export function SortDesk({ d }: { d: D3 }) {
	return (
		<Pop
			width={288}
			trigger={(open, toggle) => (
				<motion.button type="button" whileTap={TAP} aria-expanded={open} aria-haspopup="menu" onClick={toggle} className={`flex h-12 w-52 items-center gap-2 px-4 text-sm cursor-pointer ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}>
					<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
					<span className="text-gray-400">Sort</span>
					<span className="relative flex-1 overflow-hidden text-left">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span key={d.sort} initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={SPRING} className="block truncate font-bold text-white">
								{sortLabel(d)}
							</motion.span>
						</AnimatePresence>
					</span>
					<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
				</motion.button>
			)}
		>
			{(close) => (
				<div className="p-1.5">
					<SortRows3 d={d} onPick={close} id="desk" />
				</div>
			)}
		</Pop>
	)
}

// ---------------------------------------------------------------- the studio row pieces (copied from round 2)

function ServicesSeg({ bar }: { bar: Bar }) {
	const on = bar.filters.mine
	const seg = "relative z-10 flex h-full items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors"
	return (
		<div role="radiogroup" aria-label="Where to watch" className={`relative flex h-12 p-1 ${SHELL}`}>
			<motion.button type="button" whileTap={TAP} role="radio" aria-checked={on} onClick={() => (buzz(), bar.set({ mine: true, providers: [] }))} className={`${seg} w-48 ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
				{on && <motion.span layoutId="d3-svc" transition={SPRING} className="absolute inset-0 -z-10 rounded-xl bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]" />}
				<ServiceStack bar={bar} on={on} size={20} />
				On my services
			</motion.button>
			<motion.button type="button" whileTap={TAP} role="radio" aria-checked={!on} onClick={() => (buzz(), bar.set({ mine: false }))} className={`${seg} w-32 ${!on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
				{!on && <motion.span layoutId="d3-svc" transition={SPRING} className="absolute inset-0 -z-10 rounded-xl bg-white/10 ring-1 ring-white/15" />}
				<GlobeAltIcon className="h-4 w-4" />
				Everywhere
			</motion.button>
		</div>
	)
}

function NotSeenSwitch({ bar }: { bar: Bar }) {
	const on = bar.filters.notSeen
	const cost = useCosts(bar).notSeen
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			role="switch"
			aria-checked={on}
			onClick={() => (buzz(), bar.set({ notSeen: !on }))}
			className={`relative flex h-12 w-48 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors ${SHELL} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
		>
			{on ? <EyeSlashIcon className="h-4 w-4 text-blue-400" /> : <EyeIcon className="h-4 w-4" />}
			<span className="flex-1 text-left">Not seen yet</span>
			<span className={`w-7 text-right text-xs tabular-nums ${on && cost ? "text-blue-300/80" : "text-transparent"}`}>−{cost}</span>
			<span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,.6)]" : "bg-white/15"}`}>
				<motion.span layout transition={SPRING} className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow ${on ? "right-0.5" : "left-0.5"}`} />
			</span>
		</motion.button>
	)
}

function FiltersButton({ bar, onClick, compact = false }: { bar: Bar; onClick: () => void; compact?: boolean }) {
	return (
		<motion.button type="button" whileTap={TAP} onClick={onClick} aria-label="Filters" className={`flex h-12 items-center gap-2 text-sm font-bold text-white cursor-pointer ${compact ? "px-3.5" : "px-4"} ${SHELL} hover:ring-white/25`}>
			<AdjustmentsHorizontalIcon className="h-4 w-4" />
			{!compact && "Filters"}
			<span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs tabular-nums ${bar.moreCount ? "bg-amber-500 text-gray-950" : "bg-white/10 text-gray-400"}`}>{bar.moreCount}</span>
		</motion.button>
	)
}

const DOT: Record<string, string> = { teal: "bg-teal-400", amber: "bg-amber-400", indigo: "bg-indigo-400", slate: "bg-lime-400", cyan: "bg-cyan-400", emerald: "bg-emerald-400", rose: "bg-rose-400", purple: "bg-purple-400" }

function Tokens({ bar, lead, className = "" }: { bar: Bar; lead?: ReactNode; className?: string }) {
	const chips = activeChips(bar)
	return (
		<AnimatePresence initial={false}>
			{(chips.length > 0 || lead) && (
				<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`overflow-hidden ${className}`}>
					<div className="flex flex-wrap items-center gap-2 pt-1">
						{lead}
						<AnimatePresence initial={false} mode="popLayout">
							{chips.map((c) => (
								<motion.button
									layout
									key={c.key}
									type="button"
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.85 }}
									transition={SPRING}
									whileTap={TAP}
									onClick={() => (buzz(), c.remove())}
									aria-label={`Remove ${c.label}`}
									className="group flex h-8 items-center gap-2 rounded-full bg-white/[0.06] pl-3 pr-2 text-sm text-gray-100 ring-1 ring-white/10 hover:bg-white/10 cursor-pointer"
								>
									<span className={`h-1.5 w-1.5 rounded-full ${DOT[c.color] ?? "bg-gray-400"}`} />
									{c.label}
									<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" />
								</motion.button>
							))}
						</AnimatePresence>
						{chips.length > 0 && (
							<button type="button" onClick={() => clearMoreFilters(bar)} className="ml-1 text-sm text-gray-500 hover:text-white cursor-pointer">
								Clear filters
							</button>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------- the insight line, in both states

// Browse: "62 showing, 158 hidden by your filters". Search: "18 matches for heist comedy, 12 hidden by your filters".
export function CountText({ d, withQuery = true }: { d: D3; withQuery?: boolean }) {
	const bar = d.bar
	return (
		<span className="text-sm text-gray-400">
			<RollingNumber value={bar.results.length} className="font-bold text-white" />
			{d.query ? (
				<>
					{" "}
					{bar.results.length === 1 ? "match" : "matches"}
					{withQuery && (
						<>
							{" "}
							for <span className="font-bold text-gray-100">{d.query.q}</span>
						</>
					)}
				</>
			) : (
				" showing"
			)}
			{bar.hidden > 0 && (
				<>
					, <RollingNumber value={bar.hidden} /> hidden by your filters
				</>
			)}
		</span>
	)
}

// When typed text was mapped to a captured query, say so. Fuchsia marks prototype-only notes, like the switcher.
export function MappedNote({ d, className = "" }: { d: D3; className?: string }) {
	if (!d.typed || !d.query) return null
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-fuchsia-200 border border-dashed border-fuchsia-400/50 ${className}`}>
			Prototype: “{d.typed}” shows the captured search “{d.query.q}”
		</span>
	)
}

export function ReadingLine({ d, className = "" }: { d: D3; className?: string }) {
	if (!d.query) return null
	const wants = wantWords(d.query)
	return (
		<p className={`text-sm text-gray-500 ${className}`}>
			Read as <span className="text-gray-300">{listSentence(wants)}</span>.{" "}
			{d.forYou ? `For you only swaps close matches, ${SEARCH_MAX_MOVE} places at most.` : "Pure relevance, taste is off."}
		</p>
	)
}

function Insight({ d, lead, withQuery, reading }: { d: D3; lead?: ReactNode; withQuery: boolean; reading: boolean }) {
	const bar = d.bar
	const top = bar.recoveries.slice(0, 2)
	return (
		<div className="mt-5">
			<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
				{lead}
				<div className="flex items-center gap-3">
					<HiddenMeter bar={bar} className="w-32" />
					<CountText d={d} withQuery={withQuery} />
				</div>
				{top.map((r) => (
					<motion.button key={r.key} type="button" whileTap={TAP} onClick={() => (buzz(), bar.drop(r.key))} className="flex items-center gap-1.5 text-sm font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
						<PlusIcon className="h-3.5 w-3.5" />
						{r.key === "mine" ? `${r.count} on other services` : r.key === "notSeen" ? `${r.count} you've seen` : `${r.count} ${r.label}`}
					</motion.button>
				))}
				<MappedNote d={d} />
			</div>
			{reading && <ReadingLine d={d} className="mt-2" />}
		</div>
	)
}

function SideSheet({ bar, open, onClose }: { bar: Bar; open: boolean; onClose: () => void }) {
	const [q, setQ] = useState("")
	useEffect(() => {
		if (!open) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		document.addEventListener("keydown", key)
		return () => document.removeEventListener("keydown", key)
	}, [open, onClose])
	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div className="fixed inset-0 z-[1001] bg-black/60 backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
					<motion.aside
						role="dialog"
						aria-label="Filters"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 380, damping: 40 }}
						className="fixed inset-y-0 right-0 z-[1002] flex w-full max-w-[480px] flex-col bg-gray-950 ring-1 ring-white/10 shadow-[-30px_0_80px_-20px_rgba(0,0,0,.9)]"
					>
						<header className="px-6 pt-6 pb-4">
							<div className="flex items-center justify-between">
								<h2 className="brand-header text-2xl text-white">Filters</h2>
								<button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-gray-300 hover:bg-white/10 cursor-pointer">
									<XMarkIcon className="h-5 w-5" />
								</button>
							</div>
							<SearchField value={q} onChange={setQ} autoFocus className="mt-4" />
						</header>
						<div className="flex-1 overflow-y-auto px-6 pb-8 pt-2">
							<FilterPanel bar={bar} query={q} />
						</div>
						<footer className="flex items-center gap-4 border-t border-white/5 bg-gray-950/90 px-6 py-4 backdrop-blur">
							<button type="button" onClick={() => clearMoreFilters(bar)} className="text-sm text-gray-400 hover:text-white cursor-pointer">
								Clear all
							</button>
							<span className="flex-1 text-right text-xs text-gray-500">{bar.hidden ? `${bar.hidden} hidden` : ""}</span>
							<ShowButton bar={bar} onClick={onClose} />
						</footer>
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------- the slab (copied from round 2, For you + sort built in)

function FirstClass({ bar }: { bar: Bar }) {
	const f = bar.filters
	const costs = useCosts(bar)
	return (
		<div className="flex flex-col gap-2.5">
			<div role="radiogroup" aria-label="Where to watch" className="relative grid h-16 grid-cols-2 rounded-2xl bg-white/[0.05] p-1 ring-1 ring-white/10">
				{[true, false].map((mine) => {
					const on = f.mine === mine
					return (
						<motion.button key={String(mine)} type="button" role="radio" aria-checked={on} whileTap={TAP} onClick={() => (buzz(), bar.set({ mine, providers: [] }))} className="relative flex flex-col items-center justify-center rounded-xl cursor-pointer">
							{on && <motion.span layoutId="d3-fc-svc" transition={SPRING} className={`absolute inset-0 rounded-xl ${mine ? "bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : "bg-white/10 ring-1 ring-white/15"}`} />}
							<span className={`relative flex items-center gap-2 text-sm font-bold ${on ? "text-white" : "text-gray-400"}`}>
								{mine ? <ServiceStack bar={bar} on={on} size={18} /> : <GlobeAltIcon className="h-4 w-4" />}
								{mine ? "My services" : "Everywhere"}
							</span>
							<span className={`relative mt-0.5 text-[11px] ${on ? "text-white/70" : "text-gray-500"}`}>{mine ? "Your saved services" : f.mine ? `+${costs.mine} more titles` : "Every service"}</span>
						</motion.button>
					)
				})}
			</div>
			<motion.button
				type="button"
				role="switch"
				aria-checked={f.notSeen}
				whileTap={TAP}
				onClick={() => (buzz(), bar.set({ notSeen: !f.notSeen }))}
				className={`flex h-14 items-center gap-3 rounded-2xl px-4 ring-1 cursor-pointer transition-colors ${f.notSeen ? "bg-blue-900/40 ring-blue-400/30" : "bg-white/[0.05] ring-white/10"}`}
			>
				{f.notSeen ? <EyeSlashIcon className="h-5 w-5 text-blue-400" /> : <EyeIcon className="h-5 w-5 text-gray-400" />}
				<span className="flex-1 text-left">
					<span className="block text-sm font-bold text-white">Not seen yet</span>
					<span className="block text-[11px] text-gray-400">{f.notSeen ? `Hiding ${costs.notSeen} you watched or rated` : "Showing titles you've seen too"}</span>
				</span>
				<Knob on={f.notSeen} size="lg" className={f.notSeen ? "!bg-blue-600 !shadow-[0_0_16px_rgba(37,99,235,.55)]" : ""} />
			</motion.button>
		</div>
	)
}

function ForYouRow3({ d, compact = false }: { d: D3; compact?: boolean }) {
	const on = d.forYou
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label="For you"
			whileTap={TAP}
			onClick={() => (buzz(), d.setForYou(!on))}
			className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left cursor-pointer transition-colors ${on ? "bg-amber-500/[0.14] ring-1 ring-amber-500/45 shadow-[0_0_24px_-10px_rgba(245,158,11,.7)]" : "bg-white/[0.04] ring-1 ring-white/10"}`}
		>
			<FingerPrintIcon className={`h-5 w-5 shrink-0 ${on ? "text-amber-400" : "text-gray-500"}`} />
			<span className="min-w-0 flex-1">
				<span className={`block text-sm font-bold ${on ? "text-amber-100" : "text-gray-300"}`}>For you</span>
				<span className={`${compact ? "hidden" : "block"} text-xs ${on ? "text-amber-200/70" : "text-gray-500"}`}>{!on ? "Same order for everyone" : d.mode === "search" ? `Moves a result ${SEARCH_MAX_MOVE} places at most` : "Titles you'd rate highly rise"}</span>
			</span>
			<Knob on={on} />
		</motion.button>
	)
}

function SortGrid3({ d }: { d: D3 }) {
	return (
		<div className="grid grid-cols-2 gap-2">
			{sortsFor(d.mode).map((s) => {
				const on = s.key === d.sort
				return (
					<motion.button key={s.key} type="button" whileTap={TAP} aria-pressed={on} onClick={() => (buzz(), d.setSort(s.key))} className="relative h-16 rounded-2xl bg-white/[0.03] px-3.5 text-left ring-1 ring-white/10 cursor-pointer">
						{on && <motion.span layoutId="d3-sort-grid" transition={SPRING} className="absolute inset-0 rounded-2xl bg-white/[0.08] ring-1 ring-white/30" />}
						<span className={`relative block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}>{s.label}</span>
						<span className="relative block truncate text-[11px] text-gray-500">{s.hint}</span>
					</motion.button>
				)
			})}
		</div>
	)
}

function Block({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
	return (
		<section className="px-4 pt-5">
			<div className="mb-2.5 flex items-baseline justify-between">
				<h3 className="text-[15px] font-bold text-white">{title}</h3>
				{right}
			</div>
			{children}
		</section>
	)
}

function SheetBody({ d }: { d: D3 }) {
	const bar = d.bar
	const [q, setQ] = useState("")
	return (
		<div className="pb-6">
			{bar.hidden > 0 && (
				<Block title={`${bar.hidden} hidden by your filters`} right={<HiddenMeter bar={bar} className="w-24" />}>
					<div className="-mx-3">
						<RecoveryList bar={bar} />
					</div>
				</Block>
			)}
			<Block title="Sort">
				<SortGrid3 d={d} />
				<div className="mt-2">
					<ForYouRow3 d={d} />
				</div>
			</Block>
			<Block
				title="More filters"
				right={
					bar.moreCount > 0 && (
						<button type="button" onClick={() => clearMoreFilters(bar)} className="text-xs text-gray-400 cursor-pointer">
							Clear {bar.moreCount}
						</button>
					)
				}
			>
				<SearchField value={q} onChange={setQ} />
				<FilterPanel bar={bar} query={q} className="mt-5" />
			</Block>
			<Block title="Show me">
				<FirstClass bar={bar} />
			</Block>
		</div>
	)
}

// The slab's For you segment: amber when on, "↑3" above the label. The fingerprint is its own tap target and opens
// the explanation (with the switch) above the thumb; the rest of the segment flips the switch.
function SlabForYou({ d, openTip }: { d: D3; openTip: () => void }) {
	const on = d.forYou
	return (
		<div className={`${SEG} !flex-[0.85] !p-0 ${on ? "text-gray-950" : "text-gray-400"}`}>
			<AnimatePresence initial={false}>
				{on && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 rounded-[14px] bg-linear-to-b from-amber-400 to-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_0_22px_-4px_rgba(245,158,11,.7)]" />}
			</AnimatePresence>
			<motion.button type="button" role="switch" aria-checked={on} aria-label="For you" whileTap={TAP} onClick={() => (buzz(), d.setForYou(!on))} className="absolute inset-0 flex flex-col items-center justify-end gap-0.5 rounded-[14px] pb-[7px] cursor-pointer">
				<span className="relative">For you</span>
			</motion.button>
			<button type="button" data-slab-trigger aria-label="What For you does" onClick={() => (buzz(), openTip())} className="absolute top-[3px] left-1/2 z-10 flex h-[18px] -translate-x-1/2 items-center justify-center gap-1 rounded-full px-1.5 cursor-pointer">
				<FingerPrintIcon className={`h-4 w-4 ${on ? "text-gray-950/80" : "text-amber-500/80"}`} />
				{on && d.moves > 0 && (
					<span className="flex items-center text-[10px] font-black tabular-nums">
						<ArrowUpIcon className="h-2.5 w-2.5" />
						{d.moves}
					</span>
				)}
			</button>
		</div>
	)
}

export type SlabSlots = {
	above?: ReactNode // a line inside the slab above the strip, always shown (e.g. the query field)
	line?: ReactNode // replaces the "N hidden by filters" line, always shown
}

function Slab({ d, slots }: { d: D3; slots: SlabSlots }) {
	const bar = d.bar
	const { hidden } = useScrollHide()
	const [sheet, setSheet] = useState(-1)
	const [menu, setMenu] = useState<"sort" | "tip" | null>(null)
	const f = bar.filters
	const top = bar.recoveries[0]
	return (
		<>
			<div className="fixed inset-x-0 bottom-0 z-[60]">
				<motion.div layout transition={SPRING} className="relative rounded-t-[26px] bg-gray-950/90 ring-1 ring-white/10 backdrop-blur-2xl shadow-[0_-20px_50px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]">
					{slots.line ? (
						<div className="px-4 pt-3">{slots.line}</div>
					) : (
						<AnimatePresence initial={false}>
							{!hidden && (bar.hidden > 0 || d.query) && (
								<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
									<div className="flex items-center gap-2.5 px-4 pt-3 text-xs">
										<HiddenMeter bar={bar} className="w-12 shrink-0" />
										<span className="truncate whitespace-nowrap text-gray-400">
											<RollingNumber value={d.query ? bar.results.length : bar.hidden} className="font-bold text-white" /> {d.query ? "matches" : "hidden by filters"}
											{d.query && bar.hidden > 0 && `, ${bar.hidden} hidden`}
										</span>
										{top && (
											<motion.button type="button" whileTap={TAP} onClick={() => (buzz(), bar.drop(top.key))} className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap font-bold text-amber-400 cursor-pointer">
												<PlusIcon className="h-3 w-3" />
												{top.key === "mine" ? `${top.count} other services` : top.key === "notSeen" ? `${top.count} you've seen` : `${top.count} more`}
											</motion.button>
										)}
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					)}
					{slots.above && <div className="px-3 pt-2.5">{slots.above}</div>}
					<div className="flex items-center gap-2 px-3 pt-2.5 pb-2.5">
						<div className="flex h-[52px] min-w-0 flex-1 items-stretch gap-1 rounded-[18px] bg-white/[0.05] p-1 ring-1 ring-white/10">
							<motion.button type="button" whileTap={TAP} aria-pressed={f.mine} onClick={() => (buzz(), bar.set({ mine: !f.mine, providers: [] }))} className={`${SEG} ${f.mine ? "text-white" : "text-gray-400"}`}>
								{f.mine && <motion.span layoutId="d3-slab-mine" className="absolute inset-0 rounded-[14px] bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" />}
								<span className="relative">{f.mine ? <ServiceStack bar={bar} on size={16} /> : <GlobeAltIcon className="h-4 w-4" />}</span>
								<span className="relative w-full truncate px-0.5 text-center">{f.mine ? "My services" : "Everywhere"}</span>
							</motion.button>
							<motion.button type="button" whileTap={TAP} aria-pressed={f.notSeen} onClick={() => (buzz(), bar.set({ notSeen: !f.notSeen }))} className={`${SEG} ${f.notSeen ? "text-white" : "text-gray-400"}`}>
								{f.notSeen && <motion.span layoutId="d3-slab-seen" className="absolute inset-0 rounded-[14px] bg-linear-to-b from-blue-600 to-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" />}
								<span className="relative">{f.notSeen ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}</span>
								<span className="relative w-full truncate px-0.5 text-center">{f.notSeen ? "Not seen" : "Seen too"}</span>
							</motion.button>
							<SlabForYou d={d} openTip={() => setMenu((m) => (m === "tip" ? null : "tip"))} />
							<motion.button
								type="button"
								data-slab-trigger
								whileTap={TAP}
								aria-expanded={menu === "sort"}
								aria-haspopup="menu"
								aria-label={`Sort: ${sortLabel(d)}`}
								onClick={() => (buzz(), setMenu((m) => (m === "sort" ? null : "sort")))}
								className={`${SEG} ${menu === "sort" ? "bg-white/10 text-white" : "text-gray-200"}`}
							>
								<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
								<span className="relative w-full overflow-hidden px-1 text-center">
									<AnimatePresence mode="popLayout" initial={false}>
										<motion.span key={d.sort} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={SPRING} className="block truncate">
											{sortLabel(d)}
										</motion.span>
									</AnimatePresence>
								</span>
							</motion.button>
						</div>
						<motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => (buzz(), setSheet(0))} aria-label="More filters" className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer">
							<AdjustmentsHorizontalIcon className="h-5 w-5" />
							{bar.moreCount > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950">{bar.moreCount}</span>}
						</motion.button>
					</div>
					<SlabMenu open={menu === "sort"} onClose={() => setMenu(null)}>
						<div className="p-1.5">
							<SortRows3 d={d} onPick={() => setMenu(null)} dense id="slab" />
						</div>
					</SlabMenu>
					<SlabMenu open={menu === "tip"} onClose={() => setMenu(null)} width={320}>
						<div role="tooltip" className="p-4">
							<ForYouExplain d={d} />
							<div className="mt-3">
								<ForYouRow3 d={d} compact />
							</div>
						</div>
					</SlabMenu>
					<AnimatePresence initial={false}>
						{!hidden && (
							<motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={SPRING} className="overflow-hidden border-t border-white/5">
								<NavTabs inlineTaste />
							</motion.div>
						)}
					</AnimatePresence>
				</motion.div>
			</div>
			<DragSheet
				index={sheet}
				onIndex={setSheet}
				snaps={[0.58, 0.94]}
				backdropFrom={0}
				footer={
					sheet >= 0 && (
						<div className="shrink-0 border-t border-white/5 bg-gray-950/90 px-4 pt-3 pb-5">
							<ShowButton bar={bar} onClick={() => setSheet(-1)} className="w-full" />
						</div>
					)
				}
			>
				<SheetBody d={d} />
			</DragSheet>
			{/* The slab replaces the site's own bottom nav on phones; the dev-only TanStack button steps aside too. */}
			<style>{"@media (max-width: 1023px){div.fixed.bottom-0.left-0.z-50.w-full.border-t,.tsqd-open-btn-container{display:none!important}}"}</style>
		</>
	)
}

// ---------------------------------------------------------------- the query: typing, suggestions, the prototype hint

// A draft that commits while typing (debounced) and on Enter. Empty text returns to browsing.
export function useDraft(d: D3, delay = 650) {
	const [draft, setDraftState] = useState(d.typed ?? d.query?.q ?? "")
	const [noMatch, setNoMatch] = useState(false)
	const latest = useRef(d)
	latest.current = d
	const timer = useRef<ReturnType<typeof setTimeout>>()
	// Follow the URL when the query changes elsewhere (a suggestion, a clear, another input).
	const shown = d.typed ?? d.query?.q ?? ""
	const last = useRef(shown)
	useEffect(() => {
		if (last.current !== shown) {
			last.current = shown
			setDraftState(shown)
			setNoMatch(false)
		}
	}, [shown])
	const run = (text: string) => {
		const cur = latest.current
		if (!text.trim()) {
			setNoMatch(false)
			if (cur.query) cur.clear()
			return
		}
		const m = cur.submit(text)
		setNoMatch(!m.hit)
		if (m.hit) last.current = m.exact ? m.hit.q : text.trim()
	}
	useEffect(() => () => clearTimeout(timer.current), [])
	return {
		draft,
		noMatch,
		setDraft: (text: string) => {
			setDraftState(text)
			clearTimeout(timer.current)
			timer.current = setTimeout(() => run(text), delay)
		},
		enter: () => (clearTimeout(timer.current), run(draft)),
		clear: () => {
			clearTimeout(timer.current)
			setDraftState("")
			setNoMatch(false)
			last.current = ""
			latest.current.clear()
		},
	}
}

export type Draft = ReturnType<typeof useDraft>

// The captured searches, taste-fitting ones first. `hint` turns the header into the prototype note.
export function SuggestList({ d, hint = false, onPick, className = "" }: { d: D3; hint?: boolean; onPick?: () => void; className?: string }) {
	const list = suggestions(d)
	return (
		<div className={className}>
			<p className={`px-3 pt-2 pb-1.5 text-xs ${hint ? "text-fuchsia-200" : "text-gray-500"}`}>{hint ? "Prototype: no captured search fits. Pick one of these queries." : "Try a search"}</p>
			{list.map(({ s, forYou }) => (
				<button
					key={s.q}
					type="button"
					onMouseDown={(e) => e.preventDefault()}
					onClick={() => (buzz(), d.pick(s), onPick?.())}
					className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm cursor-pointer hover:bg-white/5 ${d.query?.q === s.q ? "text-white" : "text-gray-300"}`}
				>
					<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
					<span className="flex-1 truncate">{s.q}</span>
					{forYou && <FingerPrintIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/80" aria-label="Fits your taste" />}
				</button>
			))}
		</div>
	)
}

// A query input with the suggestions under it while focused and empty (or when nothing fits). Fixed popover width.
export function QueryInput({
	d,
	dr,
	placeholder = "Search titles, moods or stories",
	className = "",
	inputClass = "",
	icon = true,
	popWidth = 340,
	popClass,
	pop = true,
	up = false,
	autoFocus = false,
	onDone,
}: {
	d: D3
	dr: Draft
	placeholder?: string
	className?: string
	inputClass?: string
	icon?: boolean
	popWidth?: number
	popClass?: string // replaces the popover's position and width classes
	pop?: boolean // false when the caller shows the suggestions itself
	up?: boolean
	autoFocus?: boolean
	onDone?: () => void
}) {
	const [focus, setFocus] = useState(false)
	const show = pop && ((focus && !dr.draft.trim()) || dr.noMatch)
	return (
		<div className={`relative ${className}`}>
			<label className="flex h-full w-full items-center gap-2.5">
				{icon && <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" />}
				<input
					type="search"
					value={dr.draft}
					autoFocus={autoFocus}
					aria-label="Search"
					placeholder={placeholder}
					onFocus={() => setFocus(true)}
					onBlur={() => setFocus(false)}
					onChange={(e) => dr.setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							dr.enter()
							if (matchQuery(dr.draft, d.data.search).hit) onDone?.()
						}
						if (e.key === "Escape") (e.target as HTMLInputElement).blur()
					}}
					className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-white placeholder:text-gray-500 outline-none focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${inputClass}`}
				/>
				{dr.draft && (
					<button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (buzz(), dr.clear())} aria-label="Clear search" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer">
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</label>
			<AnimatePresence>
				{show && (
					<motion.div
						initial={{ opacity: 0, y: up ? 6 : -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: up ? 6 : -6 }}
						transition={{ duration: 0.14 }}
						style={popClass ? undefined : { width: popWidth }}
						className={`z-50 p-1.5 ${popClass ?? `absolute left-0 max-w-[calc(100vw-1.5rem)] ${up ? "bottom-full mb-3" : "top-full mt-3"}`} ${MENU}`}
					>
						<SuggestList d={d} hint={dr.noMatch} onPick={onDone} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------- the shell every variant shares

export function TasteLine({ d, className = "" }: { d: D3; className?: string }) {
	const who = d.data.who
	return (
		<p className={`flex items-center gap-2 text-xs text-gray-400 sm:text-sm ${className}`}>
			<FingerPrintIcon className="h-4 w-4 shrink-0 text-amber-500" />
			<span className="min-w-0">
				Your taste leans to <span className="text-gray-200">{listSentence(d.data.top.slice(0, 3).map((a) => a.phrase))}</span>
				<span className="text-gray-500">, from {who.rated.toLocaleString("en")} ratings</span>
			</span>
		</p>
	)
}

export type ShellSlots = {
	head: ReactNode // the page head, above the bar, both breakpoints
	lead?: ReactNode // desktop: first item in the studio row
	trail?: ReactNode // desktop: next to Filters, at the row's end
	chip?: ReactNode // desktop: first token in the chip row
	chipMobile?: ReactNode // mobile: first token in the chip row
	insightLead?: ReactNode // desktop: before the count in the sub-bar
	withQuery?: boolean // the count names the query (off when the head already shows it)
	reading?: boolean // the "Read as ..." line under the count
	compactFilters?: boolean
	slab?: SlabSlots
	aboveGrid?: ReactNode
}

export function Shell3({ d, slots, children }: { d: D3; slots: ShellSlots; children: ReactNode }) {
	const [open, setOpen] = useState(false)
	const bar = d.bar
	const chips = activeChips(bar)
	return (
		<div className="relative pb-72 lg:pb-32">
			<div className="relative mx-auto max-w-7xl px-4 pt-5 lg:pt-8">
				{slots.head}
				<div className="mt-7 hidden lg:block">
					<div className="flex items-center gap-2.5">
						{slots.lead}
						<ServicesSeg bar={bar} />
						<NotSeenSwitch bar={bar} />
						<SortDesk d={d} />
						<ForYouDesk d={d} />
						<div className="ml-auto flex items-center gap-2.5">
							{slots.trail}
							<FiltersButton bar={bar} compact={slots.compactFilters} onClick={() => setOpen(true)} />
						</div>
					</div>
					<Tokens bar={bar} lead={slots.chip} className="mt-3" />
					<Insight d={d} lead={slots.insightLead} withQuery={slots.withQuery ?? true} reading={slots.reading ?? true} />
				</div>
				<div className="lg:hidden">
					{(chips.length > 0 || slots.chipMobile) && (
						<div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
							{slots.chipMobile}
							{chips.map((c) => (
								<button key={c.key} type="button" onClick={c.remove} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] pl-3 pr-2 text-sm text-gray-100 ring-1 ring-white/10 cursor-pointer">
									{c.label}
									<XMarkIcon className="h-3.5 w-3.5 text-gray-500" />
								</button>
							))}
						</div>
					)}
					{(d.typed || (slots.reading ?? true)) && d.query && (
						<div className="mt-3 flex flex-col items-start gap-2">
							<MappedNote d={d} />
							{(slots.reading ?? true) && <ReadingLine d={d} className="text-[13px]" />}
						</div>
					)}
				</div>
				{slots.aboveGrid}
				<div className="mt-6 lg:mt-7">{children}</div>
			</div>
			<div className="lg:hidden">
				<Slab d={d} slots={slots.slab ?? {}} />
			</div>
			<div className="hidden lg:block">
				<SideSheet bar={bar} open={open} onClose={() => setOpen(false)} />
			</div>
		</div>
	)
}

// Shown when the filters leave nothing, or as a closing cell: the biggest ways back.
export function Recover3({ d, className = "" }: { d: D3; className?: string }) {
	const bar = d.bar
	if (!bar.recoveries.length) return null
	const empty = !bar.results.length
	return (
		<div className={`flex flex-col justify-center gap-2 rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 ${className}`}>
			<p className="text-base font-bold text-white">{empty ? "Nothing matches all your filters" : `${bar.hidden} more hidden by your filters`}</p>
			<RecoveryList bar={bar} limit={3} />
		</div>
	)
}

export type { SearchList }

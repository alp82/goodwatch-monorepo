// PROTOTYPE - throwaway. The chosen filter bar (#175) around a Discover or Search result list, for /prototype/rec-discover-2.
// Same as round 1's Shell (prototype-rec-discover/bar.tsx) minus the big result count (owner, round 1 review), with slots
// where the sort goes, so each variant can combine the sort and the "For you" switch its own way:
// desktop studio row plus sub-bar, mobile slab (strip merged with the bottom nav) plus its sheet.
// Round 1's row and slab pieces aren't exported, so they are copied here with layout ids of their own.
import { AdjustmentsHorizontalIcon, CheckIcon, EyeIcon, EyeSlashIcon, GlobeAltIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { listSentence } from "~/ui/prototype-rec-discover/rank"
import {
	DragSheet,
	FilterPanel,
	HiddenMeter,
	NavTabs,
	RecoveryList,
	RollingNumber,
	SPRING,
	SearchField,
	ServiceStack,
	ShowButton,
	TAP,
	buzz,
	clearMoreFilters,
	useCosts,
	useScrollHide,
	useServices,
} from "~/ui/prototype-rec-filter-bar-2/kit2"
import { activeChips } from "~/ui/prototype-rec-filter-bar/kit"
import type { Bar } from "~/ui/prototype-rec-filter-bar/model"
import { type D2, SORTS, type Surface, forYouHint } from "./rank2"

export const SHELL = "rounded-2xl bg-white/[0.04] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
export const MENU = "rounded-2xl bg-gray-900/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] text-gray-200"

// ---------------------------------------------------------------- For you atoms

// The switch track. Amber is Taste's color in the app, so "on" is amber and lit; "off" is a flat gray track.
export function Knob({ on, size = "md", className = "" }: { on: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
	const s = { sm: ["h-4 w-7", "h-3 w-3", "top-0.5", "right-0.5", "left-0.5"], md: ["h-5 w-9", "h-4 w-4", "top-0.5", "right-0.5", "left-0.5"], lg: ["h-7 w-12", "h-5 w-5", "top-1", "right-1", "left-1"] }[size]
	return (
		<span aria-hidden className={`relative inline-block shrink-0 rounded-full transition-colors duration-200 ${s[0]} ${on ? "bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,.55)]" : "bg-white/15"} ${className}`}>
			<motion.span layout transition={SPRING} className={`absolute rounded-full shadow ${s[1]} ${s[2]} ${on ? `${s[3]} bg-white` : `${s[4]} bg-gray-300`}`} />
		</span>
	)
}

// A full-width "For you" row with the switch, for sheets and menus.
export function ForYouRow({ d, tone = "card", className = "" }: { d: D2; tone?: "card" | "plain"; className?: string }) {
	const on = d.forYou
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			whileTap={TAP}
			onClick={() => (buzz(), d.setForYou(!on))}
			className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer transition-colors ${tone === "card" ? (on ? "bg-amber-500/[0.12] ring-1 ring-amber-500/35" : "bg-white/[0.04] ring-1 ring-white/10") : "hover:bg-white/5"} ${className}`}
		>
			<span className="min-w-0 flex-1">
				<span className={`block text-sm font-bold ${on ? "text-amber-100" : "text-gray-300"}`}>For you</span>
				<span className={`block text-xs ${on ? "text-amber-200/60" : "text-gray-500"}`}>{forYouHint(d)}</span>
			</span>
			<Knob on={on} />
		</motion.button>
	)
}

export function SortRows({ d, onPick, dense = false, id }: { d: D2; onPick?: () => void; dense?: boolean; id: string }) {
	return (
		<div className="flex flex-col">
			{SORTS[d.surface].map((s) => {
				const on = s.key === d.sort
				return (
					<motion.button
						key={s.key}
						type="button"
						role="menuitemradio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => {
							buzz()
							d.setSort(s.key)
							onPick?.()
						}}
						className={`relative flex items-center gap-3 rounded-xl px-3 ${dense ? "py-2" : "py-2.5"} text-left cursor-pointer ${on ? "" : "hover:bg-white/5"}`}
					>
						{on && <motion.span layoutId={`d2-sort-hl-${id}`} transition={SPRING} className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10" />}
						<span className="relative flex-1">
							<span className={`block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}>{s.label}</span>
							<span className="block text-xs text-gray-500">{s.hint}</span>
						</span>
						<CheckIcon className={`relative h-4 w-4 text-white ${on ? "" : "invisible"}`} />
					</motion.button>
				)
			})}
		</div>
	)
}

// A click-outside popover whose trigger is any element. Width is fixed so the menu never changes size.
export function Pop({ trigger, children, width = 288, align = "left", className = "", up = false }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; width?: number; align?: "left" | "right"; className?: string; up?: boolean }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const down = (e: MouseEvent | TouchEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("mousedown", down)
		document.addEventListener("touchstart", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("mousedown", down)
			document.removeEventListener("touchstart", down)
			document.removeEventListener("keydown", key)
		}
	}, [open])
	return (
		<div ref={ref} className={`relative ${className}`}>
			{trigger(open, () => setOpen((o) => !o))}
			<AnimatePresence>
				{open && (
					<motion.div
						role="menu"
						initial={{ opacity: 0, y: up ? 8 : -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: up ? 6 : -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						style={{ width }}
						className={`absolute z-40 max-w-[calc(100vw-1.5rem)] ${up ? "bottom-full mb-3" : "mt-2"} ${align === "right" ? `right-0 ${up ? "origin-bottom-right" : "origin-top-right"}` : `left-0 ${up ? "origin-bottom-left" : "origin-top-left"}`} ${MENU}`}
					>
						{children(() => setOpen(false))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------- the studio row (copied from round 1)

function ServicesSeg({ bar }: { bar: Bar }) {
	const on = bar.filters.mine
	const seg = "relative z-10 flex h-full items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors"
	return (
		<div role="radiogroup" aria-label="Where to watch" className={`relative flex h-12 p-1 ${SHELL}`}>
			<motion.button type="button" whileTap={TAP} role="radio" aria-checked={on} onClick={() => (buzz(), bar.set({ mine: true, providers: [] }))} className={`${seg} w-52 ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
				{on && <motion.span layoutId="d2-svc" transition={SPRING} className="absolute inset-0 -z-10 rounded-xl bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]" />}
				<ServiceStack bar={bar} on={on} size={20} />
				On my services
			</motion.button>
			<motion.button type="button" whileTap={TAP} role="radio" aria-checked={!on} onClick={() => (buzz(), bar.set({ mine: false }))} className={`${seg} w-36 ${!on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
				{!on && <motion.span layoutId="d2-svc" transition={SPRING} className="absolute inset-0 -z-10 rounded-xl bg-white/10 ring-1 ring-white/15" />}
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
			className={`relative flex h-12 w-52 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors ${SHELL} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
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

function FiltersButton({ bar, onClick }: { bar: Bar; onClick: () => void }) {
	return (
		<motion.button type="button" whileTap={TAP} onClick={onClick} className={`flex h-12 items-center gap-2 px-4 text-sm font-bold text-white cursor-pointer ${SHELL} hover:ring-white/25`}>
			<AdjustmentsHorizontalIcon className="h-4 w-4" />
			Filters
			<span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs tabular-nums ${bar.moreCount ? "bg-amber-500 text-gray-950" : "bg-white/10 text-gray-400"}`}>{bar.moreCount}</span>
		</motion.button>
	)
}

const DOT: Record<string, string> = { teal: "bg-teal-400", amber: "bg-amber-400", indigo: "bg-indigo-400", slate: "bg-lime-400", cyan: "bg-cyan-400", emerald: "bg-emerald-400", rose: "bg-rose-400", purple: "bg-purple-400" }
function Tokens({ bar, className = "" }: { bar: Bar; className?: string }) {
	const chips = activeChips(bar)
	return (
		<AnimatePresence initial={false}>
			{chips.length > 0 && (
				<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`overflow-hidden ${className}`}>
					<div className="flex flex-wrap items-center gap-2 pt-1">
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
						<button type="button" onClick={() => clearMoreFilters(bar)} className="ml-1 text-sm text-gray-500 hover:text-white cursor-pointer">
							Clear filters
						</button>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

function HiddenStrip({ bar, lead, className = "" }: { bar: Bar; lead?: ReactNode; className?: string }) {
	const top = bar.recoveries.slice(0, 2)
	return (
		<div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
			{lead}
			<div className="flex items-center gap-3">
				<HiddenMeter bar={bar} className="w-32" />
				<span className="text-sm text-gray-400">
					<RollingNumber value={bar.results.length} className="font-bold text-white" /> showing
					{bar.hidden > 0 && (
						<>
							, <RollingNumber value={bar.hidden} /> hidden by your filters
						</>
					)}
				</span>
			</div>
			{top.map((r) => (
				<motion.button key={r.key} type="button" whileTap={TAP} onClick={() => (buzz(), bar.drop(r.key))} className="flex items-center gap-1.5 text-sm font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
					<PlusIcon className="h-3.5 w-3.5" />
					{r.key === "mine" ? `${r.count} on other services` : r.key === "notSeen" ? `${r.count} you've seen` : `${r.count} ${r.label}`}
				</motion.button>
			))}
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

// ---------------------------------------------------------------- the slab (copied from round 1, sort made a slot)

function FirstClass({ bar }: { bar: Bar }) {
	const f = bar.filters
	const costs = useCosts(bar)
	const { text } = useServices(bar)
	return (
		<div className="flex flex-col gap-2.5">
			<div role="radiogroup" aria-label="Where to watch" className="relative grid h-16 grid-cols-2 rounded-2xl bg-white/[0.05] p-1 ring-1 ring-white/10">
				{[true, false].map((mine) => {
					const on = f.mine === mine
					return (
						<motion.button key={String(mine)} type="button" role="radio" aria-checked={on} whileTap={TAP} onClick={() => (buzz(), bar.set({ mine, providers: [] }))} className="relative flex flex-col items-center justify-center rounded-xl cursor-pointer">
							{on && (
								<motion.span
									layoutId="d2-fc-svc"
									transition={SPRING}
									className={`absolute inset-0 rounded-xl ${mine ? "bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" : "bg-white/10 ring-1 ring-white/15"}`}
								/>
							)}
							<span className={`relative flex items-center gap-2 text-sm font-bold ${on ? "text-white" : "text-gray-400"}`}>
								{mine ? <ServiceStack bar={bar} on={on} size={18} /> : <GlobeAltIcon className="h-4 w-4" />}
								{mine ? "My services" : "Everywhere"}
							</span>
							<span className={`relative mt-0.5 max-w-full truncate px-2 text-[11px] ${on ? "text-white/70" : "text-gray-500"}`}>
								{mine ? (f.mine ? `${text}` : "Your saved services") : f.mine ? `+${costs.mine} more titles` : "Every service"}
							</span>
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
				<span className={`relative h-7 w-12 rounded-full transition-colors ${f.notSeen ? "bg-blue-600 shadow-[0_0_16px_rgba(37,99,235,.55)]" : "bg-white/15"}`}>
					<motion.span layout transition={SPRING} className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${f.notSeen ? "right-1" : "left-1"}`} />
				</span>
			</motion.button>
		</div>
	)
}

function SortGrid({ d }: { d: D2 }) {
	return (
		<div className="grid grid-cols-2 gap-2">
			{SORTS[d.surface].map((s) => {
				const on = s.key === d.sort
				return (
					<motion.button key={s.key} type="button" whileTap={TAP} aria-pressed={on} onClick={() => (buzz(), d.setSort(s.key))} className="relative h-16 rounded-2xl px-3.5 text-left ring-1 ring-white/10 bg-white/[0.03] cursor-pointer">
						{on && <motion.span layoutId="d2-sort-grid" transition={SPRING} className="absolute inset-0 rounded-2xl bg-white/[0.08] ring-1 ring-white/30" />}
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

function SheetBody({ d }: { d: D2 }) {
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
				<SortGrid d={d} />
				<ForYouRow d={d} className="mt-2 !rounded-2xl !px-4 !py-3" />
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

// One slab segment. Variants use it for their sort and For you pieces so they sit flush with the others.
export const SEG = "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-bold cursor-pointer"

export type SlabSlots = {
	sort?: ReactNode // segments after "Not seen"; omit to leave only the two filter segments
	above?: ReactNode // a line inside the slab above the strip, always shown
	line?: ReactNode // replaces the "N hidden by filters" line, always shown
}

function Slab({ d, slots }: { d: D2; slots: SlabSlots }) {
	const bar = d.bar
	const { hidden } = useScrollHide()
	const [sheet, setSheet] = useState(-1)
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
							{!hidden && bar.hidden > 0 && (
								<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING} className="overflow-hidden">
									<div className="flex items-center gap-2.5 px-4 pt-3 text-xs">
										<HiddenMeter bar={bar} className="w-14" />
										<span className="whitespace-nowrap text-gray-400">
											<RollingNumber value={bar.hidden} className="font-bold text-white" /> hidden by filters
										</span>
										{top && (
											<motion.button type="button" whileTap={TAP} onClick={() => (buzz(), bar.drop(top.key))} className="ml-auto flex items-center gap-1 whitespace-nowrap font-bold text-amber-400 cursor-pointer">
												<PlusIcon className="h-3 w-3" />
												{top.key === "mine" ? `${top.count} on other services` : top.key === "notSeen" ? `${top.count} you've seen` : `${top.count} more`}
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
								{f.mine && <motion.span layoutId="d2-slab-mine" className="absolute inset-0 rounded-[14px] bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" />}
								<span className="relative">{f.mine ? <ServiceStack bar={bar} on size={16} /> : <GlobeAltIcon className="h-4 w-4" />}</span>
								<span className="relative w-full truncate px-0.5 text-center">{f.mine ? "My services" : "Everywhere"}</span>
							</motion.button>
							<motion.button type="button" whileTap={TAP} aria-pressed={f.notSeen} onClick={() => (buzz(), bar.set({ notSeen: !f.notSeen }))} className={`${SEG} ${f.notSeen ? "text-white" : "text-gray-400"}`}>
								{f.notSeen && <motion.span layoutId="d2-slab-seen" className="absolute inset-0 rounded-[14px] bg-linear-to-b from-blue-600 to-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" />}
								<span className="relative">{f.notSeen ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}</span>
								<span className="relative w-full truncate px-0.5 text-center">{f.notSeen ? "Not seen" : "Seen too"}</span>
							</motion.button>
							{slots.sort}
						</div>
						<motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => (buzz(), setSheet(0))} aria-label="More filters" className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer">
							<AdjustmentsHorizontalIcon className="h-5 w-5" />
							{bar.moreCount > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950">{bar.moreCount}</span>}
						</motion.button>
					</div>
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

// A menu that opens above the slab, anchored to the slab's strip. Closes on an outside tap.
export function SlabMenu({ open, onClose, children, width = 272 }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (ref.current?.contains(t) || t.closest("[data-slab-trigger]")) return
			onClose()
		}
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		document.addEventListener("mousedown", down)
		document.addEventListener("touchstart", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("mousedown", down)
			document.removeEventListener("touchstart", down)
			document.removeEventListener("keydown", key)
		}
	}, [open, onClose])
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					ref={ref}
					role="menu"
					initial={{ opacity: 0, y: 10, scale: 0.97 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 8, scale: 0.97 }}
					transition={SPRING}
					style={{ width }}
					className={`absolute right-3 bottom-full mb-2 max-w-[calc(100vw-1.5rem)] origin-bottom-right ${MENU} shadow-2xl shadow-black`}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------- page head (copied from round 1, count removed)

function SurfaceTabs({ d }: { d: D2 }) {
	const tabs: { key: Surface; label: string }[] = [
		{ key: "discover", label: "Discover" },
		{ key: "search", label: "Search" },
	]
	return (
		<div role="tablist" aria-label="Surface" className="flex items-center gap-6">
			{tabs.map((t) => {
				const on = d.surface === t.key
				return (
					<button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => d.setSurface(t.key)} className={`relative pb-1.5 brand-header text-2xl lg:text-3xl cursor-pointer transition-colors ${on ? "text-white" : "text-gray-600 hover:text-gray-300"}`}>
						{t.label}
						{on && <motion.span layoutId="d2-surface" transition={SPRING} className="absolute inset-x-0 -bottom-0.5 h-[3px] rounded-full bg-amber-500" />}
					</button>
				)
			})}
		</div>
	)
}

function QueryBox({ d }: { d: D2 }) {
	const wants = d.query.reading.filter((r) => r.kind === "want" || r.kind === "attribute").slice(0, 5)
	return (
		<div className="mt-5">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<label className="flex h-12 items-center gap-3 rounded-2xl bg-white/[0.06] px-4 ring-1 ring-white/15 lg:w-[420px]">
					<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-400" />
					<input value={d.query.q} readOnly aria-label="Search" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-lg font-bold text-white outline-none focus:ring-0" />
				</label>
				<div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
					{d.data.search
						.filter((s) => s.q !== d.query.q)
						.map((s) => (
							<button key={s.q} type="button" onClick={() => d.setQuery(s.q)} className="h-9 shrink-0 rounded-full bg-white/[0.04] px-3.5 text-sm text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white cursor-pointer">
								{s.q}
							</button>
						))}
				</div>
			</div>
			{wants.length > 0 && (
				<p className="mt-3 hidden text-sm text-gray-500 sm:block">
					Read as <span className="text-gray-300">{listSentence(wants.map((w) => w.text.toLowerCase()))}</span>. With For you on, your taste only reorders inside that, it never changes what the search is about.
				</p>
			)}
		</div>
	)
}

function TasteLine({ d, className = "" }: { d: D2; className?: string }) {
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

// ---------------------------------------------------------------- the shell every variant shares

export function Shell2({ d, desk, deskLead, slab, children }: { d: D2; desk: ReactNode; deskLead?: ReactNode; slab: SlabSlots; children: ReactNode }) {
	const [open, setOpen] = useState(false)
	const bar = d.bar
	return (
		<div className="relative pb-64 lg:pb-32">
			<div className="relative mx-auto max-w-7xl px-4 pt-5 lg:pt-8">
				<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
					<SurfaceTabs d={d} />
					<TasteLine d={d} className="hidden lg:flex" />
				</div>
				<TasteLine d={d} className="mt-3 lg:hidden" />
				{d.surface === "search" && <QueryBox d={d} />}
				<div className="mt-7 hidden lg:block">
					<div className="flex flex-wrap items-center gap-2.5">
						<ServicesSeg bar={bar} />
						<NotSeenSwitch bar={bar} />
						{desk}
						<div className="ml-auto">
							<FiltersButton bar={bar} onClick={() => setOpen(true)} />
						</div>
					</div>
					<Tokens bar={bar} className="mt-3" />
					<HiddenStrip bar={bar} lead={deskLead} className="mt-5" />
				</div>
				<div className="lg:hidden">
					{activeChips(bar).length > 0 && (
						<div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
							{activeChips(bar).map((c) => (
								<button key={c.key} type="button" onClick={c.remove} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] pl-3 pr-2 text-sm text-gray-100 ring-1 ring-white/10 cursor-pointer">
									{c.label}
									<XMarkIcon className="h-3.5 w-3.5 text-gray-500" />
								</button>
							))}
						</div>
					)}
				</div>
				<div className="mt-6 lg:mt-7">{children}</div>
			</div>
			<div className="lg:hidden">
				<Slab d={d} slots={slab} />
			</div>
			<div className="hidden lg:block">
				<SideSheet bar={bar} open={open} onClose={() => setOpen(false)} />
			</div>
		</div>
	)
}

// Shown when the filters leave nothing, or as a closing cell: the biggest ways back.
export function Recover2({ d, className = "" }: { d: D2; className?: string }) {
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

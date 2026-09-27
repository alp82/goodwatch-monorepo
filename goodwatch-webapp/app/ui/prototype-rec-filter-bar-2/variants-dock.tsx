// PROTOTYPE - throwaway. Round 2, mobile: five thumb docks, each shown at 390 wide
// (on desktop inside a phone frame). Each one decides how it lives with the site's bottom nav,
// what it does on scroll, what it says at a glance, and how its sheet snaps.
import { AdjustmentsHorizontalIcon, ArrowsUpDownIcon, ChevronUpIcon, EyeIcon, EyeSlashIcon, GlobeAltIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { activeChips, recoveryText } from "~/ui/prototype-rec-filter-bar/kit"
import { type Bar, SORTS } from "~/ui/prototype-rec-filter-bar/model"
import {
	DragSheet,
	FilterPanel,
	HiddenMeter,
	NAV,
	NavTabs,
	PhoneGrid,
	RecoveryList,
	RollingNumber,
	SPRING,
	SearchField,
	ServiceStack,
	ShowButton,
	SortList,
	TAP,
	TasteFab,
	buzz,
	clearMoreFilters,
	useCosts,
	useScrollHide,
	useServices,
} from "~/ui/prototype-rec-filter-bar-2/kit2"

// ---------------------------------------------------------------- shared phone pieces

function PageHead({ bar, children }: { bar: Bar; children?: ReactNode }) {
	const chips = activeChips(bar)
	return (
		<div className="px-3 pt-5">
			<h1 className="brand-header text-4xl text-white">Discover</h1>
			{children}
			{chips.length > 0 && (
				<div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
					{chips.map((c) => (
						<button key={c.key} type="button" onClick={c.remove} className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] pl-3 pr-2 text-sm text-gray-100 ring-1 ring-white/10 cursor-pointer">
							{c.label}
							<XMarkIcon className="h-3.5 w-3.5 text-gray-500" />
						</button>
					))}
				</div>
			)}
		</div>
	)
}

// Big, one-thumb versions of the three first-class controls, for sheets and expanded docks.
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
									layoutId="fc-svc"
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

function SortGrid({ bar }: { bar: Bar }) {
	return (
		<div className="grid grid-cols-2 gap-2">
			{SORTS.map((s) => {
				const on = s.key === bar.filters.sort
				return (
					<motion.button key={s.key} type="button" whileTap={TAP} aria-pressed={on} onClick={() => (buzz(), bar.set({ sort: s.key }))} className="relative h-16 rounded-2xl px-3.5 text-left ring-1 ring-white/10 bg-white/[0.03] cursor-pointer">
						{on && <motion.span layoutId="sort-grid" transition={SPRING} className="absolute inset-0 rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/60" />}
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

// Everything a full sheet holds, top to bottom in reach order.
function SheetBody({ bar, parts = ["first", "sort", "hidden", "more"] }: { bar: Bar; parts?: ("first" | "sort" | "hidden" | "more")[] }) {
	const [q, setQ] = useState("")
	const blocks = {
		first: (
			<Block key="first" title="Show me">
				<FirstClass bar={bar} />
			</Block>
		),
		sort: (
			<Block key="sort" title="Sort">
				<SortGrid bar={bar} />
			</Block>
		),
		hidden:
			bar.hidden > 0 ? (
				<Block key="hidden" title={`${bar.hidden} hidden by your filters`} right={<HiddenMeter bar={bar} className="w-24" />}>
					<div className="-mx-3">
						<RecoveryList bar={bar} />
					</div>
				</Block>
			) : null,
		more: (
			<Block
				key="more"
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
		),
	}
	// Parts render in the order given: each dock puts what it doesn't already show up front.
	return <div className="pb-6">{parts.map((p) => blocks[p])}</div>
}

function SheetFooter({ bar, onDone }: { bar: Bar; onDone: () => void }) {
	return (
		<div className="shrink-0 border-t border-white/5 bg-gray-950/90 px-4 pt-3 pb-5">
			<ShowButton bar={bar} onClick={onDone} className="w-full" />
		</div>
	)
}

const sortLabel = (bar: Bar) => SORTS.find((s) => s.key === bar.filters.sort)!.label

// ---------------------------------------------------------------- M1: merged slab (existing)

// The filter strip and the bottom nav become one slab. Scrolling down folds the nav away and keeps
// the strip; scrolling up brings the nav back. Taste moves into the nav row instead of floating over the strip.
export function DockSlab({ bar }: { bar: Bar }) {
	const { hidden } = useScrollHide()
	const [sheet, setSheet] = useState(-1)
	const [sortOpen, setSortOpen] = useState(false)
	const f = bar.filters
	const top = bar.recoveries[0]
	const seg = "relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] font-bold cursor-pointer"
	return (
		<>
			<PageHead bar={bar} />
			<div className="px-3 pt-4 pb-56">
				<PhoneGrid bar={bar} />
			</div>
			<div className="fixed inset-x-0 bottom-0 z-[60]">
				<motion.div layout transition={SPRING} className="rounded-t-[26px] bg-gray-950/90 ring-1 ring-white/10 backdrop-blur-2xl shadow-[0_-20px_50px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)]">
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
					<div className="relative flex items-center gap-2 px-3 pt-2.5 pb-2.5">
						<div className="flex h-[52px] flex-1 items-stretch gap-1 rounded-[18px] bg-white/[0.05] p-1 ring-1 ring-white/10">
							<motion.button type="button" whileTap={TAP} aria-pressed={f.mine} onClick={() => (buzz(), bar.set({ mine: !f.mine, providers: [] }))} className={`${seg} ${f.mine ? "text-white" : "text-gray-400"}`}>
								{f.mine && <motion.span layoutId="slab-mine" className="absolute inset-0 rounded-[14px] bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" />}
								<span className="relative">{f.mine ? <ServiceStack bar={bar} on size={16} /> : <GlobeAltIcon className="h-4 w-4" />}</span>
								<span className="relative">{f.mine ? "My services" : "Everywhere"}</span>
							</motion.button>
							<motion.button type="button" whileTap={TAP} aria-pressed={f.notSeen} onClick={() => (buzz(), bar.set({ notSeen: !f.notSeen }))} className={`${seg} ${f.notSeen ? "text-white" : "text-gray-400"}`}>
								{f.notSeen && <motion.span layoutId="slab-seen" className="absolute inset-0 rounded-[14px] bg-linear-to-b from-blue-600 to-blue-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" />}
								<span className="relative">{f.notSeen ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}</span>
								<span className="relative">{f.notSeen ? "Not seen" : "Seen too"}</span>
							</motion.button>
							<motion.button type="button" whileTap={TAP} aria-expanded={sortOpen} onClick={() => (buzz(), setSortOpen((o) => !o))} className={`${seg} ${sortOpen ? "bg-white/10 text-white" : "text-gray-200"}`}>
								<ArrowsUpDownIcon className="h-4 w-4 text-amber-500" />
								<span className="w-full truncate px-1 text-center">{sortLabel(bar)}</span>
							</motion.button>
						</div>
						<motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => (buzz(), setSheet(0))} aria-label="More filters" className="relative grid h-[52px] w-[52px] place-items-center rounded-[18px] bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer">
							<AdjustmentsHorizontalIcon className="h-5 w-5" />
							{bar.moreCount > 0 && <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950">{bar.moreCount}</span>}
						</motion.button>
						<AnimatePresence>
							{sortOpen && (
								<motion.div
									initial={{ opacity: 0, y: 10, scale: 0.97 }}
									animate={{ opacity: 1, y: 0, scale: 1 }}
									exit={{ opacity: 0, y: 8, scale: 0.97 }}
									transition={SPRING}
									className="absolute right-3 bottom-full mb-2 w-64 origin-bottom-right rounded-2xl bg-gray-900/95 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl shadow-black"
								>
									<SortList bar={bar} dense onPick={() => setSortOpen(false)} />
								</motion.div>
							)}
						</AnimatePresence>
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
			<DragSheet index={sheet} onIndex={setSheet} snaps={[0.58, 0.94]} backdropFrom={0} footer={sheet >= 0 && <SheetFooter bar={bar} onDone={() => setSheet(-1)} />}>
				<SheetBody bar={bar} parts={["hidden", "more", "first", "sort"]} />
			</DragSheet>
		</>
	)
}

// ---------------------------------------------------------------- M2: morphing capsule (bolder)

// One capsule floats over the page. Its edge carries three lights: emerald for your services,
// blue for not seen, amber for sort. Tap it and it opens in place into a control card; scroll down and
// it shrinks to a count bubble under your thumb.
export function DockCapsule({ bar }: { bar: Bar }) {
	const { hidden } = useScrollHide()
	const [open, setOpen] = useState(false)
	const [sheet, setSheet] = useState(-1)
	const f = bar.filters
	const mode = open ? "open" : hidden ? "bubble" : "pill"
	const edge = `linear-gradient(90deg, ${f.mine ? "rgb(16 185 129)" : "rgba(255,255,255,.12)"} 0%, ${f.mine ? "rgb(16 185 129)" : "rgba(255,255,255,.12)"} 30%, ${f.notSeen ? "rgb(59 130 246)" : "rgba(255,255,255,.12)"} 42%, ${f.notSeen ? "rgb(59 130 246)" : "rgba(255,255,255,.12)"} 62%, rgb(245 158 11) 74%, rgb(245 158 11) 100%)`
	return (
		<>
			<PageHead bar={bar} />
			<div className="px-3 pt-4 pb-56">
				<PhoneGrid bar={bar} />
			</div>
			<AnimatePresence>
				{open && <motion.div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />}
			</AnimatePresence>
			<motion.div
				className={`fixed z-[61] flex ${mode === "bubble" ? "right-4 justify-end" : "inset-x-3 justify-center"}`}
				animate={{ bottom: mode === "bubble" ? 20 : mode === "open" ? 92 : 96 }}
				transition={SPRING}
			>
				<motion.div layout transition={SPRING} style={{ background: mode === "open" ? "rgba(255,255,255,.1)" : edge, borderRadius: mode === "open" ? 28 : 999 }} className={`p-[1.5px] shadow-[0_24px_60px_-12px_rgba(0,0,0,.95)] ${mode === "open" ? "w-full" : ""}`}>
					<motion.div layout transition={SPRING} style={{ borderRadius: mode === "open" ? 27 : 999 }} className="overflow-hidden bg-gray-950/95 backdrop-blur-2xl">
						{mode === "bubble" && (
							<motion.button layout="position" type="button" whileTap={{ scale: 0.9 }} onClick={() => (buzz(), setOpen(true))} className="flex h-14 items-center gap-2 px-4 cursor-pointer" aria-label="Open filters">
								<RollingNumber value={bar.results.length} className="text-lg font-black text-white" />
								{bar.hidden > 0 && <span className="rounded-full bg-amber-500/15 px-1.5 text-[11px] font-bold text-amber-400">+{bar.hidden}</span>}
							</motion.button>
						)}
						{mode === "pill" && (
							<motion.button layout="position" type="button" whileTap={{ scale: 0.96 }} onClick={() => (buzz(), setOpen(true))} className="flex h-14 items-center gap-3 pl-3 pr-4 cursor-pointer" aria-label="Open filters">
								<span className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]">{f.mine ? <ServiceStack bar={bar} on size={16} max={2} /> : <GlobeAltIcon className="h-4 w-4 text-gray-300" />}</span>
								<span className="text-left leading-tight">
									<span className="block text-sm font-bold text-white">
										<RollingNumber value={bar.results.length} /> titles, {sortLabel(bar).toLowerCase()}
									</span>
									<span className="block text-[11px] text-gray-400">
										{f.mine ? "My services" : "Everywhere"}
										{f.notSeen ? ", not seen" : ""}
										{bar.moreCount ? `, +${bar.moreCount} filters` : ""}
									</span>
								</span>
								{bar.hidden > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-400 ring-1 ring-amber-500/30">{bar.hidden} hidden</span>}
								<ChevronUpIcon className="h-4 w-4 text-gray-500" />
							</motion.button>
						)}
						{mode === "open" && (
							<motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="w-full p-4">
								<div className="mb-3 flex items-center justify-between">
									<p className="text-sm text-gray-400">
										<RollingNumber value={bar.results.length} className="text-2xl font-black text-white" /> titles
									</p>
									<button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-gray-300 cursor-pointer">
										<XMarkIcon className="h-5 w-5" />
									</button>
								</div>
								<FirstClass bar={bar} />
								<div className="mt-2.5">
									<SortGrid bar={bar} />
								</div>
								{bar.recoveries[0] && (
									<motion.button type="button" whileTap={TAP} onClick={() => (buzz(), bar.drop(bar.recoveries[0].key))} className="mt-3 flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left text-sm cursor-pointer">
										<span className="text-gray-400">{bar.hidden} hidden.</span>
										<span className="font-bold text-amber-400">{recoveryText(bar.recoveries[0])}</span>
									</motion.button>
								)}
								<motion.button type="button" whileTap={TAP} onClick={() => (buzz(), setSheet(1))} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.07] text-sm font-bold text-white ring-1 ring-white/10 cursor-pointer">
									<AdjustmentsHorizontalIcon className="h-4 w-4" />
									More filters
									{bar.moreCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs text-gray-950">{bar.moreCount}</span>}
								</motion.button>
							</motion.div>
						)}
					</motion.div>
				</motion.div>
			</motion.div>
			<motion.div className="fixed inset-x-0 bottom-0 z-[59] border-t border-gray-800 bg-gray-950" animate={{ y: hidden && !open ? "150%" : 0 }} transition={SPRING}>
				<div className="relative">
					<NavTabs />
					<TasteFab />
				</div>
			</motion.div>
			<DragSheet index={sheet} onIndex={setSheet} snaps={[0.5, 0.94]} backdropFrom={0} footer={sheet >= 0 && <SheetFooter bar={bar} onDone={() => (setSheet(-1), setOpen(false))} />}>
				<SheetBody bar={bar} parts={["more", "hidden"]} />
			</DragSheet>
		</>
	)
}

function Pill({ on, tint, onClick, children, label }: { on: boolean; tint: string; onClick: () => void; children: ReactNode; label: string }) {
	return (
		<motion.button type="button" whileTap={{ scale: 0.9 }} aria-pressed={on} aria-label={label} onClick={() => (buzz(), onClick())} className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${on ? tint : "bg-white/[0.05] text-gray-400 ring-1 ring-white/10"}`}>
			{children}
		</motion.button>
	)
}

// ---------------------------------------------------------------- M3: summary bar that grows into the sheet (existing)

// The dock is the sheet. At rest it's a summary bar docked on the nav; drag it up to a half sheet
// with the three controls, sort and the way back to hidden titles, then to a full sheet with every filter.
export function DockGrow({ bar }: { bar: Bar }) {
	const { hidden } = useScrollHide()
	const [snap, setSnap] = useState(0)
	const f = bar.filters
	const navH = 64
	const peek = 84
	return (
		<>
			<PageHead bar={bar} />
			<div className="px-3 pt-4 pb-56">
				<PhoneGrid bar={bar} />
			</div>
			<motion.div className="fixed inset-x-0 bottom-0 z-[1000] border-t border-gray-800 bg-gray-950" animate={{ y: hidden && snap === 0 ? "110%" : 0 }} transition={SPRING}>
				<div className="relative">
					<NavTabs inlineTaste />
				</div>
			</motion.div>
			<DragSheet
				index={snap}
				onIndex={(i) => setSnap(Math.max(0, i))}
				snaps={[peek, 0.56, 0.94]}
				dismissible={false}
				bottomOffset={hidden && snap === 0 ? 0 : navH}
				label="Filters"
				className="rounded-t-[24px]"
				header={
					<div className="px-3 pb-3">
						<div className="flex items-center gap-1.5">
							<Pill label="On my services" on={f.mine} tint="bg-linear-to-b from-emerald-600 to-emerald-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" onClick={() => bar.set({ mine: !f.mine, providers: [] })}>
								{f.mine ? <ServiceStack bar={bar} on size={14} /> : <GlobeAltIcon className="h-4 w-4" />}
								{f.mine ? "Mine" : "All"}
							</Pill>
							<Pill label="Not seen yet" on={f.notSeen} tint="bg-linear-to-b from-blue-600 to-blue-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.25)]" onClick={() => bar.set({ notSeen: !f.notSeen })}>
								{f.notSeen ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
								{f.notSeen ? "Unseen" : "Seen too"}
							</Pill>
							<Pill label="Sort" on tint="bg-white/[0.08] text-white ring-1 ring-amber-500/40" onClick={() => setSnap(1)}>
								<ArrowsUpDownIcon className="h-4 w-4 text-amber-500" />
								{sortLabel(bar)}
							</Pill>
							<motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => (buzz(), setSnap(snap === 2 ? 0 : 2))} className="ml-auto flex h-10 flex-col items-end justify-center pr-1 leading-none cursor-pointer" aria-label="Show all filters">
								<RollingNumber value={bar.results.length} className="text-lg font-black text-white" />
								<span className={`text-[10px] font-bold ${bar.hidden ? "text-amber-400" : "text-gray-500"}`}>{bar.hidden ? `${bar.hidden} hidden` : "titles"}</span>
							</motion.button>
						</div>
					</div>
				}
				footer={snap > 0 && <SheetFooter bar={bar} onDone={() => setSnap(0)} />}
			>
				<div className="border-t border-white/5">
					<SheetBody bar={bar} parts={["hidden", "sort", "more"]} />
				</div>
			</DragSheet>
		</>
	)
}

function Seg({ on, onClick, children, label, lit }: { on: boolean; onClick: () => void; children: ReactNode; label: string; lit: string }) {
	return (
		<motion.button type="button" whileTap={{ scale: 0.88 }} aria-pressed={on} aria-label={label} onClick={() => (buzz(), onClick())} className={`relative flex h-14 w-[62px] flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-bold cursor-pointer ${on ? "text-white" : "text-gray-300 hover:bg-white/5"}`}>
			{on && <motion.span layoutId={`split-${label}`} className={`absolute inset-0 rounded-full ${lit}`} />}
			<span className="relative flex flex-col items-center gap-0.5">{children}</span>
		</motion.button>
	)
}

// ---------------------------------------------------------------- M4: split dock with a count bubble (existing)

// Right-thumb cluster: a pill with the two toggles and filters, a round sort button that fans its options
// upward, and a count bubble. Tap the bubble for the way back to hidden titles.
export function DockSplit({ bar }: { bar: Bar }) {
	const { hidden } = useScrollHide()
	const [fan, setFan] = useState(false)
	const [why, setWhy] = useState(false)
	const [sheet, setSheet] = useState(-1)
	const f = bar.filters
	const cur = SORTS.find((s) => s.key === f.sort)!
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!fan && !why) return
		const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && (setFan(false), setWhy(false))
		document.addEventListener("pointerdown", down)
		return () => document.removeEventListener("pointerdown", down)
	}, [fan, why])
	return (
		<>
			<PageHead bar={bar} />
			<div className="px-3 pt-4 pb-56">
				<PhoneGrid bar={bar} />
			</div>
			<motion.div ref={ref} className="fixed right-3 z-[61] flex items-end gap-2.5" animate={{ bottom: hidden ? 16 : 100 }} transition={SPRING}>
					<AnimatePresence>
						{why && (
							<motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.96 }} transition={SPRING} className="absolute bottom-full right-0 mb-14 w-80 max-w-[calc(100vw-1.5rem)] origin-bottom-right rounded-2xl bg-gray-900/95 p-2 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl shadow-black">
								<p className="px-3 pt-2 pb-1 text-sm text-gray-300">
									{bar.results.length} showing, {bar.hidden} hidden
								</p>
								<HiddenMeter bar={bar} className="mx-3 mb-1" />
								<RecoveryList bar={bar} onPick={() => setWhy(false)} />
							</motion.div>
						)}
					</AnimatePresence>
				<div className="relative">
					{/* Count bubble, perched on the pill. */}
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						onClick={() => (buzz(), setWhy((w) => !w), setFan(false))}
						className="absolute -top-10 left-1 z-10 flex h-8 items-center gap-1.5 rounded-full bg-gray-100 pl-2.5 pr-2 text-gray-950 shadow-lg shadow-black/60 cursor-pointer"
						aria-label="Why titles are hidden"
					>
						<RollingNumber value={bar.results.length} className="text-sm font-black" />
						{bar.hidden > 0 && (
							<span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-gray-950">
								+<RollingNumber value={bar.hidden} />
							</span>
						)}
					</motion.button>
					<div className="flex items-center gap-0.5 rounded-full bg-gray-950/90 p-1 ring-1 ring-white/10 backdrop-blur-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,.95)]">
						<Seg label="On my services" on={f.mine} lit="bg-linear-to-b from-emerald-600 to-emerald-800" onClick={() => bar.set({ mine: !f.mine, providers: [] })}>
							{f.mine ? <ServiceStack bar={bar} on size={14} max={2} /> : <GlobeAltIcon className="h-4 w-4" />}
							{f.mine ? "Mine" : "All"}
						</Seg>
						<Seg label="Not seen yet" on={f.notSeen} lit="bg-linear-to-b from-blue-600 to-blue-800" onClick={() => bar.set({ notSeen: !f.notSeen })}>
							{f.notSeen ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
							{f.notSeen ? "Unseen" : "Seen"}
						</Seg>
						<Seg label="Filters" on={bar.moreCount > 0} lit="bg-white/10 ring-1 ring-amber-500/50" onClick={() => setSheet(0)}>
							<AdjustmentsHorizontalIcon className="h-4 w-4" />
							{bar.moreCount ? `${bar.moreCount} on` : "More"}
						</Seg>
					</div>
				</div>
				<div className="relative">
					<AnimatePresence>
						{fan && (
							<div className="absolute bottom-full right-0 mb-3 flex w-44 flex-col items-end gap-2">
								{SORTS.map((s, i) => (
									<motion.button
										key={s.key}
										type="button"
										initial={{ opacity: 0, y: 24, scale: 0.8 }}
										animate={{ opacity: 1, y: 0, scale: 1, transition: { ...SPRING, delay: (SORTS.length - 1 - i) * 0.035 } }}
										exit={{ opacity: 0, y: 16, scale: 0.85, transition: { duration: 0.12 } }}
										whileTap={TAP}
										onClick={() => (buzz(), bar.set({ sort: s.key }), setFan(false))}
										className={`flex h-11 w-40 items-center justify-between rounded-full pl-4 pr-3 text-sm font-bold shadow-xl shadow-black/60 ring-1 cursor-pointer ${s.key === f.sort ? "bg-amber-500 text-gray-950 ring-amber-300" : "bg-gray-900/95 text-white ring-white/10 backdrop-blur"}`}
									>
										{s.label}
										{s.key === f.sort && <span className="h-2 w-2 rounded-full bg-gray-950" />}
									</motion.button>
								))}
							</div>
						)}
					</AnimatePresence>
					<motion.button
						type="button"
						whileTap={{ scale: 0.88 }}
						aria-expanded={fan}
						aria-label={`Sort: ${cur.label}`}
						onClick={() => (buzz(), setFan((o) => !o), setWhy(false))}
						className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-linear-to-b from-amber-500 to-amber-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_16px_40px_-10px_rgba(217,119,6,.8)] cursor-pointer"
					>
						<motion.span animate={{ rotate: fan ? 180 : 0 }} transition={SPRING}>
							<ArrowsUpDownIcon className="h-5 w-5" />
						</motion.span>
						<span className="max-w-12 truncate text-[9px] font-bold">{cur.label}</span>
					</motion.button>
				</div>
			</motion.div>
			<motion.div className="fixed inset-x-0 bottom-0 z-[59] border-t border-gray-800 bg-gray-950" animate={{ y: hidden ? "150%" : 0 }} transition={SPRING}>
				<div className="relative">
					<NavTabs />
					<TasteFab />
				</div>
			</motion.div>
			<DragSheet index={sheet} onIndex={setSheet} snaps={[0.6, 0.94]} backdropFrom={0} footer={sheet >= 0 && <SheetFooter bar={bar} onDone={() => setSheet(-1)} />}>
				<SheetBody bar={bar} parts={["more", "hidden"]} />
			</DragSheet>
		</>
	)
}

function Slot({ hidden, lit, color, onClick, icon, label, sub, aria }: { hidden: boolean; lit: boolean; color: string; onClick: () => void; icon: ReactNode; label: string; sub?: string; aria?: Record<string, unknown> }) {
	return (
		<motion.button type="button" whileTap={{ scale: 0.9, y: 1 }} onClick={() => (buzz(), onClick())} {...aria} className="relative flex h-full flex-1 flex-col items-center justify-center gap-1 cursor-pointer">
			<AnimatePresence>
				{lit && (
					<motion.span
						initial={{ opacity: 0, scaleX: 0.3 }}
						animate={{ opacity: 1, scaleX: 1 }}
						exit={{ opacity: 0, scaleX: 0.3 }}
						transition={SPRING}
						className="pointer-events-none absolute inset-x-2 top-0 h-full"
						style={{ background: `linear-gradient(to bottom, ${color}99, ${color}26 55%, transparent)`, clipPath: "polygon(30% 0, 70% 0, 100% 100%, 0 100%)" }}
					/>
				)}
			</AnimatePresence>
			{lit && <motion.span layout className="absolute top-0 h-[3px] w-10 rounded-b-full" style={{ background: color, boxShadow: `0 0 14px 2px ${color}` }} />}
			<span className={`relative ${lit ? "text-white" : "text-gray-400"}`}>{icon}</span>
			<AnimatePresence initial={false}>
				{!hidden && (
					<motion.span initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={`relative max-w-full truncate px-1 text-[11px] font-bold ${lit ? "text-white" : "text-gray-400"}`}>
						{label}
					</motion.span>
				)}
			</AnimatePresence>
			{sub && !hidden && <span className="relative -mt-1 text-[9px] text-gray-500">{sub}</span>}
		</motion.button>
	)
}

// ---------------------------------------------------------------- M5: the nav becomes the filter bar (bolder)

// On listing pages the filter bar replaces the bottom nav. Navigation folds into one button at the left.
// Active controls are lit from above like a stage; the strip above says what's showing and what's hidden.
export function DockStage({ bar }: { bar: Bar }) {
	const { hidden } = useScrollHide()
	const [nav, setNav] = useState(false)
	const [sheet, setSheet] = useState(-1)
	const [sortSheet, setSortSheet] = useState(-1)
	const f = bar.filters
	const top = bar.recoveries[0]
	return (
		<>
			<PageHead bar={bar} />
			<div className="px-3 pt-4 pb-56">
				<PhoneGrid bar={bar} />
			</div>
			<div className="fixed inset-x-0 bottom-0 z-[60]">
				<AnimatePresence initial={false}>
					{!hidden && (
						<motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={SPRING} className="mx-3 mb-2 flex h-9 items-center gap-2 rounded-full bg-gray-950/85 pl-3.5 pr-1.5 text-xs ring-1 ring-white/10 backdrop-blur-xl">
							<span className="text-gray-400">
								<RollingNumber value={bar.results.length} className="font-bold text-white" /> showing
							</span>
							{bar.hidden > 0 && (
								<span className="text-gray-500">
									and <RollingNumber value={bar.hidden} /> hidden
								</span>
							)}
							{top && (
								<motion.button type="button" whileTap={TAP} onClick={() => (buzz(), bar.drop(top.key))} className="ml-auto flex h-6 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 font-bold text-amber-400 cursor-pointer">
									<PlusIcon className="h-3 w-3" />
									{top.key === "mine" ? "Other services" : top.key === "notSeen" ? "Seen ones" : `${top.count} more`}
								</motion.button>
							)}
						</motion.div>
					)}
				</AnimatePresence>
				<motion.div animate={{ height: hidden ? 56 : 72 }} transition={SPRING} className="flex items-stretch border-t border-white/10 bg-black shadow-[0_-30px_60px_-20px_rgba(0,0,0,1)]">
					<motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => (buzz(), setNav(true))} aria-label="Navigate" className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 border-r border-white/10 cursor-pointer">
						<span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-amber-500 to-amber-700 text-base font-black text-white">G</span>
						{!hidden && <span className="text-[10px] text-gray-500">Discover</span>}
					</motion.button>
					<Slot hidden={hidden} lit={f.mine} color="rgb(16,185,129)" aria={{ "aria-pressed": f.mine }} onClick={() => bar.set({ mine: !f.mine, providers: [] })} icon={f.mine ? <ServiceStack bar={bar} on size={18} /> : <GlobeAltIcon className="h-5 w-5" />} label={f.mine ? "My services" : "Everywhere"} />
					<Slot hidden={hidden} lit={f.notSeen} color="rgb(59,130,246)" aria={{ "aria-pressed": f.notSeen }} onClick={() => bar.set({ notSeen: !f.notSeen })} icon={f.notSeen ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />} label={f.notSeen ? "Not seen" : "Seen too"} />
					<Slot hidden={hidden} lit color="rgb(245,158,11)" onClick={() => setSortSheet(0)} icon={<ArrowsUpDownIcon className="h-5 w-5" />} label={sortLabel(bar)} />
					<Slot
						hidden={hidden}
						lit={bar.moreCount > 0}
						color="rgb(244,244,245)"
						onClick={() => setSheet(0)}
						icon={
							<span className="relative">
								<AdjustmentsHorizontalIcon className="h-5 w-5" />
								{bar.moreCount > 0 && <span className="absolute -top-2 -right-3 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-gray-950">{bar.moreCount}</span>}
							</span>
						}
						label="Filters"
					/>
				</motion.div>
			</div>
			<DragSheet index={nav ? 0 : -1} onIndex={(i) => setNav(i >= 0)} snaps={[380]} backdropFrom={0} label="Navigate">
				<div className="px-3 pb-8">
					{[...NAV, { title: "Taste", Icon: FingerPrintIcon, to: "/taste" }].map((n) => (
						<a key={n.title} href={n.to} className={`flex h-14 items-center gap-4 rounded-2xl px-4 text-lg font-bold ${n.title === "Discover" ? "bg-white/[0.06] text-white" : "text-gray-300"}`}>
							<n.Icon className={`h-6 w-6 ${n.title === "Discover" ? "text-amber-500" : "text-gray-500"}`} />
							{n.title}
						</a>
					))}
				</div>
			</DragSheet>
			<DragSheet index={sortSheet} onIndex={setSortSheet} snaps={[330]} backdropFrom={0} label="Sort">
				<div className="px-2 pb-6">
					<SortList bar={bar} onPick={() => setSortSheet(-1)} />
				</div>
			</DragSheet>
			<DragSheet index={sheet} onIndex={setSheet} snaps={[0.6, 0.94]} backdropFrom={0} footer={sheet >= 0 && <SheetFooter bar={bar} onDone={() => setSheet(-1)} />}>
				<SheetBody bar={bar} parts={["hidden", "more"]} />
			</DragSheet>
		</>
	)
}

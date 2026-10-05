// PROTOTYPE - throwaway. Round 2, desktop: three refinements of round 1's "one row + sheet".
import { AdjustmentsHorizontalIcon, ArrowsUpDownIcon, ChevronDownIcon, EyeIcon, EyeSlashIcon, GlobeAltIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { GRID, Grid, activeChips } from "~/ui/prototype-rec-filter-bar/kit"
import { type Bar, SORTS } from "~/ui/prototype-rec-filter-bar/model"
import {
	FilterPanel,
	HiddenMeter,
	RecoveryList,
	RollingNumber,
	SPRING,
	SearchField,
	ServiceStack,
	ShowButton,
	SortList,
	TAP,
	buzz,
	clearMoreFilters,
	useCosts,
	useServices,
} from "~/ui/prototype-rec-filter-bar-2/kit2"

// ---------------------------------------------------------------- shared row pieces

// Popover with a fixed width; the trigger keeps its size whatever is picked.
function Pop({ trigger, children, width = 288, align = "left", className = "" }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; width?: number; align?: "left" | "right"; className?: string }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("mousedown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("mousedown", down)
			document.removeEventListener("keydown", key)
		}
	}, [open])
	return (
		<div ref={ref} className={`relative ${className}`}>
			<motion.button type="button" whileTap={TAP} aria-expanded={open} className="block text-left cursor-pointer" onClick={() => setOpen((o) => !o)}>
				{trigger(open)}
			</motion.button>
			<AnimatePresence>
				{open && (
					<motion.div
						initial={{ opacity: 0, y: -6, scale: 0.98 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -4, scale: 0.98 }}
						transition={{ duration: 0.16 }}
						style={{ width }}
						className={`absolute z-40 mt-2 max-w-[calc(100vw-2rem)] ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} rounded-2xl bg-gray-900/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] text-gray-200`}
					>
						{children(() => setOpen(false))}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

const SHELL = "rounded-2xl bg-white/[0.04] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"

// "On my services" with Everywhere one tap away. Fixed width for each half, a sliding lit panel between them.
function ServicesSeg({ bar, h = "h-12", compact = false }: { bar: Bar; h?: string; compact?: boolean }) {
	const on = bar.filters.mine
	const noServices = bar.viewer !== "member" && !on
	const seg = "relative z-10 flex h-full items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors"
	return (
		<div role="radiogroup" aria-label="Where to watch" className={`relative flex w-full sm:w-auto ${h} p-1 ${SHELL}`}>
			<motion.button type="button" whileTap={TAP} role="radio" aria-checked={on} onClick={() => (buzz(), bar.set({ mine: true, providers: [] }))} className={`${seg} flex-1 sm:flex-none ${compact ? "sm:w-44" : "sm:w-52"} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
				{on && <motion.span layoutId={`svc-${bar.viewer}-${h}`} transition={SPRING} className="absolute inset-0 -z-10 rounded-xl bg-linear-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_8px_24px_-8px_rgba(16,185,129,.6)]" />}
				{noServices ? <PlusIcon className="h-4 w-4" /> : <span className="hidden sm:flex"><ServiceStack bar={bar} on={on} size={compact ? 16 : 20} /></span>}
				{noServices ? "Add my services" : "On my services"}
			</motion.button>
			<motion.button type="button" whileTap={TAP} role="radio" aria-checked={!on} onClick={() => (buzz(), bar.set({ mine: false }))} className={`${seg} flex-1 sm:flex-none ${compact ? "sm:w-32" : "sm:w-36"} ${!on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}>
				{!on && <motion.span layoutId={`svc-${bar.viewer}-${h}`} transition={SPRING} className="absolute inset-0 -z-10 rounded-xl bg-white/10 ring-1 ring-white/15" />}
				<GlobeAltIcon className="h-4 w-4" />
				Everywhere
			</motion.button>
		</div>
	)
}

// A labelled switch, not a checkbox: the knob slides, the tint says what's on.
function NotSeenSwitch({ bar, h = "h-12" }: { bar: Bar; h?: string }) {
	const on = bar.filters.notSeen
	const cost = useCosts(bar).notSeen
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			role="switch"
			aria-checked={on}
			onClick={() => (buzz(), bar.set({ notSeen: !on }))}
			className={`relative flex ${h} w-52 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer transition-colors ${SHELL} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
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

function SortPop({ bar, h = "h-12", align = "left" }: { bar: Bar; h?: string; align?: "left" | "right" }) {
	const cur = SORTS.find((s) => s.key === bar.filters.sort)!
	return (
		<Pop
			width={288}
			align={align}
			trigger={(open) => (
				<span className={`flex ${h} w-48 items-center gap-2 px-4 text-sm ${SHELL} ${open ? "ring-white/25" : "hover:ring-white/20"}`}>
					<ArrowsUpDownIcon className="h-4 w-4 text-amber-500" />
					<span className="text-gray-400">Sort</span>
					<span className="flex-1 truncate font-bold text-white">{cur.label}</span>
					<ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
				</span>
			)}
		>
			{(close) => <SortList bar={bar} onPick={close} />}
		</Pop>
	)
}

function FiltersButton({ bar, onClick, h = "h-12" }: { bar: Bar; onClick: () => void; h?: string }) {
	return (
		<motion.button type="button" whileTap={TAP} onClick={onClick} className={`flex ${h} items-center gap-2 px-4 text-sm font-bold text-white cursor-pointer ${SHELL} hover:ring-amber-500/40`}>
			<AdjustmentsHorizontalIcon className="h-4 w-4" />
			Filters
			<span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs tabular-nums ${bar.moreCount ? "bg-amber-500 text-gray-950" : "bg-white/10 text-gray-400"}`}>{bar.moreCount}</span>
		</motion.button>
	)
}

// Active secondary filters as quiet tokens with a colored dot; one tap removes.
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

// "Showing 31 of 84" with the hidden share drawn as a meter, and the two biggest ways back.
function HiddenStrip({ bar, className = "" }: { bar: Bar; className?: string }) {
	const top = bar.recoveries.slice(0, 2)
	return (
		<div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
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

// Right-hand sheet: search, groups with live counts, a footer that always says what you'll get.
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

function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
	return (
		<div className="flex items-end justify-between gap-4">
			<h1 className="brand-header text-4xl text-white">{children}</h1>
			{right}
		</div>
	)
}

// ---------------------------------------------------------------- R1: studio row (existing)

export function VariantRowStudio({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-32">
			<Title>Discover</Title>
			<div className="mt-6 flex flex-wrap items-center gap-2.5">
				<ServicesSeg bar={bar} />
				<NotSeenSwitch bar={bar} />
				<SortPop bar={bar} />
				<div className="ml-auto">
					<FiltersButton bar={bar} onClick={() => setOpen(true)} />
				</div>
			</div>
			<Tokens bar={bar} className="mt-3" />
			<HiddenStrip bar={bar} className="mt-5" />
			<Grid bar={bar} className={`mt-5 ${GRID}`} />
			<SideSheet bar={bar} open={open} onClose={() => setOpen(false)} />
		</div>
	)
}

// ---------------------------------------------------------------- R2: ledger row (existing)

// Each control says what it costs. Filters open as a fixed-size panel under the row, not a sheet.
function LedgerTile({ as, on, tint, icon, title, sub, onClick, width = "w-60", right, ...aria }: { as?: "span"; on: boolean; tint: "emerald" | "blue" | "amber" | "none"; icon: ReactNode; title: ReactNode; sub: ReactNode; onClick?: () => void; width?: string; right?: ReactNode } & Record<string, unknown>) {
	const lit = {
		emerald: "bg-linear-to-b from-emerald-700/70 to-emerald-900/70 ring-emerald-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]",
		blue: "bg-linear-to-b from-blue-700/70 to-blue-900/70 ring-blue-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,.18)]",
		amber: "bg-white/[0.06] ring-amber-500/30",
		none: "bg-white/[0.06] ring-white/15",
	}[tint]
	const Comp = (as === "span" ? motion.span : motion.button) as typeof motion.button
	return (
		<Comp
			type={as ? undefined : "button"}
			whileTap={as ? undefined : TAP}
			onClick={onClick}
			{...aria}
			className={`flex h-16 ${width} items-center gap-3 rounded-2xl px-4 text-left ring-1 cursor-pointer transition-colors ${on ? lit : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"}`}
		>
			<span className={on ? "text-white" : "text-gray-400"}>{icon}</span>
			<span className="min-w-0 flex-1">
				<span className={`block truncate text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}>{title}</span>
				<span className="block truncate text-xs text-white/55">{sub}</span>
			</span>
			{right}
		</Comp>
	)
}

function FilterPanelPop({ bar, open, onClose }: { bar: Bar; open: boolean; onClose: () => void }) {
	const [q, setQ] = useState("")
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					role="dialog"
					aria-label="Filters"
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.18 }}
					className="absolute right-0 top-full z-40 mt-3 flex h-[560px] w-[860px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl bg-gray-900/95 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,.95),inset_0_1px_0_rgba(255,255,255,.06)]"
				>
					<div className="flex items-center gap-3 px-6 pt-5 pb-4">
						<SearchField value={q} onChange={setQ} autoFocus className="flex-1" />
						<button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 cursor-pointer">
							<XMarkIcon className="h-5 w-5" />
						</button>
					</div>
					<div className="flex-1 overflow-y-auto px-6 pb-6">
						<FilterPanel bar={bar} query={q} columns={2} />
					</div>
					<div className="flex items-center gap-4 border-t border-white/5 px-6 py-4">
						<button type="button" onClick={() => clearMoreFilters(bar)} className="text-sm text-gray-400 hover:text-white cursor-pointer">
							Clear all
						</button>
						<HiddenMeter bar={bar} className="ml-auto w-40" />
						<ShowButton bar={bar} onClick={onClose} />
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export function VariantRowLedger({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const costs = useCosts(bar)
	const f = bar.filters
	const cur = SORTS.find((s) => s.key === f.sort)!
	const chips = activeChips(bar)
	useEffect(() => {
		if (!open) return
		const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("mousedown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("mousedown", down)
			document.removeEventListener("keydown", key)
		}
	}, [open])
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-32">
			<Title
				right={
					<Pop
						width={340}
						align="right"
						trigger={(o) => (
							<span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${o ? "bg-white/10" : "hover:bg-white/5"}`}>
								<RollingNumber value={bar.results.length} className="text-2xl font-black text-white" />
								<span className="text-gray-400">titles</span>
								{bar.hidden > 0 && (
									<span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-400 ring-1 ring-amber-500/30">
										<RollingNumber value={bar.hidden} /> hidden
									</span>
								)}
							</span>
						)}
					>
						{(close) => (
							<div className="p-3">
								<p className="px-3 pt-1 pb-2 text-sm text-gray-300">
									{bar.hidden} titles are hidden by your filters. Let some back in:
								</p>
								<HiddenMeter bar={bar} className="mx-3 mb-2" />
								<RecoveryList bar={bar} onPick={close} limit={5} />
							</div>
						)}
					</Pop>
				}
			>
				Discover
			</Title>
			<div ref={ref} className="relative mt-6 flex flex-wrap items-center gap-2.5">
				<LedgerTile
					on={f.mine}
					tint="emerald"
					role="switch"
					aria-checked={f.mine}
					onClick={() => (buzz(), bar.set({ mine: !f.mine, providers: [] }))}
					width="w-80"
					icon={f.mine ? <ServiceStack bar={bar} on size={22} /> : <GlobeAltIcon className="h-5 w-5" />}
					title={f.mine ? "On my services" : "Everywhere"}
					sub={f.mine ? `Hides ${costs.mine} on other services` : "Every service, rent and buy too"}
					right={<span className="shrink-0 rounded-full bg-black/25 px-2 py-1 text-[11px] font-bold text-white/80">{f.mine ? "Everywhere" : "Mine"}</span>}
				/>
				<LedgerTile
					on={f.notSeen}
					tint="blue"
					role="switch"
					aria-checked={f.notSeen}
					onClick={() => (buzz(), bar.set({ notSeen: !f.notSeen }))}
					width="w-56"
					icon={f.notSeen ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
					title="Not seen yet"
					sub={f.notSeen ? `Hides ${costs.notSeen} watched or rated` : "Seen titles are showing"}
				/>
				<Pop
					width={288}
					trigger={() => (
						<LedgerTile
							as="span"
							on
							tint="amber"
							width="w-64"
							icon={<ArrowsUpDownIcon className="h-5 w-5 text-amber-500" />}
							title={`Sort: ${cur.label}`}
							sub={cur.hint}
							right={<ChevronDownIcon className="h-4 w-4 text-gray-400" />}
						/>
					)}
				>
					{(close) => <SortList bar={bar} onPick={close} />}
				</Pop>
				<div className="ml-auto">
					<LedgerTile
						on={open || bar.moreCount > 0}
						tint="none"
						aria-expanded={open}
						onClick={() => setOpen((o) => !o)}
						width="w-60"
						icon={<AdjustmentsHorizontalIcon className="h-5 w-5" />}
						title={bar.moreCount ? `${bar.moreCount} more filter${bar.moreCount > 1 ? "s" : ""}` : "More filters"}
						sub={chips.length ? chips.map((c) => c.label).join(", ") : "Mood, genre, score, people"}
						right={<ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />}
					/>
				</div>
				<FilterPanelPop bar={bar} open={open} onClose={() => setOpen(false)} />
			</div>
			<Tokens bar={bar} className="mt-3" />
			<Grid bar={bar} className={`mt-6 ${GRID}`} />
		</div>
	)
}

// ---------------------------------------------------------------- R3: glass bar that condenses (bolder)

export function VariantRowGlass({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	const [q, setQ] = useState("")
	const [slim, setSlim] = useState(false)
	const hero = bar.results[0] ?? bar.catalog[0]
	const { text } = useServices(bar)
	useEffect(() => {
		const fn = () => setSlim(window.scrollY > 220)
		fn()
		window.addEventListener("scroll", fn, { passive: true })
		return () => window.removeEventListener("scroll", fn)
	}, [])
	useEffect(() => {
		if (!open) return
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("keydown", key)
		return () => document.removeEventListener("keydown", key)
	}, [open])
	const h = slim ? "h-10" : "h-12"
	return (
		<div className="relative pb-32">
			{/* The top result lights the page. */}
			<div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden" aria-hidden>
				<AnimatePresence mode="popLayout">
					<motion.img
						key={hero?.key}
						src={`https://image.tmdb.org/t/p/w1280${hero?.backdrop_path}`}
						alt=""
						initial={{ opacity: 0 }}
						animate={{ opacity: 0.4 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8 }}
						className="absolute inset-0 h-full w-full object-cover object-top"
					/>
				</AnimatePresence>
				<div className="absolute inset-0 bg-linear-to-b from-gray-950/30 via-gray-950/75 to-gray-950" />
				<div className="absolute inset-0 bg-linear-to-r from-gray-950/80 to-transparent" />
			</div>
			<div className="relative max-w-7xl mx-auto px-4 pt-14">
				<p className="text-sm text-gray-300">
					{bar.filters.mine ? `On ${text}` : "On every service"}
					{bar.filters.notSeen ? ", nothing you've seen" : ""}
				</p>
				<h1 className="mt-1 flex items-baseline gap-3 text-white">
					<RollingNumber value={bar.results.length} className="brand-header text-7xl leading-none" />
					<span className="brand-header text-3xl text-white/80">{bar.results.length === 1 ? "title" : "titles"} to discover</span>
				</h1>
			</div>
			<div className="sticky top-16 z-30 mt-8">
				<motion.div layout transition={SOFT_BAR} className={`relative mx-auto max-w-7xl ${slim ? "px-2" : "px-4"}`}>
					<div className={`relative flex flex-wrap lg:flex-nowrap items-center gap-2.5 rounded-2xl ${slim ? "bg-gray-950/80 px-2 py-2 ring-1 ring-white/10 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,.9)]" : "py-2"}`}>
						<AnimatePresence initial={false}>
							{slim && (
								<motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden whitespace-nowrap pl-2 pr-1 text-sm text-gray-400">
									<RollingNumber value={bar.results.length} className="text-lg font-black text-white" /> titles
								</motion.span>
							)}
						</AnimatePresence>
						<ServicesSeg bar={bar} h={h} compact={slim} />
						<NotSeenSwitch bar={bar} h={h} />
						<SortPop bar={bar} h={h} />
						<div className="ml-auto flex items-center gap-3">
							{bar.hidden > 0 && (
								<Pop
									width={340}
									align="right"
									trigger={(o) => (
										<span className={`flex ${h} items-center gap-2 rounded-2xl px-3 text-sm ${o ? "bg-white/10" : "hover:bg-white/5"}`}>
											<span className="font-bold text-amber-400">
												<RollingNumber value={bar.hidden} /> hidden
											</span>
											<ChevronDownIcon className="h-4 w-4 text-gray-500" />
										</span>
									)}
								>
									{(close) => (
										<div className="p-3">
											<p className="px-3 pt-1 pb-2 text-sm text-gray-300">Hidden by your filters. Let some back in:</p>
											<RecoveryList bar={bar} onPick={close} limit={5} />
										</div>
									)}
								</Pop>
							)}
							<FiltersButton
								bar={bar}
								h={h}
								onClick={() => {
									// Dock the bar under the header first so the panel has the whole screen below it.
									if (!open && window.scrollY < 300) window.scrollTo({ top: 300 })
									setOpen((o) => !o)
								}}
							/>
						</div>
						{/* The bar's bottom edge is the meter: amber shows, the rest is hidden. */}
						<HiddenMeter bar={bar} className={`absolute inset-x-3 -bottom-1 h-[3px] ${slim ? "" : "opacity-60"}`} />
					</div>
					<AnimatePresence>
						{open && (
							<>
								<motion.div className="fixed inset-0 -z-10 bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
								<motion.div
									role="dialog"
									aria-label="Filters"
									initial={{ opacity: 0, y: -12, scaleY: 0.96 }}
									animate={{ opacity: 1, y: 0, scaleY: 1 }}
									exit={{ opacity: 0, y: -12, scaleY: 0.96 }}
									transition={{ duration: 0.2 }}
									className="absolute inset-x-4 top-full mt-3 flex h-[min(640px,calc(100vh-10rem))] origin-top flex-col rounded-3xl bg-gray-900/90 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_50px_120px_-30px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,.06)]"
								>
									<div className="flex items-center gap-3 px-7 pt-6 pb-4">
										<SearchField value={q} onChange={setQ} autoFocus className="flex-1" />
									</div>
									<div className="flex-1 overflow-y-auto px-7 pb-6">
										<FilterPanel bar={bar} query={q} columns={2} />
									</div>
									<div className="flex items-center gap-4 border-t border-white/5 px-7 py-4">
										<button type="button" onClick={() => clearMoreFilters(bar)} className="text-sm text-gray-400 hover:text-white cursor-pointer">
											Clear all
										</button>
										<span className="ml-auto text-sm text-gray-500">{bar.hidden ? `${bar.hidden} hidden by your filters` : ""}</span>
										<ShowButton bar={bar} onClick={() => setOpen(false)} />
									</div>
								</motion.div>
							</>
						)}
					</AnimatePresence>
				</motion.div>
			</div>
			<div className="relative max-w-7xl mx-auto px-4">
				<Tokens bar={bar} className="mt-4" />
				<Grid bar={bar} className={`mt-6 ${GRID}`} />
			</div>
		</div>
	)
}

const SOFT_BAR = { type: "spring", stiffness: 260, damping: 32 } as const

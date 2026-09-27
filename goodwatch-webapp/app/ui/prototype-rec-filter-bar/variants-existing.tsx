// PROTOTYPE - throwaway. Variants A-E: existing components and colors, different layout and disclosure.
import { AdjustmentsHorizontalIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import {
	ActiveChips,
	Chip,
	Grid,
	HiddenLine,
	MoreButton,
	MoreFilters,
	NotSeenToggle,
	Popover,
	ScoreDot,
	ServicesSwitch,
	Sheet,
	SortMenu,
	activeChips,
	useMyServiceNames,
} from "~/ui/prototype-rec-filter-bar/kit"
import { type Bar, RELEASES, SORTS, TYPES, VIBES, allGenres, phrases } from "~/ui/prototype-rec-filter-bar/model"

export function PageTitle({ children = "Discover", sub }: { children?: ReactNode; sub?: ReactNode }) {
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<h1 className="brand-header text-3xl sm:text-4xl text-white">{children}</h1>
			{sub}
		</div>
	)
}

// ------------------------------------------------------------------ A: one row + sheet

export function VariantRow({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-32">
			<PageTitle />
			<div className="mt-5 flex flex-wrap items-center gap-2">
				<div className="w-full sm:w-auto">
					<ServicesSwitch bar={bar} full />
				</div>
				<NotSeenToggle bar={bar} className="flex-1 sm:flex-none" />
				<SortMenu bar={bar} align="left" className="flex-1 sm:flex-none" />
				<MoreButton bar={bar} onClick={() => setOpen(true)} label="More" className="sm:ml-auto" />
			</div>
			<ActiveChips bar={bar} className="mt-3" />
			<HiddenLine bar={bar} className="mt-4" />
			<Grid bar={bar} className="mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5" />
			<Sheet open={open} onClose={() => setOpen(false)} bar={bar} />
		</div>
	)
}

// ------------------------------------------------------------------ B: sentence bar

const TOKEN: Record<string, { base: string; open: string }> = {
	teal: { base: "border-teal-600 bg-teal-900/50 hover:bg-teal-900", open: "bg-teal-900" },
	emerald: { base: "border-emerald-600 bg-emerald-900/50 hover:bg-emerald-900", open: "bg-emerald-900" },
	blue: { base: "border-blue-600 bg-blue-900/50 hover:bg-blue-900", open: "bg-blue-900" },
	amber: { base: "border-amber-600 bg-amber-900/50 hover:bg-amber-900", open: "bg-amber-900" },
}

function Token({ color, children, open }: { color: string; children: ReactNode; open: boolean }) {
	return (
		<span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-b-4 text-white font-bold ${TOKEN[color].base} ${open ? TOKEN[color].open : ""}`}>
			{children}
			<ChevronDownIcon className={`h-4 w-4 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
		</span>
	)
}

function OptionList<T extends string | boolean>({ options, value, onPick }: { options: { key: T; label: string; hint?: string }[]; value: T; onPick: (k: T) => void }) {
	return (
		<div className="p-1.5">
			{options.map((o) => (
				<button
					key={String(o.key)}
					type="button"
					onClick={() => onPick(o.key)}
					className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-left cursor-pointer ${o.key === value ? "bg-gray-800" : "hover:bg-gray-800/60"}`}
				>
					<span>
						<span className="block text-sm font-bold text-white">{o.label}</span>
						{o.hint && <span className="block text-xs text-gray-400">{o.hint}</span>}
					</span>
					{o.key === value && <CheckIcon className="h-4 w-4 text-amber-400" />}
				</button>
			))}
		</div>
	)
}

export function SentenceBar({ bar, onMore, size = "text-lg sm:text-2xl" }: { bar: Bar; onMore: () => void; size?: string }) {
	const f = bar.filters
	const names = useMyServiceNames(bar)
	const extra = phrases(bar, names.text).filter((p) => !["type", "mine", "notSeen", "sort"].includes(p.key))
	return (
		<div className={`${size} leading-loose text-gray-300`}>
			<span>Show me </span>
			<Popover
				className="inline-block align-baseline"
				width="w-64"
				trigger={(open) => (
					<Token color="teal" open={open}>
						{TYPES.find((t) => t.key === f.type)!.label.toLowerCase()}
					</Token>
				)}
			>
				{(close) => (
					<OptionList
						options={TYPES}
						value={f.type}
						onPick={(k) => {
							bar.set({ type: k })
							close()
						}}
					/>
				)}
			</Popover>{" "}
			<Popover
				className="inline-block align-baseline"
				width="w-72"
				trigger={(open) => (
					<Token color="emerald" open={open}>
						{f.mine ? "on my services" : "everywhere"}
					</Token>
				)}
			>
				{(close) => (
					<OptionList
						options={[
							{ key: true, label: "On my services", hint: bar.viewer === "member" ? names.text : "Pick your services once" },
							{ key: false, label: "Everywhere", hint: "Every service, rent and buy too" },
						]}
						value={f.mine}
						onPick={(k) => {
							bar.set({ mine: k, providers: [] })
							close()
						}}
					/>
				)}
			</Popover>{" "}
			<span>that I </span>
			<Popover
				className="inline-block align-baseline"
				width="w-72"
				trigger={(open) => (
					<Token color="blue" open={open}>
						{f.notSeen ? "haven't seen" : "may have seen"}
					</Token>
				)}
			>
				{(close) => (
					<OptionList
						options={[
							{ key: true, label: "Haven't seen", hint: "Hides titles you watched or rated" },
							{ key: false, label: "May have seen", hint: "Include watched and rated titles" },
						]}
						value={f.notSeen}
						onPick={(k) => {
							bar.set({ notSeen: k })
							close()
						}}
					/>
				)}
			</Popover>
			<span>, sorted </span>
			<Popover
				className="inline-block align-baseline"
				width="w-64"
				trigger={(open) => (
					<Token color="amber" open={open}>
						{SORTS.find((s) => s.key === f.sort)!.label.toLowerCase()}
					</Token>
				)}
			>
				{(close) => (
					<OptionList
						options={SORTS}
						value={f.sort}
						onPick={(k) => {
							bar.set({ sort: k })
							close()
						}}
					/>
				)}
			</Popover>
			{extra.map((p) => (
				<span key={p.key}>
					<span>, </span>
					<button type="button" onClick={() => bar.drop(p.key as never)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-b-4 border-gray-600 bg-gray-800 text-white font-bold hover:line-through cursor-pointer" title="Remove">
						{p.text}
					</button>
				</span>
			))}
			<span>. </span>
			<button type="button" onClick={onMore} className="inline-flex items-center gap-1 text-base align-middle px-2.5 py-1 rounded-md border-2 border-dashed border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 cursor-pointer">
				<PlusIcon className="h-4 w-4" />
				Narrow it down
			</button>
		</div>
	)
}

export function VariantSentence({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-32">
			<PageTitle />
			<div className="mt-4 max-w-4xl">
				<SentenceBar bar={bar} onMore={() => setOpen(true)} />
			</div>
			<HiddenLine bar={bar} className="mt-3" />
			<Grid bar={bar} className="mt-5 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5" />
			<Sheet open={open} onClose={() => setOpen(false)} bar={bar} title="Narrow it down" />
		</div>
	)
}

// ------------------------------------------------------------------ C: inline chip rail

export function VariantRail({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	const f = bar.filters
	const genres = allGenres(bar.catalog).slice(0, 6)
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-32">
			<PageTitle />
			<div className="mt-5 flex flex-col lg:flex-row lg:items-center gap-2">
				<div className="flex flex-wrap items-center gap-2 shrink-0">
					<div className="w-full sm:w-auto">
						<ServicesSwitch bar={bar} size="sm" full />
					</div>
					<NotSeenToggle bar={bar} size="sm" className="flex-1 sm:flex-none" />
					<SortMenu bar={bar} size="sm" align="right" />
				</div>
				<div className="hidden lg:block h-8 w-px bg-gray-800" />
				<div className="relative min-w-0 flex-1">
					<div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] pb-1 [mask-image:linear-gradient(to_right,black_92%,transparent)]">
						{TYPES.slice(1).map((t) => (
							<Chip key={t.key} color="teal" active={f.type === t.key} onClick={() => bar.set({ type: f.type === t.key ? "all" : t.key })} className="text-xs py-1.5">
								{t.label}
							</Chip>
						))}
						<Chip color="slate" active={f.minScore === 80} onClick={() => bar.set({ minScore: f.minScore === 80 ? 0 : 80 })} className="text-xs py-1.5">
							<ScoreDot score={80} />
							80+
						</Chip>
						<Chip color="cyan" active={f.release === "recent"} onClick={() => bar.set({ release: f.release === "recent" ? "any" : "recent" })} className="text-xs py-1.5">
							{RELEASES[1].label}
						</Chip>
						{VIBES.slice(0, 5).map((v) => (
							<Chip key={v.key} color="indigo" active={f.vibes.includes(v.key)} onClick={() => bar.toggle("vibes", v.key)} className="text-xs py-1.5">
								<span className="h-2 w-2 rounded-full" style={{ background: v.color }} />
								{v.label}
							</Chip>
						))}
						{genres.map((g) => (
							<Chip key={g} color="amber" active={f.genres.includes(g)} onClick={() => bar.toggle("genres", g)} className="text-xs py-1.5">
								{g}
							</Chip>
						))}
						<button type="button" onClick={() => setOpen(true)} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-md border-2 border-gray-700 text-gray-200 hover:border-gray-500 cursor-pointer whitespace-nowrap">
							<AdjustmentsHorizontalIcon className="h-4 w-4" />
							All filters
							{bar.moreCount > 0 && <span className="ml-0.5 px-1.5 rounded-full bg-amber-600 text-white">{bar.moreCount}</span>}
						</button>
					</div>
				</div>
			</div>
			<HiddenLine bar={bar} className="mt-4" />
			<Grid bar={bar} className="mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5" />
			<Sheet open={open} onClose={() => setOpen(false)} bar={bar} title="All filters" />
		</div>
	)
}

// ------------------------------------------------------------------ D: sticky summary

function useScrolledPast(px: number) {
	const [past, setPast] = useState(false)
	useEffect(() => {
		const on = () => setPast(window.scrollY > px)
		on()
		window.addEventListener("scroll", on, { passive: true })
		return () => window.removeEventListener("scroll", on)
	}, [px])
	return past
}

function Summary({ bar }: { bar: Bar }) {
	const names = useMyServiceNames(bar)
	const parts = phrases(bar, bar.filters.mine ? "my services" : names.text)
	return (
		<span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-left">
			{parts.map((p, i) => (
				<span key={p.key} className="flex items-center gap-1.5 whitespace-nowrap">
					{i > 0 && <span className="text-gray-600">·</span>}
					<span className={i === 0 ? "font-bold text-white" : "text-gray-300"}>{p.text}</span>
				</span>
			))}
		</span>
	)
}

export function VariantSticky({ bar }: { bar: Bar }) {
	const scrolled = useScrolledPast(180)
	const [expanded, setExpanded] = useState(false)
	const compact = scrolled
	return (
		<div className="max-w-7xl mx-auto px-4 pt-6 pb-32">
			<PageTitle />
			{/* Full bar at the top of the page (desktop); mobile always uses the compact bar. */}
			<div className="hidden md:flex mt-5 items-center gap-2">
				<ServicesSwitch bar={bar} />
				<NotSeenToggle bar={bar} />
				<SortMenu bar={bar} align="left" />
				<MoreButton bar={bar} onClick={() => setExpanded((e) => !e)} label="More" />
			</div>
			<div className={`${compact ? "md:fixed md:inset-x-0 md:top-16" : "md:hidden"} sticky top-16 z-30 -mx-4 md:mx-0 mt-4 md:mt-0`}>
				<div className="md:max-w-7xl md:mx-auto md:px-4">
					<div className="bg-gray-950/95 backdrop-blur border-y-2 md:border-2 border-gray-800 md:rounded-b-xl md:mt-0 shadow-xl shadow-black/40">
						<button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="w-full flex items-center gap-3 px-4 py-3 text-sm cursor-pointer">
							<AdjustmentsHorizontalIcon className="h-5 w-5 shrink-0 text-amber-500" />
							<Summary bar={bar} />
							<span className="ml-auto shrink-0 tabular-nums text-gray-400">{bar.results.length}</span>
							{expanded ? <ChevronUpIcon className="h-5 w-5 shrink-0" /> : <ChevronDownIcon className="h-5 w-5 shrink-0" />}
						</button>
						<AnimatePresence initial={false}>
							{expanded && (
								<motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
									<div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
										<div className="flex flex-wrap items-center gap-2">
											<div className="w-full md:w-auto">
												<ServicesSwitch bar={bar} full />
											</div>
											<NotSeenToggle bar={bar} className="flex-1 md:flex-none" />
											<SortMenu bar={bar} className="flex-1 md:flex-none" />
										</div>
										<div className="mt-5">
											<MoreFilters bar={bar} />
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</div>
			<ActiveChips bar={bar} className="mt-3" />
			<HiddenLine bar={bar} className="mt-3" />
			<Grid bar={bar} className="mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5" />
		</div>
	)
}

// ------------------------------------------------------------------ E: side rail

function Fold({ label, color, value, children, initial = false }: { label: string; color: string; value?: string; children: ReactNode; initial?: boolean }) {
	const [open, setOpen] = useState(initial)
	return (
		<div className="border-b border-gray-800">
			<button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2 py-3 text-sm cursor-pointer">
				<span className={`h-4 w-1 rounded bg-${color}-600`} />
				<span className="font-bold text-white">{label}</span>
				<span className="ml-auto truncate max-w-32 text-gray-400">{value}</span>
				<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			<AnimatePresence initial={false}>
				{open && (
					<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
						<div className="pb-4">{children}</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export function VariantSide({ bar }: { bar: Bar }) {
	const [open, setOpen] = useState(false)
	const f = bar.filters
	const chips = activeChips(bar)
	const valueOf = (k: string) => chips.filter((c) => c.key === k || c.key.startsWith(`${k[0]}-`)).map((c) => c.label).join(", ")
	return (
		<div className="max-w-[1440px] mx-auto px-4 pt-6 pb-32 lg:grid lg:grid-cols-[288px_1fr] lg:gap-8">
			<aside className="hidden lg:block">
				<div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 [scrollbar-width:none]">
					<ServicesSwitch bar={bar} full />
					<NotSeenToggle bar={bar} className="mt-2 w-full" />
					<div className="mt-5 text-xs font-bold text-gray-500">Sort</div>
					<div className="mt-1.5 grid grid-cols-2 gap-1.5">
						{SORTS.map((s) => (
							<Chip key={s.key} color="amber" active={f.sort === s.key} onClick={() => bar.set({ sort: s.key })} className="justify-center">
								{s.label}
							</Chip>
						))}
					</div>
					<div className="mt-6 border-t border-gray-800">
						<Fold label="Type" color="teal" value={f.type === "all" ? "" : TYPES.find((t) => t.key === f.type)!.label}>
							<MoreFilters bar={bar} only={["type"]} />
						</Fold>
						<Fold label="Genre" color="amber" value={f.genres.join(", ")}>
							<MoreFilters bar={bar} only={["genres"]} />
						</Fold>
						<Fold label="Vibes" color="indigo" value={valueOf("vibes") || f.vibes.map((v) => VIBES.find((x) => x.key === v)?.label).join(", ")} initial>
							<MoreFilters bar={bar} only={["vibes"]} />
						</Fold>
						<Fold label="Score" color="slate" value={f.minScore ? `${f.minScore}+` : ""}>
							<MoreFilters bar={bar} only={["minScore"]} />
						</Fold>
						<Fold label="Release" color="cyan" value={f.release === "any" ? "" : RELEASES.find((r) => r.key === f.release)!.label}>
							<MoreFilters bar={bar} only={["release"]} />
						</Fold>
						<Fold label="Streaming services" color="emerald" value={f.mine ? "Mine" : f.providers.length ? `${f.providers.length} picked` : "All"}>
							<MoreFilters bar={bar} only={["providers"]} />
						</Fold>
						<Fold label="Similar to" color="rose" value={f.similar ? bar.catalog.find((t) => t.key === f.similar)?.title : ""}>
							<MoreFilters bar={bar} only={["similar"]} />
						</Fold>
						<Fold label="Cast and crew" color="purple" value={f.people.join(", ")}>
							<MoreFilters bar={bar} only={["people"]} />
						</Fold>
					</div>
				</div>
			</aside>
			<main className="min-w-0">
				<PageTitle />
				<div className="lg:hidden mt-4 flex flex-wrap gap-2">
					<ServicesSwitch bar={bar} full />
					<NotSeenToggle bar={bar} className="flex-1" />
					<SortMenu bar={bar} className="flex-1" align="right" />
					<MoreButton bar={bar} onClick={() => setOpen(true)} label="Filters" className="w-full" />
				</div>
				<ActiveChips bar={bar} className="mt-3" />
				<HiddenLine bar={bar} className="mt-3" />
				<Grid bar={bar} className="mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-5" />
			</main>
			<Sheet open={open} onClose={() => setOpen(false)} bar={bar} title="Filters" />
		</div>
	)
}

// PROTOTYPE - throwaway. Variant W, "Mega menu bar": M's expanding bar as a website-style mega menu. Closed: a static
// title, one bar that starts with a wide mood search field (a filter like the others: once set it shows in the status
// line as a removable value with its Read as), then Mood, Streaming, Not seen yet, Sort, Filters; and one status line.
// Mood or Filters opens a full-width panel under the bar with columns by kind, each a heading and its controls: Vibe,
// Watch, Quality, Time, and a narrower Niche column. Common controls sit inline; niche ones are quiet links that expand
// in place. Footer: Clear all and "Show N titles". Phones: the bar's essentials ride the bottom slab, and the panel's
// columns become an accordion in a sheet, the first two open.
import {
	AdjustmentsHorizontalIcon,
	ArrowsUpDownIcon,
	ChevronDownIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { SLAB_CLEARANCE, SLAB_SEGMENT, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { FiltersButton, NotSeenSwitch, ServiceStack, SortControl } from "~/ui/filter-bar/controls"
import { discoverSorts, FILTER_ACCENTS, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { SlabShell } from "~/ui/filter-bar/Slab"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	GenreControl,
	HueDots,
	MoodChips,
	NICHE,
	type NicheFilter,
	NicheLink,
	PRIVATE,
	type Pieces,
	ReleasedControl,
	ScoreControl,
	SectionHead,
	StatusLine,
	StreamingButton,
	StreamingControl,
	TypeControl,
	clearAll,
	groupNote,
	lineChips,
	moodLabel,
	useOpenRows,
} from "./S-filters"

export const NAME = "Mega menu bar"

const TASTE = "signUp" as const
const LABEL = "text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500"

type ColumnKey = "vibe" | "watch" | "quality" | "time" | "niche"
const COLUMNS: { key: ColumnKey; title: string; niche: NicheFilter["key"][] }[] = [
	{ key: "vibe", title: "Vibe", niche: ["themes", "styles"] },
	{ key: "watch", title: "Watch", niche: [] },
	{ key: "quality", title: "Quality", niche: ["minMatch", "sourceScores", "scoreGap"] },
	{ key: "time", title: "Time", niche: ["runtime"] },
	{ key: "niche", title: "Niche", niche: ["similarTo", "people", "productionCountries", "ageLimit", "loved", "disliked"] },
]
const ALL_NICHE = COLUMNS.flatMap((c) => c.niche)

function useSort(d: ProtoDiscover) {
	const searching = d.filters.searching
	return {
		options: discoverSorts(searching, TASTE),
		value: sortShown(d.filters.sort, searching, TASTE),
		onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
		footnote: searching ? undefined : "Relevance joins once you search.",
	}
}

/** How many values a column has set, for its badge. */
function columnSet(d: ProtoDiscover, key: ColumnKey) {
	const s = d.filters.state
	const niche = COLUMNS.find((c) => c.key === key)?.niche ?? []
	const own =
		key === "vibe"
			? s.moods.length
			: key === "watch"
				? Number(s.onMyServices || !!s.anyService || !!s.services?.length) + Number(s.notSeenYet) + Number(s.type !== "all" || s.anime !== "any") + Number(s.genres.length > 0)
				: key === "quality"
					? Number(s.minScore > 0)
					: key === "time"
						? Number(s.released !== "any" || !!s.years)
						: 0
	return own + niche.filter((k) => NICHE[k].value(d)).length
}

// ---------------------------------------------------------------------------------------------------------------
// The columns' content, shared by the desktop panel and the phone accordion.

function Common({ label, accent, note, onClear, children }: { label: string; accent: string; note?: string; onClear?: () => void; children: ReactNode }) {
	return (
		<section aria-label={label}>
			<SectionHead label={label} accent={accent} note={note} onClear={onClear} />
			{children}
		</section>
	)
}

function NicheList({ d, pieces, keys, rows, small }: { d: ProtoDiscover; pieces: Pieces; keys: NicheFilter["key"][]; rows: ReturnType<typeof useOpenRows>; small?: boolean }) {
	if (!keys.length) return null
	return (
		<div className="flex flex-col">
			{keys.map((k) => (
				<NicheLink key={k} f={NICHE[k]} d={d} pieces={pieces} open={rows.isOpen(k)} onToggle={() => rows.toggle(k)} small={small} />
			))}
		</div>
	)
}

function ColumnBody({ col, d, pieces, rows }: { col: ColumnKey; d: ProtoDiscover; pieces: Pieces; rows: ReturnType<typeof useOpenRows> }) {
	const { state } = d.filters
	const niche = COLUMNS.find((c) => c.key === col)?.niche ?? []
	const links = <NicheList d={d} pieces={pieces} keys={niche} rows={rows} small={col === "niche"} />
	switch (col) {
		case "vibe": {
			const moods = d.picked.filter((t) => t.group === "moods")
			return (
				<div className="flex flex-col gap-4">
					<Common label="Mood" accent={FILTER_ACCENTS.moods.bar} note={groupNote(d, "moods")} onClear={moods.length ? () => d.filters.set({ moods: [] }) : undefined}>
						<MoodChips d={d} />
					</Common>
					<div className="border-t border-white/[0.06] pt-1">{links}</div>
				</div>
			)
		}
		case "watch":
			return (
				<div className="flex flex-col gap-5">
					<Common
						label="Streaming"
						accent={FILTER_ACCENTS.services.bar}
						onClear={state.onMyServices || state.anyService || state.services?.length ? () => d.filters.set({ onMyServices: false, anyService: undefined, services: undefined }) : undefined}
					>
						<StreamingControl d={d} pieces={pieces} limit={6} />
						<NotSeenSwitch {...pieces.notSeenProps} size="sm" className="mt-2.5 w-full" />
					</Common>
					<Common
						label="Movies or shows"
						accent={FILTER_ACCENTS.type.bar}
						onClear={state.type !== "all" || state.anime !== "any" ? () => d.filters.set({ type: "all", anime: "any" }) : undefined}
					>
						<TypeControl d={d} withCounts={false} />
					</Common>
					<Common label="Genre" accent={FILTER_ACCENTS.genres.bar} onClear={state.genres.length ? () => d.filters.set({ genres: [] }) : undefined}>
						<GenreControl d={d} limit={8} />
					</Common>
				</div>
			)
		case "quality":
			return (
				<div className="flex flex-col gap-4">
					<Common label="Score" accent={FILTER_ACCENTS.minScore.bar} onClear={state.minScore ? () => d.filters.set({ minScore: 0 }) : undefined}>
						<ScoreControl d={d} />
					</Common>
					<div className="border-t border-white/[0.06] pt-1">{links}</div>
				</div>
			)
		case "time":
			return (
				<div className="flex flex-col gap-4">
					<Common
						label="Released"
						accent={FILTER_ACCENTS.released.bar}
						onClear={state.released !== "any" || state.years ? () => d.filters.set({ released: "any", years: undefined }) : undefined}
					>
						<ReleasedControl d={d} slider />
					</Common>
					<div className="border-t border-white/[0.06] pt-1">{links}</div>
				</div>
			)
		default:
			return links
	}
}

function ColumnTitle({ title, n }: { title: string; n: number }) {
	return (
		<h2 className={`${LABEL} mb-4 flex h-5 items-center gap-2`}>
			{title}
			{n > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] tracking-normal text-gray-950">{n}</span>}
		</h2>
	)
}

function Footer({ d, pieces, onDone }: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const n = lineChips(pieces).length + (d.q ? 1 : 0)
	return (
		<div className="flex shrink-0 items-center gap-4 border-t border-white/[0.07] bg-gray-950/90 px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:pb-3">
			<button
				type="button"
				onClick={() => clearAll(d)}
				disabled={!n}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				{n ? `Clear all ${n}` : "Clear all"}
			</button>
			<span className="hidden items-center gap-2.5 text-sm text-gray-400 lg:flex">
				<HiddenMeter counts={d.counts} className="w-24" />
				{d.counts && d.counts.hidden > 0 && (
					<span>
						<RollingNumber value={d.counts.hidden} className="font-semibold text-gray-200" /> hidden
					</span>
				)}
			</span>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto max-lg:flex-1 lg:min-w-52" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The mood search field: the bar's first and largest control. Enter sets it; × takes it off.

function MoodSearchField({ d, className = "" }: { d: ProtoDiscover; className?: string }) {
	const [text, setText] = useState(d.q ?? "")
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => setText(d.q ?? ""), [d.q])
	const set = d.q !== null
	const dirty = text.trim() !== (d.q ?? "")
	return (
		<form
			role="search"
			onSubmit={(e) => {
				e.preventDefault()
				d.setQ(text.trim() || null)
				input.current?.blur()
			}}
			className={`group flex min-w-0 items-center gap-3 rounded-2xl pr-1.5 pl-4 transition-colors focus-within:ring-2 focus-within:ring-amber-400/70 ${
				set ? "bg-amber-400/[0.09] ring-1 ring-amber-400/45" : "bg-white/[0.06] ring-1 ring-white/12 hover:ring-white/25"
			} ${PRIVATE} ${className}`}
		>
			<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${set ? "text-amber-300" : "text-gray-400"}`} aria-hidden />
			<input
				ref={input}
				type="search"
				value={text}
				maxLength={SEARCH_MAX_CHARS}
				autoComplete="off"
				enterKeyHint="search"
				data-ph-no-capture
				aria-label="Mood search"
				placeholder="What's the mood?"
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") {
						setText(d.q ?? "")
						input.current?.blur()
					}
				}}
				className="brand-header h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[19px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{dirty && text.trim() ? (
				<button
					type="submit"
					className="h-9 shrink-0 rounded-xl bg-amber-500 px-3 text-sm font-bold text-gray-950 cursor-pointer outline-none hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-white"
				>
					Search
				</button>
			) : set ? (
				<button
					type="button"
					onClick={() => d.setQ(null)}
					aria-label="Remove the mood search"
					className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-amber-200/80 cursor-pointer outline-none hover:bg-amber-400/15 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			) : null}
		</form>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function MoodSegment({ d, open, onClick }: { d: ProtoDiscover; open: boolean; onClick: () => void }) {
	const label = moodLabel(d)
	return (
		<motion.button
			type="button"
			data-w-trigger
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-expanded={open}
			className={`flex h-12 max-w-[15rem] shrink-0 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${
				open ? "bg-white/[0.09] text-white ring-white/25" : label ? "text-white hover:ring-white/25" : "text-gray-200 hover:ring-white/25"
			}`}
		>
			<HueDots tags={d.picked.filter((t) => t.group === "moods")} size={14} idle />
			<span className="truncate">{label ?? "Mood"}</span>
			<ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
		</motion.button>
	)
}

function MegaPanel({ d, pieces, onClose }: { d: ProtoDiscover; pieces: Pieces; onClose: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	const rows = useOpenRows(d, ALL_NICHE)
	useEffect(() => {
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (ref.current?.contains(t) || t.closest("[data-w-trigger], [data-w-row], [data-bar-trigger]")) return
			if (t.closest("[role=dialog], [role=menu], [role=listbox]")) return
			onClose()
		}
		document.addEventListener("keydown", key)
		document.addEventListener("pointerdown", down)
		return () => {
			document.removeEventListener("keydown", key)
			document.removeEventListener("pointerdown", down)
		}
	}, [onClose])
	return (
		<motion.div
			ref={ref}
			role="dialog"
			aria-label="Mood and filters"
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -6 }}
			transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
			className="absolute inset-x-0 top-[calc(3.5rem+10px)] z-40 flex h-[min(640px,calc(100vh-200px))] flex-col overflow-hidden rounded-2xl bg-[#0b1120] text-gray-200 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10"
		>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)]">
				{COLUMNS.map((c) => (
					<div
						key={c.key}
						className={`min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-6 [scrollbar-width:thin] ${c.key === "niche" ? "bg-black/25" : "border-r border-white/[0.06]"}`}
					>
						<ColumnTitle title={c.title} n={columnSet(d, c.key)} />
						<ColumnBody col={c.key} d={d} pieces={pieces} rows={rows} />
					</div>
				))}
			</div>
			<Footer d={d} pieces={pieces} onDone={onClose} />
		</motion.div>
	)
}

function DesktopBar({ d, pieces, open, setOpen }: { d: ProtoDiscover; pieces: Pieces; open: boolean; setOpen: (open: boolean) => void }) {
	const navigate = useNavigate()
	const sort = useSort(d)
	const close = useCallback(() => setOpen(false), [setOpen])
	return (
		<div className="relative mt-4 hidden lg:block">
			<div data-w-row className="flex items-center gap-2.5">
				<MoodSearchField d={d} className="h-14 min-w-[16rem] flex-1" />
				<MoodSegment d={d} open={open} onClick={() => setOpen(!open)} />
				<StreamingButton d={d} pieces={pieces} open={open} onOpen={() => setOpen(true)} />
				<NotSeenSwitch {...pieces.notSeenProps} compact />
				<SortControl {...sort} align="right" />
				<div data-w-trigger>
					<FiltersButton count={pieces.secondaryCount} expanded={open} onClick={() => setOpen(!open)} compact />
				</div>
			</div>
			<StatusLine d={d} pieces={pieces} className="mt-2" />
			<AnimatePresence>{open && <MegaPanel d={d} pieces={pieces} onClose={close} />}</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: the search field and status line on top, the essentials in the slab, the columns as an accordion.

function AccordionSection({ title, n, open, onToggle, children }: { title: string; n: number; open: boolean; onToggle: () => void; children: ReactNode }) {
	return (
		<section className="border-b border-white/[0.07]">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={open}
				className="flex h-14 w-full items-center gap-2 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span className="text-[15px] font-bold text-white">{title}</span>
				{n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-gray-950">{n}</span>}
				<ChevronDownIcon className={`ml-auto h-5 w-5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			{open && <div className="pb-6">{children}</div>}
		</section>
	)
}

function PhoneSheetBody({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const rows = useOpenRows(d, ALL_NICHE)
	const [open, setOpen] = useState<Set<ColumnKey>>(() => new Set<ColumnKey>(["vibe", "watch"]))
	return (
		<div className="px-5 pb-6">
			{COLUMNS.map((c) => (
				<AccordionSection
					key={c.key}
					title={c.title}
					n={columnSet(d, c.key)}
					open={open.has(c.key)}
					onToggle={() =>
						setOpen((s) => {
							const n = new Set(s)
							if (n.has(c.key)) n.delete(c.key)
							else n.add(c.key)
							return n
						})
					}
				>
					<ColumnBody col={c.key} d={d} pieces={pieces} rows={rows} />
				</AccordionSection>
			))}
		</div>
	)
}

function PhoneSlab({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const navigate = useNavigate()
	const [sheet, setSheet] = useState(-1)
	const { state } = d.filters
	const mine = state.onMyServices
	const sort = useSort(d)
	const [sortOpen, setSortOpen] = useState(false)
	const sortLabel = sort.options.find((s) => s.key === sort.value)?.label ?? ""
	const label = moodLabel(d)
	return (
		<div className="lg:hidden">
			<SlabShell
				strip={
					<>
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={() => setSheet(0)}
							aria-label={label ? `Mood: ${label}` : "Mood"}
							className={`${SLAB_SEGMENT} ${label ? "bg-white/10 text-white" : "text-gray-200"}`}
						>
							<span className="flex h-4 items-center">
								<HueDots tags={d.picked.filter((t) => t.group === "moods")} size={12} idle />
							</span>
							<span className="w-full truncate px-1 text-center">{label ?? "Mood"}</span>
						</motion.button>
						<motion.button
							type="button"
							role="switch"
							aria-checked={mine}
							aria-label="On my services"
							whileTap={TAP}
							onClick={() => (pieces.hasServices ? pieces.servicesProps.onChange(!mine) : navigate(SERVICES_PATH))}
							className={`${SLAB_SEGMENT} ${mine ? "bg-linear-to-b from-emerald-600 to-emerald-800 text-white" : "text-gray-400"}`}
						>
							{mine ? (
								<ServiceStack providers={pieces.services.providers} on size={16} />
							) : pieces.hasServices ? (
								<GlobeAltIcon className="h-4 w-4" />
							) : (
								<PlusIcon className="h-4 w-4" />
							)}
							<span className="w-full truncate px-0.5 text-center">{mine ? "My services" : pieces.hasServices ? "Everywhere" : "Add services"}</span>
						</motion.button>
						<motion.button
							type="button"
							role="switch"
							aria-checked={state.notSeenYet}
							aria-label="Not seen yet"
							whileTap={TAP}
							onClick={() => pieces.notSeenProps.onChange(!state.notSeenYet)}
							className={`${SLAB_SEGMENT} ${state.notSeenYet ? "bg-linear-to-b from-blue-600 to-blue-800 text-white" : "text-gray-400"}`}
						>
							{state.notSeenYet ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
							<span className="w-full truncate px-0.5 text-center">{state.notSeenYet ? "Not seen" : "Seen too"}</span>
						</motion.button>
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={() => setSortOpen(!sortOpen)}
							aria-label={`Sort: ${sortLabel}`}
							aria-expanded={sortOpen}
							className={`${SLAB_SEGMENT} text-gray-200`}
						>
							<ArrowsUpDownIcon className="h-4 w-4 text-gray-400" />
							<span className="w-full truncate px-1 text-center">{sortLabel}</span>
						</motion.button>
					</>
				}
				trailing={
					<motion.button
						type="button"
						whileTap={{ scale: 0.9 }}
						onClick={() => setSheet(0)}
						aria-haspopup="dialog"
						aria-expanded={sheet >= 0}
						aria-label={pieces.secondaryCount ? `Filters, ${pieces.secondaryCount} active` : "Filters"}
						className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<AdjustmentsHorizontalIcon className="h-5 w-5" />
						{pieces.secondaryCount > 0 && (
							<span aria-hidden className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950">
								{pieces.secondaryCount}
							</span>
						)}
					</motion.button>
				}
			>
				<AnimatePresence>
					{sortOpen && (
						<motion.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 6 }}
							transition={{ duration: 0.15 }}
							role="menu"
							className="absolute right-0 bottom-[60px] left-0 rounded-2xl bg-[#0b1120] p-2 shadow-[0_20px_60px_rgba(0,0,0,.8)] ring-1 ring-white/10"
						>
							{sort.options.map((s) => (
								<button
									key={s.key}
									type="button"
									role="menuitemradio"
									aria-checked={s.key === sort.value}
									disabled={s.disabled}
									onClick={() => {
										sort.onChange(s.key)
										setSortOpen(false)
									}}
									className={`flex h-11 w-full items-center rounded-xl px-3 text-left text-[15px] ${s.disabled ? "text-gray-600" : s.key === sort.value ? "bg-white/10 font-semibold text-white" : "text-gray-200"}`}
								>
									{s.label}
								</button>
							))}
						</motion.div>
					)}
				</AnimatePresence>
			</SlabShell>
			<SnapSheet index={sheet} onIndex={setSheet} snaps={[0.94]} label="Mood and filters" footer={<Footer d={d} pieces={pieces} onDone={() => setSheet(-1)} />}>
				<PhoneSheetBody d={d} pieces={pieces} />
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantW({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d, TASTE)
	const [open, setOpen] = useState(false)
	return (
		<MotionConfig reducedMotion="user">
			<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
				<h1 className="brand-header text-[26px] leading-tight text-white lg:text-[34px]">Discover movies and TV shows</h1>
				<div className="lg:hidden">
					<MoodSearchField d={d} className="mt-3 h-12" />
					<StatusLine d={d} pieces={pieces} className="mt-1" />
				</div>
				<DesktopBar d={d} pieces={pieces} open={open} setOpen={setOpen} />
				<div className="relative mt-1 lg:mt-3">
					<ProtoGrid d={d} />
					<AnimatePresence>
						{open && (
							<motion.button
								type="button"
								aria-label="Close the filters"
								tabIndex={-1}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.18 }}
								onClick={() => setOpen(false)}
								className="absolute inset-0 z-30 hidden cursor-default bg-gray-950/55 lg:block"
							/>
						)}
					</AnimatePresence>
				</div>
				<PhoneSlab d={d} pieces={pieces} />
			</div>
		</MotionConfig>
	)
}

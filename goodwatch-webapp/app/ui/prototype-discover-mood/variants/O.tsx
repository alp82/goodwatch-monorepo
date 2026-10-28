// PROTOTYPE - throwaway. Variant O, "Palette, side nav": L's centered palette, organized like a settings page. On the
// page: a static title, one bar (a big "What's the mood?" field that opens the palette at the search, then Mood,
// Streaming, Not seen yet, Sort, All filters), and one status line (count, the mood search as a value with its Read as
// chips, the active values, Clear all). The palette: the mood search on top, large, with its answer kept apart
// ("Search the mood: …"); below it a side nav of categories (the common ones big, with their values; the niche ones
// quieter under "More") and the chosen category's control on the right. Typing also lists matching filter options
// under "Filters". Footer: the active values, Clear all, Show N titles. Phones: the palette is full screen and the
// nav is a scrolling row of chips at its top.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import {
	AdjustmentsHorizontalIcon,
	ArrowTurnDownLeftIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { FilterGroups, ShowTitlesButton } from "~/ui/filter-bar"
import { OneLineChips, mergedChips } from "~/ui/filter-bar/ActiveFilters"
import {
	NotSeenSwitch,
	ServicesControl,
	SortControl,
} from "~/ui/filter-bar/controls"
import { discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { SERVICES_PATH } from "~/ui/settings/paths"
import {
	EXAMPLE_PROMPTS,
	ProtoGrid,
	type ProtoDiscover,
	useFilterPieces,
} from "../kit"
import {
	COMMON,
	type Cat,
	type CatKey,
	CatPane,
	HueDots,
	MoodSearchValue,
	OneCardStyle,
	PAGE_TITLE,
	type Pieces,
	ValueChip,
	catValues,
	moodLabel,
	nicheFor,
} from "./O-categories"

export const NAME = "Palette, side nav"

const PRIVATE = "search-private ph-no-capture sentry-mask"
const LINE_FADE =
	"linear-gradient(to right, black calc(100% - 2.5rem), transparent)"
const TASTE = "signUp" as const

type Opening = { at: "search" } | { at: "cat"; cat: CatKey }

// ---------------------------------------------------------------------------------------------------------------
// The palette's nav

function SideNav({
	d,
	pieces,
	cat,
	onPick,
	focusCat,
}: {
	d: ProtoDiscover
	pieces: Pieces
	cat: CatKey
	onPick: (k: CatKey) => void
	focusCat: boolean
}) {
	const values = catValues(d, pieces)
	const item = (c: Cat, niche: boolean) => {
		const on = c.key === cat
		const value = values[c.key]
		return (
			<button
				key={c.key}
				type="button"
				onClick={() => onPick(c.key)}
				aria-current={on ? "page" : undefined}
				data-autofocus={(focusCat && on) || undefined}
				className={`relative flex w-full min-w-0 cursor-pointer rounded-xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
					niche
						? "h-9 items-center gap-2 px-3"
						: "h-[54px] flex-col justify-center px-3"
				} ${on ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
			>
				{on && (
					<span
						aria-hidden
						className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-amber-400"
					/>
				)}
				{niche ? (
					<>
						<span
							className={`min-w-0 truncate text-[13px] ${on ? "font-semibold text-white" : value ? "text-gray-100" : "text-gray-400"}`}
						>
							{c.label}
						</span>
						{value && (
							<span className="ml-auto flex min-w-0 max-w-[45%] items-center gap-1.5">
								<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
								<span className="truncate text-[11px] text-amber-200/80">
									{value}
								</span>
							</span>
						)}
					</>
				) : (
					<>
						<span className="flex items-center gap-2">
							<span
								className={`text-[15px] font-semibold ${on ? "text-white" : "text-gray-100"}`}
							>
								{c.label}
							</span>
							{c.key === "moods" && <HueDots tags={d.picked} size={10} />}
						</span>
						<span
							className={`mt-0.5 block w-full truncate text-[12px] ${value ? "text-amber-200/90" : "text-gray-500"}`}
						>
							{value ?? c.idle}
						</span>
					</>
				)}
			</button>
		)
	}
	return (
		<nav aria-label="Filter categories" className="flex flex-col gap-0.5">
			{COMMON.map((c) => item(c, false))}
			<h3 className="mt-5 mb-1 flex items-center gap-2 px-3 text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">
				More
				<span className="h-px flex-1 bg-white/[0.07]" />
			</h3>
			{nicheFor(pieces).map((c) => item(c, true))}
		</nav>
	)
}

function ChipNav({
	d,
	pieces,
	cat,
	onPick,
}: {
	d: ProtoDiscover
	pieces: Pieces
	cat: CatKey
	onPick: (k: CatKey) => void
}) {
	const values = catValues(d, pieces)
	const row = useRef<HTMLDivElement>(null)
	useEffect(() => {
		row.current
			?.querySelector<HTMLElement>(`[data-cat="${cat}"]`)
			?.scrollIntoView({
				block: "nearest",
				inline: "center",
				behavior: "smooth",
			})
	}, [cat])
	const chip = (c: Cat, niche: boolean) => {
		const on = c.key === cat
		const set = values[c.key] !== null
		return (
			<motion.button
				key={c.key}
				type="button"
				data-cat={c.key}
				whileTap={TAP}
				onClick={() => onPick(c.key)}
				aria-current={on ? "page" : undefined}
				className={`relative flex shrink-0 items-center gap-1.5 rounded-full whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
					niche
						? "h-8 px-3 text-[13px]"
						: "h-9 px-3.5 text-[14px] font-semibold"
				} ${
					on
						? "bg-white text-gray-950"
						: niche
							? "text-gray-400 ring-1 ring-inset ring-white/10"
							: "bg-white/[0.08] text-gray-100"
				}`}
			>
				{c.key === "moods" && <HueDots tags={d.picked} size={9} />}
				{c.label}
				{set && (
					<span
						className={`h-1.5 w-1.5 rounded-full ${on ? "bg-amber-600" : "bg-amber-400"}`}
					/>
				)}
			</motion.button>
		)
	}
	return (
		<div
			ref={row}
			className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{COMMON.map((c) => chip(c, false))}
			<span className="ml-2 shrink-0 pr-1 text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">
				More
			</span>
			{nicheFor(pieces).map((c) => chip(c, true))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The palette

function SearchAnswer({
	d,
	text,
	onRun,
	onEdit,
}: {
	d: ProtoDiscover
	text: string
	onRun: (t: string) => void
	onEdit: () => void
}) {
	const typed = text.trim()
	if (typed)
		return (
			<button
				type="button"
				onClick={() => onRun(typed)}
				className="flex h-12 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.12] px-3.5 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<MagnifyingGlassIcon
					className="h-4 w-4 shrink-0 text-amber-300"
					aria-hidden
				/>
				<span className="shrink-0 text-sm font-semibold text-amber-200/80">
					Search the mood:
				</span>
				<span
					className={`brand-header min-w-0 flex-1 truncate text-lg text-white ${PRIVATE}`}
				>
					{typed}
				</span>
				<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
					<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
					Enter
				</kbd>
			</button>
		)
	if (d.q)
		return (
			<div className="flex h-12 min-w-0 items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				<span className="shrink-0 text-[12px] font-semibold text-amber-300/80">
					Mood search
				</span>
				<MoodSearchValue d={d} onEdit={onEdit} />
			</div>
		)
	return (
		<div className="flex h-12 min-w-0 items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			{EXAMPLE_PROMPTS.slice(0, 5).map((prompt) => (
				<button
					key={prompt}
					type="button"
					onClick={() => onRun(prompt)}
					className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-amber-400/[0.07] px-3 text-[13px] whitespace-nowrap text-amber-50/80 ring-1 ring-inset ring-amber-400/20 cursor-pointer outline-none hover:bg-amber-400/[0.14] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<MagnifyingGlassIcon
						className="h-3.5 w-3.5 text-amber-400/70"
						aria-hidden
					/>
					{prompt}
				</button>
			))}
		</div>
	)
}

function PaletteFooter({
	d,
	pieces,
	onDone,
}: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const picks = pieces.chips.filter((c) => c.key !== "services")
	return (
		<footer className="flex shrink-0 flex-col gap-3 border-t border-white/[0.08] bg-gray-950/80 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:flex-row lg:items-center lg:gap-4 lg:px-5 lg:pb-3">
			<div className="flex h-8 min-w-0 flex-1 items-center gap-3">
				{picks.length ? (
					<>
						<OneLineChips
							chips={picks}
							state={d.filters.state}
							onChange={pieces.onChange}
							className="min-w-0 flex-1"
						/>
						<button
							type="button"
							onClick={d.filters.clearSecondary}
							className="shrink-0 text-sm text-gray-400 cursor-pointer hover:text-white"
						>
							Clear all
						</button>
					</>
				) : (
					<span className="text-sm text-gray-500">No filters yet</span>
				)}
			</div>
			<ShowTitlesButton
				counts={d.counts}
				onClick={onDone}
				className="h-11 max-lg:w-full lg:min-w-52"
			/>
		</footer>
	)
}

function Palette({
	d,
	pieces,
	opening,
	onClose,
}: {
	d: ProtoDiscover
	pieces: Pieces
	opening: Opening | null
	onClose: () => void
}) {
	const open = opening !== null
	const [text, setText] = useState("")
	const [cat, setCat] = useState<CatKey>("moods")
	const input = useRef<HTMLInputElement>(null)
	const pane = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!opening) return
		setText("")
		if (opening.at === "cat") setCat(opening.cat)
	}, [opening])
	const pick = (k: CatKey) => {
		setCat(k)
		pane.current?.scrollTo({ top: 0 })
	}
	const run = (value: string) => {
		d.setQ(value)
		onClose()
	}
	const query = text.trim()
	const niche = !COMMON.some((c) => c.key === cat)
	return (
		<Dialog
			open={open}
			onClose={onClose}
			className="relative z-[1100]"
			aria-label="Mood and filters"
		>
			<DialogBackdrop
				transition
				className="fixed inset-0 bg-black/65 transition-opacity duration-200 data-closed:opacity-0"
			/>
			<div className="fixed inset-0 flex lg:items-start lg:justify-center lg:pt-[6vh]">
				<DialogPanel
					transition
					className="flex h-full w-full flex-col overflow-hidden bg-[#0b1120] transition duration-200 ease-out data-closed:translate-y-6 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:h-[min(780px,88vh)] lg:w-[960px] lg:rounded-[20px] lg:shadow-[0_30px_90px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.09)] lg:data-closed:-translate-y-3"
				>
					<header className="shrink-0 px-4 pt-[calc(12px+env(safe-area-inset-top))] lg:px-5 lg:pt-5">
						<div
							className={`flex h-[60px] items-center gap-3 rounded-2xl bg-white/[0.07] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.55)] ${PRIVATE}`}
						>
							<MagnifyingGlassIcon
								className="h-5 w-5 shrink-0 text-amber-300"
								aria-hidden
							/>
							<input
								ref={input}
								data-autofocus={opening?.at === "search" || undefined}
								type="search"
								value={text}
								maxLength={SEARCH_MAX_CHARS}
								autoComplete="off"
								enterKeyHint="search"
								data-ph-no-capture
								aria-label="What's the mood?"
								placeholder="What's the mood?"
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										if (query) run(query)
										else onClose()
									}
								}}
								className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[22px] text-white outline-none placeholder:text-gray-500 focus:ring-0 lg:text-[24px] [&::-webkit-search-cancel-button]:hidden"
							/>
							{text ? (
								<button
									type="button"
									onClick={() => {
										setText("")
										input.current?.focus()
									}}
									aria-label="Clear the text"
									className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 cursor-pointer hover:bg-white/10 hover:text-white"
								>
									<XMarkIcon className="h-4 w-4" />
								</button>
							) : (
								<>
									<kbd className="hidden rounded-md bg-white/10 px-[7px] py-0.5 font-sans text-xs text-gray-300 lg:block">
										Esc
									</kbd>
									<button
										type="button"
										onClick={onClose}
										aria-label="Close"
										className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-300 cursor-pointer hover:bg-white/10 lg:hidden"
									>
										<XMarkIcon className="h-5 w-5" />
									</button>
								</>
							)}
						</div>
						<div className="mt-2">
							<SearchAnswer
								d={d}
								text={text}
								onRun={run}
								onEdit={() => {
									setText(d.q ?? "")
									input.current?.focus()
								}}
							/>
						</div>
					</header>
					{query ? (
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-white/[0.06] px-4 pt-4 pb-6 lg:px-5">
							<h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-gray-400 uppercase">
								<AdjustmentsHorizontalIcon
									className="h-3.5 w-3.5"
									aria-hidden
								/>
								Filters
								<span className="h-px flex-1 bg-white/[0.08]" />
							</h3>
							<FilterGroups data={pieces.groups} query={query} />
						</div>
					) : (
						<div className="flex min-h-0 flex-1 flex-col border-t border-white/[0.06] lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
							<div className="hidden min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-2.5 py-3 lg:block">
								<SideNav
									d={d}
									pieces={pieces}
									cat={cat}
									onPick={pick}
									focusCat={opening?.at === "cat"}
								/>
							</div>
							<div className="shrink-0 px-4 pt-3 pb-2 lg:hidden">
								<ChipNav d={d} pieces={pieces} cat={cat} onPick={pick} />
							</div>
							<div
								ref={pane}
								className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-8 lg:px-7 lg:pt-5"
							>
								<CatPane d={d} pieces={pieces} cat={cat} niche={niche} />
							</div>
						</div>
					)}
					<PaletteFooter d={d} pieces={pieces} onDone={onClose} />
				</DialogPanel>
			</div>
		</Dialog>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The page

function useSlashKey(onOpen: () => void) {
	const latest = useRef(onOpen)
	latest.current = onOpen
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
			const el = e.target as HTMLElement
			if (el.closest("input, textarea, select, [contenteditable=true]")) return
			e.preventDefault()
			e.stopImmediatePropagation()
			latest.current()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
}

/** The bar's big mood field: a button that opens the palette at the search. */
function MoodField({
	d,
	onOpen,
	className = "",
}: { d: ProtoDiscover; onOpen: () => void; className?: string }) {
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.985 }}
			onClick={onOpen}
			aria-haspopup="dialog"
			aria-keyshortcuts="/"
			className={`flex min-w-0 items-center gap-3 rounded-2xl bg-white/[0.06] pr-3 pl-4 text-left ring-1 ring-inset ring-amber-400/35 cursor-pointer outline-none transition-colors hover:bg-white/[0.09] hover:ring-amber-400/60 focus-visible:ring-2 focus-visible:ring-amber-400 ${className}`}
		>
			<MagnifyingGlassIcon
				className="h-5 w-5 shrink-0 text-amber-300"
				aria-hidden
			/>
			{d.q ? (
				<span
					className={`brand-header min-w-0 flex-1 truncate text-[19px] text-white ${PRIVATE}`}
				>
					{d.q}
				</span>
			) : (
				<span className="brand-header min-w-0 flex-1 truncate text-[19px] text-gray-400">
					What's the mood?
				</span>
			)}
			<kbd className="hidden h-6 min-w-6 shrink-0 place-items-center rounded-md bg-white/10 px-1.5 font-sans text-xs font-semibold text-gray-400 lg:grid">
				/
			</kbd>
		</motion.button>
	)
}

function MoodSegment({
	d,
	onClick,
	small = false,
}: { d: ProtoDiscover; onClick: () => void; small?: boolean }) {
	const label = moodLabel(d)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-label={label ? `Mood: ${label}` : "Mood"}
			className={`flex shrink-0 items-center gap-2 whitespace-nowrap font-bold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
				small
					? "h-9 rounded-full px-3 text-sm bg-white/[0.06] ring-1 ring-white/10"
					: `h-12 max-w-[16rem] px-4 text-sm ${SHELL} hover:ring-white/25`
			} ${label ? "text-white" : "text-gray-200"}`}
		>
			<HueDots tags={d.picked} size={small ? 10 : 13} />
			<span className="truncate">{label ?? "Mood"}</span>
		</motion.button>
	)
}

function AllFilters({
	count,
	onClick,
	icon = false,
}: { count: number; onClick: () => void; icon?: boolean }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-label={count ? `All filters, ${count} active` : "All filters"}
			className={`relative flex shrink-0 items-center justify-center gap-2 text-sm font-bold text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} hover:ring-white/25 ${icon ? "h-14 w-14" : "h-12 px-4"}`}
		>
			<AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden />
			{!icon && "All filters"}
			{count > 0 && (
				<span
					className={`grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950 ${icon ? "absolute -top-1.5 -right-1.5 ring-2 ring-gray-950" : ""}`}
				>
					{count}
				</span>
			)}
		</motion.button>
	)
}

function Line({
	children,
	className = "",
}: { children: ReactNode; className?: string }) {
	return (
		<div
			className={`flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
			style={{ maskImage: LINE_FADE, WebkitMaskImage: LINE_FADE }}
		>
			{children}
		</div>
	)
}

export function VariantO({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const navigate = useNavigate()
	const [opening, setOpening] = useState<Opening | null>(null)
	const [sortOpen, setSortOpen] = useState(false)
	useSlashKey(() => setOpening({ at: "search" }))
	const searching = d.q !== null
	const sort = {
		options: discoverSorts(searching, TASTE),
		value: sortShown(d.filters.sort, searching, TASTE),
		onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
		footnote: searching ? undefined : "Relevance joins once you search.",
	}
	const values = mergedChips(pieces.chips.filter((c) => c.key !== "services"))
	const any = values.length > 0 || searching
	const openSearch = () => setOpening({ at: "search" })
	const openCat = (cat: CatKey) => setOpening({ at: "cat", cat })
	const servicesProps = {
		...pieces.servicesProps,
		onAddServices: () => navigate(SERVICES_PATH),
	}
	const count = (
		<span
			className="shrink-0 text-sm whitespace-nowrap text-gray-400"
			aria-live="polite"
		>
			{d.total == null ? (
				"Counting…"
			) : (
				<>
					<RollingNumber value={d.total} className="font-bold text-white" />{" "}
					{searching
						? d.total === 1
							? "match"
							: "matches"
						: d.total === 1
							? "title"
							: "titles"}
				</>
			)}
		</span>
	)
	const valueChips = (
		<>
			<MoodSearchValue d={d} onEdit={openSearch} />
			{values.map((chip) => (
				<ValueChip
					key={chip.key}
					chip={chip}
					onRemove={() => d.filters.update((s) => chip.remove(s))}
				/>
			))}
			{any && (
				<button
					type="button"
					onClick={() => {
						d.filters.clearSecondary()
						if (searching) d.setQ(null)
					}}
					className="shrink-0 px-1 text-sm text-gray-500 cursor-pointer hover:text-white"
				>
					Clear all
				</button>
			)}
		</>
	)

	return (
		<MotionConfig reducedMotion="user">
			<OneCardStyle />
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
				<h1 className="brand-header text-[26px] leading-tight text-white lg:text-[32px]">
					{PAGE_TITLE}
				</h1>

				{/* Desktop: one bar, one status line. */}
				<div className="mt-4 hidden lg:block">
					<div className="flex items-center gap-2.5">
						<MoodField
							d={d}
							onOpen={openSearch}
							className="h-14 min-w-[260px] flex-1 basis-[420px]"
						/>
						<MoodSegment d={d} onClick={() => openCat("moods")} />
						<ServicesControl
							{...servicesProps}
							labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
						/>
						<NotSeenSwitch {...pieces.notSeenProps} compact />
						<SortControl
							{...sort}
							open={sortOpen}
							onOpenChange={setSortOpen}
							align="right"
						/>
						<AllFilters
							count={pieces.secondaryCount}
							onClick={() => openCat("services")}
						/>
					</div>
					<div className="mt-4 flex h-9 items-center gap-3">
						{count}
						{any && (
							<span aria-hidden className="h-4 w-px shrink-0 bg-white/10" />
						)}
						<Line>{valueChips}</Line>
					</div>
				</div>

				{/* Phones: the field and All filters; the essentials and values on one scrolling line. */}
				<div className="mt-3 lg:hidden">
					<div className="flex items-center gap-2">
						<MoodField d={d} onOpen={openSearch} className="h-14 flex-1" />
						<AllFilters
							count={pieces.secondaryCount}
							onClick={() => openCat("moods")}
							icon
						/>
					</div>
					<Line className="-mx-4 mt-3 h-10 pl-4">
						<MoodSegment d={d} onClick={() => openCat("moods")} small />
						<ServicesControl
							{...servicesProps}
							size="sm"
							labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
						/>
						<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
						<span className="max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden shrink-0">
							<SortControl {...sort} size="sm" portal />
						</span>
						{any && (
							<span aria-hidden className="h-4 w-px shrink-0 bg-white/10" />
						)}
						{valueChips}
					</Line>
				</div>

				<div className="mt-3 lg:mt-5">
					<ProtoGrid d={d} />
				</div>
				<Palette
					d={d}
					pieces={pieces}
					opening={opening}
					onClose={() => setOpening(null)}
				/>
			</div>
		</MotionConfig>
	)
}

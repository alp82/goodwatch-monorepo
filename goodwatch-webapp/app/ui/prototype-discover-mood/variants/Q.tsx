// PROTOTYPE - throwaway. Variant Q, "Palette, tiers": L's centered palette with no tabs, the filters tiered by size.
// Page: a static title, one bar (the big mood search field, Mood, Streaming, Not seen yet, Sort, Filters) and one
// status line (count, the mood search as a value with its Read as, every active filter, Clear all). Any of Search,
// Mood or Filters opens the palette: the mood search field large on top; under it the common filters as big blocks
// with their controls inline (Mood across, then Streaming, Not seen yet, Movies or shows, Genre, Score, Released) and
// "More filters", a quiet two-column index of the niche ones that open in place one at a time. Typing shows L's two
// answers instead: "Search the mood" and the filters matching the text. Footer: the active chips and Show N.
// Phones: the palette is full screen and the blocks stack.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import { AdjustmentsHorizontalIcon, ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { FilterGroups, ShowTitlesButton } from "~/ui/filter-bar"
import { OneLineChips } from "~/ui/filter-bar/ActiveFilters"
import { FiltersButton, NotSeenSwitch, ServicesControl, SortControl } from "~/ui/filter-bar/controls"
import { focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { SHELL, TAP } from "~/ui/filter-bar/motion"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { EXAMPLE_PROMPTS, ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	CommonBlocks,
	HueDots,
	NicheIndex,
	type Open,
	PRIVATE,
	type Pieces,
	QueryValue,
	StaticTitle,
	StatusLine,
	moodLabel,
} from "./Q-tiers"

export const NAME = "Palette, tiers"

type Entry = "search" | "mood" | "filters"
const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

function useSort(d: ProtoDiscover) {
	const searching = d.filters.searching
	return {
		options: discoverSorts(searching, "signUp"),
		value: sortShown(d.filters.sort, searching, "signUp"),
		onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
		footnote: searching ? undefined : "Relevance joins once you search.",
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The palette

/** L's separate answer for the typed text: run it as the mood search. */
function SearchTheMood({ text, onRun }: { text: string; onRun: (text: string) => void }) {
	return (
		<section aria-label="Mood search" className="rounded-2xl bg-amber-500/[0.07] p-1.5 ring-1 ring-inset ring-amber-400/25">
			<h3 className={`${SECTION_LABEL} flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-amber-300/90`}>
				<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
				Mood search
			</h3>
			<button
				type="button"
				onClick={() => onRun(text)}
				className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.12] px-3 text-left cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search the mood:</span>
				<span className={`brand-header min-w-0 flex-1 truncate text-xl text-white ${PRIVATE}`}>{text}</span>
				<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
					<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
					Enter
				</kbd>
			</button>
		</section>
	)
}

/** Under the field while nothing is typed: the current mood search as a value, or a few to try, in one line. */
function SearchLine({ d, onRun, onEdit }: { d: ProtoDiscover; onRun: (t: string) => void; onEdit: () => void }) {
	return (
		<div className="-mx-4 flex h-10 items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-5 lg:px-5 [&::-webkit-scrollbar]:hidden">
			{d.q ? (
				<QueryValue d={d} onEdit={onEdit} />
			) : (
				EXAMPLE_PROMPTS.slice(0, 5).map((p) => (
					<motion.button
						key={p}
						type="button"
						whileTap={TAP}
						onClick={() => onRun(p)}
						className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-amber-400/[0.07] px-3 text-[13px] whitespace-nowrap text-amber-50/80 ring-1 ring-inset ring-amber-400/20 cursor-pointer outline-none hover:bg-amber-400/[0.14] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<MagnifyingGlassIcon className="h-3.5 w-3.5 text-amber-400/70" aria-hidden />
						{p}
					</motion.button>
				))
			)}
		</div>
	)
}

function PaletteFooter({ d, pieces, onDone }: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const picks = pieces.chips.filter((c) => c.key !== "services")
	return (
		<footer className="shrink-0 border-t border-white/[0.08] bg-gray-950/80 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:px-5 lg:pb-3">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<div className="flex h-9 min-w-0 flex-1 items-center gap-3">
					{picks.length ? (
						<>
							<OneLineChips chips={picks} state={d.filters.state} onChange={pieces.onChange} className="min-w-0 flex-1" />
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
				<ShowTitlesButton counts={d.counts} onClick={onDone} className="h-11 max-sm:w-full sm:min-w-48" />
			</div>
		</footer>
	)
}

function Palette({
	d,
	pieces,
	entry,
	onClose,
}: { d: ProtoDiscover; pieces: Pieces; entry: Entry | null; onClose: () => void }) {
	const open = entry !== null
	const [text, setText] = useState("")
	const [card, setCard] = useState<Open>(null)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (!open) return
		setText("")
		setCard(null)
		focusSheetOn(null)
	}, [open])
	const run = (value: string) => {
		d.setQ(value)
		onClose()
	}
	const query = text.trim()
	return (
		<Dialog open={open} onClose={onClose} className="relative z-[1100]" aria-label="Mood and filters">
			<DialogBackdrop transition className="fixed inset-0 bg-black/60 transition-opacity duration-200 data-closed:opacity-0" />
			<div className="fixed inset-0 flex flex-col lg:items-center lg:justify-start lg:pt-[6vh]">
				<DialogPanel
					transition
					className="flex h-full flex-col overflow-hidden bg-[#0b1120] shadow-[0_-20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.09)] transition duration-200 ease-out data-closed:translate-y-6 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:h-auto lg:max-h-[88vh] lg:w-[920px] lg:rounded-[18px] lg:data-closed:-translate-y-3"
				>
					<header className="shrink-0 px-4 pt-[calc(12px+env(safe-area-inset-top))] lg:px-5 lg:pt-4">
						<div className="flex items-center gap-2">
							<div
								className={`flex h-[58px] min-w-0 flex-1 items-center gap-3 rounded-[14px] bg-white/[0.07] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)] ${PRIVATE}`}
							>
								<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
								<input
									ref={input}
									// biome-ignore lint/a11y/noAutofocus: opened by the search field to type
									autoFocus={entry === "search"}
									data-autofocus={entry === "search" || undefined}
									type="search"
									value={text}
									maxLength={SEARCH_MAX_CHARS}
									autoComplete="off"
									enterKeyHint="search"
									data-ph-no-capture
									aria-label="Describe a mood or find a filter"
									placeholder="What’s the mood?"
									onChange={(e) => setText(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault()
											if (query) run(query)
											else onClose()
										}
									}}
									className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[24px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
								/>
								{text ? (
									<button
										type="button"
										onClick={() => {
											setText("")
											input.current?.focus()
										}}
										aria-label="Clear the text"
										className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-400 cursor-pointer hover:bg-white/10 hover:text-white"
									>
										<XMarkIcon className="h-4 w-4" />
									</button>
								) : (
									<kbd className="hidden rounded-md bg-white/10 px-[7px] py-0.5 font-sans text-xs text-gray-300 lg:block">Esc</kbd>
								)}
							</div>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close"
								className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-gray-300 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400 lg:hidden"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						{!query && (
							<SearchLine
								d={d}
								onRun={run}
								onEdit={() => {
									setText(d.q ?? "")
									input.current?.focus()
								}}
							/>
						)}
					</header>
					<div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-6 lg:px-5">
						{query ? (
							<>
								<SearchTheMood text={query} onRun={run} />
								<section aria-label="Filters" className="mt-6">
									<h3 className={`${SECTION_LABEL} mb-3 flex items-center gap-2 text-gray-400`}>
										<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" aria-hidden />
										Filters matching “{query}”
										<span className="h-px flex-1 bg-white/[0.08]" />
									</h3>
									<FilterGroups data={pieces.groups} query={query} />
								</section>
							</>
						) : (
							<>
								<CommonBlocks
									d={d}
									pieces={pieces}
									open={card}
									setOpen={setCard}
									moodId="q-mood"
									className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
								/>
								<div className="mt-7">
									<NicheIndex d={d} pieces={pieces} open={card} setOpen={setCard} columns={2} id="q-more" />
								</div>
							</>
						)}
					</div>
					<PaletteFooter d={d} pieces={pieces} onDone={onClose} />
				</DialogPanel>
			</div>
		</Dialog>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The page

/** The big search field on the page: a button that opens the palette to type; shows the mood search once set. */
function SearchField({ d, onOpen, className = "" }: { d: ProtoDiscover; onOpen: () => void; className?: string }) {
	return (
		<div
			className={`relative flex h-12 min-w-0 items-center rounded-2xl bg-white/[0.06] ring-1 transition-colors ${d.q ? "ring-amber-400/50" : "ring-white/15 hover:ring-white/30"} ${className}`}
		>
			<button
				type="button"
				onClick={onOpen}
				aria-haspopup="dialog"
				aria-keyshortcuts="/"
				className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-2xl pr-3 pl-4 text-left cursor-text outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${d.q ? "text-amber-400" : "text-gray-400"}`} aria-hidden />
				{d.q ? (
					<span className={`brand-header min-w-0 flex-1 truncate text-[19px] text-white ${PRIVATE}`}>{d.q}</span>
				) : (
					<span className="brand-header min-w-0 flex-1 truncate text-[19px] text-gray-500">What’s the mood?</span>
				)}
				{!d.q && (
					<kbd className="hidden h-5 min-w-5 place-items-center rounded-md bg-white/10 px-1.5 font-sans text-xs font-semibold text-gray-400 lg:grid">
						/
					</kbd>
				)}
			</button>
			{d.q && (
				<button
					type="button"
					onClick={() => d.setQ(null)}
					aria-label="Remove the mood search"
					className="mr-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-amber-300/80 cursor-pointer outline-none hover:bg-amber-400/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</div>
	)
}

function MoodButton({ d, onClick }: { d: ProtoDiscover; onClick: () => void }) {
	const label = moodLabel(d)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			className={`flex h-12 max-w-[15rem] shrink-0 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} hover:ring-white/25 ${label ? "text-white" : "text-gray-200"}`}
		>
			<HueDots tags={d.picked.filter((t) => t.group === "moods")} size={14} />
			<span className="truncate">{label ?? "Mood"}</span>
		</motion.button>
	)
}

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

export function VariantQ({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const navigate = useNavigate()
	const [entry, setEntry] = useState<Entry | null>(null)
	useSlashKey(() => setEntry("search"))
	const sort = useSort(d)
	const [sortOpen, setSortOpen] = useState(false)
	const servicesProps = { ...pieces.servicesProps, onAddServices: () => navigate(SERVICES_PATH) }
	const filtersButton = (
		<FiltersButton count={pieces.secondaryCount} expanded={entry !== null} onClick={() => setEntry("filters")} compact />
	)

	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
				<StaticTitle />
				{/* The one bar */}
				<div className="mt-3 flex items-center gap-2.5 lg:mt-4">
					<SearchField d={d} onOpen={() => setEntry("search")} className="flex-1 lg:min-w-[360px]" />
					<div className="hidden shrink-0 items-center gap-2.5 lg:flex">
						<MoodButton d={d} onClick={() => setEntry("mood")} />
						<div className="shrink-0 [&_[role=radio]]:w-auto">
							<ServicesControl {...servicesProps} labels={{ ...servicesProps.labels, mine: "My services" }} />
						</div>
						<div className="shrink-0 [&>button]:w-auto">
							<NotSeenSwitch {...pieces.notSeenProps} compact />
						</div>
						<SortControl {...sort} open={sortOpen} onOpenChange={setSortOpen} align="right" />
					</div>
					<div className="shrink-0 max-lg:[&_button]:px-3.5">{filtersButton}</div>
				</div>
				{/* The one status line */}
				<StatusLine
					d={d}
					pieces={pieces}
					onEditQuery={() => setEntry("search")}
					className="mt-2 lg:mt-3"
					lead={
						<span className="flex shrink-0 items-center gap-2 lg:hidden">
							<ServicesControl {...servicesProps} size="sm" labels={{ ...servicesProps.labels, mine: "My services" }} />
							<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
							<motion.button
								type="button"
								whileTap={TAP}
								onClick={() => setEntry("mood")}
								className={`flex h-9 shrink-0 items-center gap-2 px-3 text-sm font-bold text-gray-200 cursor-pointer ${SHELL}`}
							>
								<HueDots tags={d.picked.filter((t) => t.group === "moods")} size={11} />
								{moodLabel(d) ?? "Mood"}
							</motion.button>
						</span>
					}
					trail={
						<div className="shrink-0 lg:hidden max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden">
							<SortControl {...sort} size="sm" align="right" />
						</div>
					}
				/>
				<div className="mt-3 lg:mt-4">
					<ProtoGrid d={d} />
				</div>
				<Palette d={d} pieces={pieces} entry={entry} onClose={() => setEntry(null)} />
			</div>
		</MotionConfig>
	)
}

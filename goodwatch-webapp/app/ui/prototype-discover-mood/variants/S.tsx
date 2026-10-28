// PROTOTYPE - throwaway. Variant S, "Palette with preview": L's palette made into a place you can finish in. The page
// keeps a static title, one bar (a big mood search field that opens the palette, Mood, Streaming, Not seen yet, Sort,
// Filters) and one status line (count, the mood search as a value, every active value, Clear all). The palette is wide
// and in two parts: left the controls (the mood search field large at the top with L's separate "Search the mood"
// answer, then the common filters as compact sections with Mood first, then a quiet "More filters" list of the niche
// ones that expand in place), right a live preview of the first posters with the count. "Show N titles" closes it.
// Phones: the palette is full screen and the preview becomes a slim poster strip above the footer.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import {
	AdjustmentsHorizontalIcon,
	ArrowTurnDownLeftIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useNavigate } from "@remix-run/react"
import { MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, ShowTitlesButton } from "~/ui/filter-bar"
import { NotSeenSwitch, SortControl } from "~/ui/filter-bar/controls"
import { discoverSorts, FILTER_ACCENTS, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { EXAMPLE_PROMPTS, ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	GenreControl,
	HueDots,
	MiniPoster,
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
	ValueChip,
	clearAll,
	groupNote,
	lineChips,
	moodLabel,
	useOpenRows,
} from "./S-filters"

export const NAME = "Palette with preview"

const TASTE = "signUp" as const
const LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const NICHE_KEYS: NicheFilter["key"][] = [
	"themes",
	"styles",
	"runtime",
	"minMatch",
	"sourceScores",
	"scoreGap",
	"similarTo",
	"people",
	"productionCountries",
	"ageLimit",
	"loved",
	"disliked",
]
type OpenAt = "search" | "mood" | "top"

function useSort(d: ProtoDiscover) {
	const searching = d.filters.searching
	return {
		options: discoverSorts(searching, TASTE),
		value: sortShown(d.filters.sort, searching, TASTE),
		onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
		footnote: searching ? undefined : "Relevance joins once you search.",
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The palette's left part

function MoodSearch({ d, text, onRun }: { d: ProtoDiscover; text: string; onRun: (text: string) => void }) {
	const typed = text.trim()
	if (typed)
		return (
			<button
				type="button"
				onClick={() => onRun(typed)}
				className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.12] px-3 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
				<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search the mood</span>
				<span className={`brand-header min-w-0 flex-1 truncate text-lg text-white ${PRIVATE}`}>{typed}</span>
				<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
					<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
					Enter
				</kbd>
			</button>
		)
	if (d.q)
		return (
			<div className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl bg-amber-500/[0.07] px-3 ring-1 ring-inset ring-amber-400/25">
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
				<span className={`min-w-0 shrink truncate text-[15px] font-semibold text-white ${PRIVATE}`}>“{d.q}”</span>
				<span className="hidden min-w-0 flex-1 overflow-hidden sm:block">{d.reading.length > 0 && <ReadAsChips reading={d.reading} />}</span>
				<button
					type="button"
					onClick={() => d.setQ(null)}
					className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-4 w-4" aria-hidden />
					Remove
				</button>
			</div>
		)
	return (
		<div className="-mx-4 flex h-12 items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-6 lg:px-6 [&::-webkit-scrollbar]:hidden">
			{EXAMPLE_PROMPTS.slice(0, 5).map((prompt) => (
				<button
					key={prompt}
					type="button"
					onClick={() => onRun(prompt)}
					className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-amber-400/[0.08] px-3 text-[13px] whitespace-nowrap text-amber-50/80 ring-1 ring-inset ring-amber-400/20 cursor-pointer outline-none hover:bg-amber-400/[0.15] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<MagnifyingGlassIcon className="h-3.5 w-3.5 text-amber-400/70" aria-hidden />
					{prompt}
				</button>
			))}
		</div>
	)
}

function SortChips({ d }: { d: ProtoDiscover }) {
	const sort = useSort(d)
	return (
		<div role="radiogroup" aria-label="Sort" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
			{sort.options.map((s) => {
				const on = s.key === sort.value
				return (
					<button
						key={s.key}
						// biome-ignore lint/a11y/useSemanticElements: chips as a radio group
						type="button"
						role="radio"
						aria-checked={on}
						disabled={s.disabled}
						onClick={() => sort.onChange(s.key)}
						className={`flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							s.disabled ? "text-gray-600 ring-1 ring-white/5" : on ? "bg-white font-semibold text-gray-950 cursor-pointer" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] cursor-pointer"
						}`}
					>
						{s.label}
					</button>
				)
			})}
		</div>
	)
}

function CommonSections({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const navigate = useNavigate()
	const { state } = d.filters
	const moods = d.picked.filter((t) => t.group === "moods")
	return (
		<div className="flex flex-col gap-6">
			<section id="s-mood" aria-label="Mood" className="scroll-mt-4">
				<SectionHead
					label="Mood"
					accent={FILTER_ACCENTS.moods.bar}
					note={groupNote(d, "moods")}
					onClear={moods.length ? () => d.filters.set({ moods: [] }) : undefined}
				/>
				<MoodChips d={d} />
			</section>
			<div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2">
				<section aria-label="Streaming">
					<SectionHead
						label="Streaming"
						accent={FILTER_ACCENTS.services.bar}
						onClear={
							state.onMyServices || state.anyService || state.services?.length
								? () => d.filters.set({ onMyServices: false, anyService: undefined, services: undefined })
								: undefined
						}
					/>
					<StreamingControl d={d} pieces={pieces} limit={6} />
					<div className="mt-2.5 flex flex-wrap items-center gap-2">
						<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
						{!pieces.hasServices && (
							<button
								type="button"
								onClick={() => navigate(SERVICES_PATH)}
								className="h-9 rounded-md px-2 text-[13px] text-gray-400 cursor-pointer hover:text-white"
							>
								Add my services
							</button>
						)}
					</div>
				</section>
				<section aria-label="Movies or shows">
					<SectionHead
						label="Movies or shows"
						accent={FILTER_ACCENTS.type.bar}
						onClear={state.type !== "all" || state.anime !== "any" ? () => d.filters.set({ type: "all", anime: "any" }) : undefined}
					/>
					<TypeControl d={d} />
				</section>
			</div>
			<section aria-label="Genre">
				<SectionHead
					label="Genre"
					accent={FILTER_ACCENTS.genres.bar}
					note={state.genres.length ? "Any of these" : undefined}
					onClear={state.genres.length ? () => d.filters.set({ genres: [] }) : undefined}
				/>
				<GenreControl d={d} limit={10} />
			</section>
			<div className="grid grid-cols-[minmax(0,1fr)] gap-6 sm:grid-cols-2">
				<section aria-label="Score">
					<SectionHead
						label="Score"
						accent={FILTER_ACCENTS.minScore.bar}
						onClear={state.minScore ? () => d.filters.set({ minScore: 0 }) : undefined}
					/>
					<ScoreControl d={d} />
				</section>
				<section aria-label="Released">
					<SectionHead
						label="Released"
						accent={FILTER_ACCENTS.released.bar}
						onClear={state.released !== "any" || state.years ? () => d.filters.set({ released: "any", years: undefined }) : undefined}
					/>
					<ReleasedControl d={d} />
				</section>
			</div>
			<section aria-label="Sort" className="lg:hidden">
				<SectionHead label="Sort" />
				<SortChips d={d} />
			</section>
		</div>
	)
}

function MoreFilters({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const rows = useOpenRows(d, NICHE_KEYS)
	const set = NICHE_KEYS.filter((k) => NICHE[k].value(d)).length
	return (
		<section id="s-more" aria-label="More filters" className="mt-8 border-t border-white/[0.07] pt-4">
			<h3 className={`${LABEL} mb-1 flex items-center gap-2 text-gray-500`}>
				More filters
				{set > 0 && (
					<span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] tracking-normal text-gray-950">
						{set}
					</span>
				)}
			</h3>
			<div className="grid grid-flow-row-dense grid-cols-[minmax(0,1fr)] gap-x-6 sm:grid-cols-2">
				{NICHE_KEYS.map((k) => (
					<div key={k} className={rows.isOpen(k) ? "sm:col-span-2" : ""}>
						<NicheLink f={NICHE[k]} d={d} pieces={pieces} open={rows.isOpen(k)} onToggle={() => rows.toggle(k)} />
					</div>
				))}
			</div>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The preview

function Preview({ d }: { d: ProtoDiscover }) {
	const cards = d.cards.slice(0, 9)
	return (
		<aside aria-label="Preview" className="hidden min-h-0 flex-col border-l border-white/[0.07] bg-black/20 px-5 pt-5 pb-4 lg:flex">
			<div className="flex items-baseline gap-2" aria-live="polite">
				<span className="brand-header text-[28px] leading-none text-white">
					{d.total == null ? "…" : <RollingNumber value={d.total} />}
				</span>
				<span className="text-sm text-gray-400">{d.q ? (d.total === 1 ? "match" : "matches") : d.total === 1 ? "title" : "titles"}</span>
				{d.loading && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="Updating" />}
			</div>
			<div className={`mt-4 grid min-h-0 grid-cols-3 content-start gap-x-2.5 gap-y-3 overflow-hidden transition-opacity duration-200 ${d.loading ? "opacity-50" : ""}`}>
				{cards.map((c) => (
					<MiniPoster key={c.key} card={c} />
				))}
				{!cards.length &&
					(d.loading ? (
						Array.from({ length: 9 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
							<div key={i} className="aspect-[2/3] rounded-lg bg-white/[0.04]" />
						))
					) : (
						<p className="col-span-3 py-10 text-center text-sm text-gray-500">Nothing fits. Remove a value.</p>
					))}
			</div>
		</aside>
	)
}

/** Phones: the preview as a slim strip above the footer. */
function PreviewStrip({ d }: { d: ProtoDiscover }) {
	return (
		<div className="flex h-[76px] shrink-0 items-center gap-3 border-t border-white/[0.07] bg-black/30 pl-4 lg:hidden">
			<div className="w-14 shrink-0 leading-tight" aria-live="polite">
				<span className="block text-[17px] font-bold text-white tabular-nums">{d.total == null ? "…" : <RollingNumber value={d.total} />}</span>
				<span className="text-[11px] text-gray-500">{d.q ? "matches" : "titles"}</span>
			</div>
			<div className={`flex min-w-0 flex-1 gap-1.5 overflow-hidden transition-opacity ${d.loading ? "opacity-50" : ""}`}>
				{d.cards.slice(0, 10).map((c) => (
					<div key={c.key} className="w-10 shrink-0">
						<MiniPoster card={c} showTitle={false} />
					</div>
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function Palette({
	d,
	pieces,
	openAt,
	onClose,
}: { d: ProtoDiscover; pieces: Pieces; openAt: OpenAt | null; onClose: () => void }) {
	const [text, setText] = useState("")
	const input = useRef<HTMLInputElement>(null)
	const open = openAt !== null
	useEffect(() => {
		if (!open) return
		setText("")
		if (openAt !== "mood") return
		const id = setTimeout(() => document.getElementById("s-mood")?.scrollIntoView({ block: "start" }), 60)
		return () => clearTimeout(id)
	}, [open, openAt])
	const run = (value: string) => {
		d.setQ(value)
		setText("")
	}
	const query = text.trim()
	const picks = lineChips(pieces)
	return (
		<Dialog open={open} onClose={onClose} className="relative z-[1100]" aria-label="Mood and filters">
			<DialogBackdrop transition className="fixed inset-0 bg-black/65 transition-opacity duration-200 data-closed:opacity-0" />
			<div className="fixed inset-0 flex flex-col lg:items-center lg:pt-[6vh]">
				<DialogPanel
					transition
					className="flex h-full w-full flex-col overflow-hidden bg-[#0b1120] transition duration-200 ease-out data-closed:translate-y-6 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:h-[min(860px,88vh)] lg:w-[1120px] lg:max-w-[calc(100vw-48px)] lg:rounded-[20px] lg:shadow-[0_30px_90px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.09)] lg:data-closed:-translate-y-3"
				>
					<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_340px]">
						<div className="flex min-h-0 flex-col">
							<header className="shrink-0 px-4 pt-3 pb-1 lg:px-6 lg:pt-5">
								<div className="flex items-center gap-2">
									<div
										className={`flex h-14 min-w-0 flex-1 items-center gap-3 rounded-[14px] bg-white/[0.07] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)] ${PRIVATE}`}
									>
										<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-amber-300/90" aria-hidden />
										<input
											ref={input}
											data-autofocus={openAt === "search" ? true : undefined}
											type="search"
											value={text}
											maxLength={SEARCH_MAX_CHARS}
											autoComplete="off"
											enterKeyHint="search"
											data-ph-no-capture
											aria-label="Describe a mood or find a filter"
											placeholder="What's the mood?"
											onChange={(e) => setText(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault()
													if (query) run(query)
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
										data-autofocus={openAt !== "search" ? true : undefined}
										onClick={onClose}
										aria-label="Close"
										className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 lg:hidden"
									>
										<XMarkIcon className="h-5 w-5" />
									</button>
								</div>
								<div className="mt-2">
									<MoodSearch d={d} text={text} onRun={run} />
								</div>
							</header>
							<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 lg:px-6">
								{query ? (
									<section aria-label="Filters matching">
										<h3 className={`${LABEL} mb-3 flex items-center gap-2 text-gray-400`}>
											<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" aria-hidden />
											Filters matching “{query}”
											<span className="h-px flex-1 bg-white/[0.08]" />
										</h3>
										<FilterGroups data={pieces.groups} query={query} />
									</section>
								) : (
									<>
										<CommonSections d={d} pieces={pieces} />
										<MoreFilters d={d} pieces={pieces} />
									</>
								)}
							</div>
						</div>
						<Preview d={d} />
					</div>
					<PreviewStrip d={d} />
					<footer className="flex shrink-0 items-center gap-3 border-t border-white/[0.08] bg-gray-950/80 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:px-6 lg:pb-3">
						<div className="hidden min-w-0 flex-1 items-center gap-2 overflow-hidden lg:flex">
							{picks.length ? (
								<>
									{picks.slice(0, 5).map((chip) => (
										<ValueChip key={chip.key} chip={chip} onRemove={() => d.filters.update((s) => chip.remove(s))} />
									))}
									{picks.length > 5 && <span className="shrink-0 text-sm text-gray-500">+{picks.length - 5}</span>}
								</>
							) : (
								<span className="text-sm text-gray-600">No filters yet</span>
							)}
						</div>
						<button
							type="button"
							onClick={() => clearAll(d)}
							disabled={!picks.length && !d.q}
							className="shrink-0 rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
						>
							Clear all
						</button>
						<ShowTitlesButton counts={d.counts} onClick={onClose} className="ml-auto h-12 max-lg:flex-1 lg:min-w-52" />
					</footer>
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
			if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return
			e.preventDefault()
			e.stopImmediatePropagation()
			latest.current()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
}

/** The bar's lead: looks like a search field, opens the palette at its field. */
function SearchButton({ d, onClick, className = "" }: { d: ProtoDiscover; onClick: () => void; className?: string }) {
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.99 }}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-keyshortcuts="/"
			className={`group flex min-w-0 items-center gap-3 rounded-2xl pr-3 pl-4 text-left cursor-text outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				d.q ? "bg-amber-400/[0.09] ring-1 ring-amber-400/45" : "bg-white/[0.06] ring-1 ring-white/12 hover:ring-white/25"
			} ${className}`}
		>
			<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${d.q ? "text-amber-300" : "text-gray-400"}`} aria-hidden />
			<span className={`brand-header min-w-0 flex-1 truncate text-[19px] ${d.q ? "text-white" : "text-gray-500"} ${d.q ? PRIVATE : ""}`}>
				{d.q ?? "What's the mood?"}
			</span>
			<kbd className="hidden h-6 min-w-6 shrink-0 place-items-center rounded-md bg-white/10 px-1.5 font-sans text-xs font-semibold text-gray-400 lg:grid">/</kbd>
		</motion.button>
	)
}

function MoodButton({ d, onClick }: { d: ProtoDiscover; onClick: () => void }) {
	const label = moodLabel(d)
	const moods = d.picked.filter((t) => t.group === "moods")
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			className={`flex h-12 max-w-[16rem] shrink-0 items-center gap-2.5 px-4 text-sm font-bold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} hover:ring-white/25 ${label ? "text-white" : "text-gray-200"}`}
		>
			<HueDots tags={moods} size={14} idle />
			<span className="truncate">{label ?? "Mood"}</span>
		</motion.button>
	)
}

function FiltersIcon({ count, onClick, className = "" }: { count: number; onClick: () => void; className?: string }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-label={count ? `Filters, ${count} active` : "Filters"}
			className={`relative flex shrink-0 items-center gap-2 text-sm font-bold text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} hover:ring-white/25 ${className}`}
		>
			<AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden />
			<span className="max-lg:sr-only">Filters</span>
			{count > 0 && (
				<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950 max-lg:absolute max-lg:-top-1.5 max-lg:-right-1.5">
					{count}
				</span>
			)}
		</motion.button>
	)
}

/** Phones: the two essentials as small pills at the start of the status line. */
function PhoneEssentials({ d, pieces, onPick }: { d: ProtoDiscover; pieces: Pieces; onPick: () => void }) {
	const { state } = d.filters
	const mine = state.onMyServices
	const picked = !mine && (state.anyService || state.services?.length)
	const pill = "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
	return (
		<span className="flex shrink-0 items-center gap-1.5 lg:hidden">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={() => (pieces.hasServices ? pieces.servicesProps.onChange(!mine) : onPick())}
				className={`${pill} ${mine || picked ? "bg-emerald-600/25 text-emerald-100 ring-1 ring-inset ring-emerald-400/50" : "bg-white/[0.06] text-gray-200"}`}
			>
				<GlobeAltIcon className="h-3.5 w-3.5" aria-hidden />
				{mine ? "My services" : state.services?.length ? `${state.services.length} services` : state.anyService ? "Any service" : "Everywhere"}
			</motion.button>
			<motion.button
				type="button"
				role="switch"
				aria-checked={state.notSeenYet}
				whileTap={TAP}
				onClick={() => pieces.notSeenProps.onChange(!state.notSeenYet)}
				className={`${pill} ${state.notSeenYet ? "bg-blue-600/25 text-blue-100 ring-1 ring-inset ring-blue-400/50" : "bg-white/[0.06] text-gray-200"}`}
			>
				{state.notSeenYet ? <EyeSlashIcon className="h-3.5 w-3.5" aria-hidden /> : <EyeIcon className="h-3.5 w-3.5" aria-hidden />}
				Not seen yet
			</motion.button>
		</span>
	)
}

export function VariantS({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d, TASTE)
	const [openAt, setOpenAt] = useState<OpenAt | null>(null)
	useSlashKey(() => setOpenAt("search"))
	const sort = useSort(d)
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
				<h1 className="brand-header text-[26px] leading-tight text-white lg:text-[34px]">Discover movies and TV shows</h1>
				{/* The one bar */}
				<div className="mt-3 flex items-center gap-2.5 lg:mt-4">
					<SearchButton d={d} onClick={() => setOpenAt("search")} className="h-12 flex-1 lg:h-14" />
					<div className="hidden items-center gap-2.5 lg:flex">
						<MoodButton d={d} onClick={() => setOpenAt("mood")} />
						<StreamingButton d={d} pieces={pieces} open={openAt !== null} onOpen={() => setOpenAt("top")} />
						<NotSeenSwitch {...pieces.notSeenProps} compact />
						<SortControl {...sort} align="right" />
					</div>
					<FiltersIcon count={pieces.secondaryCount} onClick={() => setOpenAt("top")} className="h-12 px-4 max-lg:w-12 max-lg:justify-center max-lg:px-0 lg:h-14" />
				</div>
				{/* The one status line */}
				<StatusLine
					d={d}
					pieces={pieces}
					onEditQuery={() => setOpenAt("search")}
					className="mt-2"
					lead={
						<PhoneEssentials d={d} pieces={pieces} onPick={() => setOpenAt("top")} />
					}
				/>
				<div className="mt-2 lg:mt-3">
					<ProtoGrid d={d} />
				</div>
				<Palette d={d} pieces={pieces} openAt={openAt} onClose={() => setOpenAt(null)} />
			</div>
		</MotionConfig>
	)
}

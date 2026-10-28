// PROTOTYPE - throwaway. Variant L, "Refine palette": the search heading stays, and next to it one Refine control
// (also the / key) opens a centered palette over the dimmed page. One field, two answers kept apart: the amber "Mood
// search" block runs what was typed as Discover's search; the "Filters" section lists every filter option that
// matches it, with counts (the moods as a row while nothing is typed, then the cards). Picks apply live and show as
// chips in the footer, next to the essentials and a live "Show N titles". On the page, a line under the heading keeps
// the essentials and every active pick in view. Phones: the palette is a full-height sheet; Refine leads that line.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import {
	AdjustmentsHorizontalIcon,
	ArrowTurnDownLeftIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, ShowTitlesButton } from "~/ui/filter-bar"
import { OneLineChips, mergedChips } from "~/ui/filter-bar/ActiveFilters"
import { NotSeenSwitch, ServicesControl, SortControl } from "~/ui/filter-bar/controls"
import { focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { type ActiveChip, FILTER_ACCENTS, discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { Chip } from "~/ui/filter-bar/SheetControls"
import { EXAMPLE_PROMPTS, ProtoGrid, type ProtoDiscover, TAGS, tagId, useFilterPieces } from "../kit"

export const NAME = "Refine palette"

const PRIVATE = "search-private ph-no-capture sentry-mask"
const MOODS = TAGS.filter((t) => t.group === "moods")
const LINE_FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"
const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

type Pieces = ReturnType<typeof useFilterPieces>

// ---------------------------------------------------------------------------------------------------------------

function RefineButton({ count, onClick, className = "" }: { count: number; onClick: () => void; className?: string }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-label={count ? `Refine, ${count} active` : "Refine"}
			aria-keyshortcuts="/"
			className={`flex shrink-0 items-center gap-2 text-sm font-bold text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} hover:ring-white/25 ${className}`}
		>
			<AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden />
			Refine
			{count > 0 && (
				<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950">
					{count}
				</span>
			)}
			<kbd className="hidden h-5 min-w-5 place-items-center rounded-md bg-white/10 px-1.5 font-sans text-xs font-semibold text-gray-400 lg:grid">
				/
			</kbd>
		</motion.button>
	)
}

/** A picked tag on the page line: its hue, and × to take it off. */
function LineChip({ chip, color, onRemove }: { chip: ActiveChip; color?: string; onRemove: () => void }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onRemove}
			aria-label={`Remove ${chip.label}`}
			className={`group inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pr-2.5 pl-3 text-sm outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${color ? "font-semibold text-white" : "bg-white/[0.06] text-gray-100 hover:bg-white/10"}`}
			style={color ? { background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}99` } : undefined}
		>
			{color ? (
				<span className="h-2 w-2 rounded-full" style={{ background: color }} />
			) : (
				<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`} />
			)}
			{chip.label.replace(/^Produced in /, "Made in ")}
			<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

const colorOf = (chip: ActiveChip) => {
	const m = chip.key.match(/^(mood|theme|style)-(.+)$/)
	if (!m) return undefined
	const group = m[1] === "mood" ? "moods" : m[1] === "theme" ? "themes" : "styles"
	return TAGS.find((t) => t.group === group && t.key === m[2])?.color
}

// ---------------------------------------------------------------------------------------------------------------
// The palette

function MoodSearchBlock({
	d,
	text,
	onRun,
	onClear,
}: {
	d: ProtoDiscover
	text: string
	onRun: (text: string) => void
	onClear: () => void
}) {
	const typed = text.trim()
	return (
		<section
			aria-label="Mood search"
			className="rounded-2xl bg-amber-500/[0.07] p-1.5 ring-1 ring-inset ring-amber-400/25"
		>
			<h3 className={`${SECTION_LABEL} flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-amber-300/90`}>
				<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
				Mood search
			</h3>
			{typed ? (
				<button
					type="button"
					onClick={() => onRun(typed)}
					className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.12] px-3 text-left cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search the mood:</span>
					<span className={`brand-header min-w-0 flex-1 truncate text-xl text-white ${PRIVATE}`}>{typed}</span>
					<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
						<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
						Enter
					</kbd>
				</button>
			) : d.q ? (
				<div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-3 py-2">
					<span className={`brand-header min-w-0 truncate text-xl text-white ${PRIVATE}`}>{d.q}</span>
					{d.reading.length > 0 && <ReadAsChips reading={d.reading} />}
					<button
						type="button"
						onClick={onClear}
						className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" aria-hidden />
						Clear
					</button>
				</div>
			) : (
				<div className="flex flex-col">
					{EXAMPLE_PROMPTS.slice(0, 3).map((prompt) => (
						<button
							key={prompt}
							type="button"
							onClick={() => onRun(prompt)}
							className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-amber-50/80 cursor-pointer outline-none hover:bg-amber-400/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
							{prompt}
						</button>
					))}
				</div>
			)}
		</section>
	)
}

function MoodRow({ d }: { d: ProtoDiscover }) {
	const widening = d.picked.some((t) => t.group === "moods")
	return (
		<div className="mb-6">
			<h4 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-white">
				<span className={`h-3.5 w-1 rounded-full ${FILTER_ACCENTS.moods.bar}`} />
				Mood
				{widening && <span className="text-xs font-normal text-gray-500">Counts if added as “or”</span>}
			</h4>
			<div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] lg:-mx-5 lg:px-5 [&::-webkit-scrollbar]:hidden">
				{MOODS.map((t) => (
					<div key={tagId(t)} className="shrink-0" title={t.description}>
						<Chip
							o={{
								id: tagId(t),
								label: t.name,
								active: d.isOn(t),
								count: d.countFor(t),
								toggle: () => d.toggle(t),
								swatch: <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />,
							}}
						/>
					</div>
				))}
			</div>
		</div>
	)
}

function PaletteFooter({ d, pieces, onDone }: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const picks = pieces.chips.filter((c) => c.key !== "services")
	return (
		<footer className="shrink-0 border-t border-white/[0.08] bg-gray-950/80 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:px-5 lg:pb-3">
			<div className="flex h-8 items-center gap-3">
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
			<div className="mt-3 flex flex-wrap items-center gap-2 lg:flex-nowrap">
				<ServicesControl
					{...pieces.servicesProps}
					size="sm"
					labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
				/>
				<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
				<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto h-11 max-sm:w-full" />
			</div>
		</footer>
	)
}

function Palette({ d, pieces, open, onClose }: { d: ProtoDiscover; pieces: Pieces; open: boolean; onClose: () => void }) {
	const [text, setText] = useState("")
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (open) {
			setText("")
			focusSheetOn(null)
		}
	}, [open])
	const run = (value: string) => {
		d.setQ(value)
		onClose()
	}
	const query = text.trim()
	return (
		<Dialog open={open} onClose={onClose} className="relative z-[1100]" aria-label="Refine">
			<DialogBackdrop
				transition
				className="fixed inset-0 bg-black/60 transition-opacity duration-200 data-closed:opacity-0"
			/>
			<div className="fixed inset-0 flex flex-col justify-end lg:items-center lg:justify-start lg:pt-[9vh]">
				<DialogPanel
					transition
					className="flex h-[calc(100%-12px)] flex-col overflow-hidden rounded-t-3xl bg-[#0b1120] shadow-[0_-20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.09)] transition duration-200 ease-out data-closed:translate-y-9 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:h-auto lg:max-h-[82vh] lg:w-[800px] lg:rounded-[18px] lg:data-closed:-translate-y-3"
				>
					<span aria-hidden className="mx-auto mt-2.5 block h-[5px] w-10 shrink-0 rounded-full bg-white/25 lg:hidden" />
					<header className="shrink-0 px-4 pt-3 pb-3 lg:px-5 lg:pt-4">
						<div className={`flex h-[54px] items-center gap-2.5 rounded-[14px] bg-white/[0.07] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)] ${PRIVATE}`}>
							<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
							<input
								ref={input}
								// biome-ignore lint/a11y/noAutofocus: the palette opens to type
								autoFocus
								data-autofocus
								type="search"
								value={text}
								maxLength={SEARCH_MAX_CHARS}
								autoComplete="off"
								enterKeyHint="search"
								data-ph-no-capture
								aria-label="Describe a mood or find a filter"
								placeholder="A mood, a genre, a name"
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										if (query) run(query)
										else onClose()
									}
								}}
								className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[22px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
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
					</header>
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 lg:px-5">
						<MoodSearchBlock d={d} text={text} onRun={run} onClear={() => d.setQ(null)} />
						<section aria-label="Filters" className="mt-6">
							<h3 className={`${SECTION_LABEL} mb-3 flex items-center gap-2 text-gray-400`}>
								<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" aria-hidden />
								{query ? <>Filters matching “{query}”</> : "Filters"}
								<span className="h-px flex-1 bg-white/[0.08]" />
							</h3>
							{!query && <MoodRow d={d} />}
							<FilterGroups data={pieces.groups} query={query} />
						</section>
					</div>
					<PaletteFooter d={d} pieces={pieces} onDone={onClose} />
				</DialogPanel>
			</div>
		</Dialog>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function useSlashKey(onOpen: () => void) {
	const latest = useRef(onOpen)
	latest.current = onOpen
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
			const el = e.target as HTMLElement
			if (el.closest("input, textarea, select, [contenteditable=true]")) return
			// Before the site's own "/" (the Ctrl K search): on this page "/" refines.
			e.preventDefault()
			e.stopImmediatePropagation()
			latest.current()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
}

function Line({ children }: { children: ReactNode }) {
	return (
		<div
			className="-mx-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-8 pl-4 [scrollbar-width:none] lg:mx-0 lg:pl-0 [&::-webkit-scrollbar]:hidden"
			style={{ maskImage: LINE_FADE, WebkitMaskImage: LINE_FADE }}
		>
			{children}
		</div>
	)
}

export function VariantL({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [open, setOpen] = useState(false)
	useSlashKey(() => setOpen(true))
	const searching = d.q !== null
	const picks = mergedChips(pieces.chips.filter((c) => c.key !== "services"))
	const refineCount = pieces.secondaryCount
	const sorts = discoverSorts(searching, "signUp")
	const sort = sortShown(d.filters.sort, searching, "signUp")
	const openPalette = () => setOpen(true)

	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
				<div className="flex items-start gap-4">
					<div className="min-w-0 flex-1">
						<DiscoverHeading
							q={d.q}
							onSearch={(text) => d.setQ(text || null)}
							onClear={() => d.setQ(null)}
							explanation={d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null}
						/>
					</div>
					<RefineButton count={refineCount} onClick={openPalette} className="mt-1 hidden h-12 px-4 lg:mt-2 lg:flex" />
				</div>
				<div className="mt-3 flex h-12 items-center gap-3 lg:mt-4">
					<Line>
						<RefineButton count={refineCount} onClick={openPalette} className="h-9 rounded-full px-3.5 lg:hidden" />
						<ServicesControl
							{...pieces.servicesProps}
							size="sm"
							labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
						/>
						<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
						{picks.length > 0 && <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />}
						{picks.map((chip) => (
							<LineChip
								key={chip.key}
								chip={chip}
								color={colorOf(chip)}
								onRemove={() => d.filters.update((s) => chip.remove(s))}
							/>
						))}
						{picks.length > 1 && (
							<button
								type="button"
								onClick={d.filters.clearSecondary}
								className="shrink-0 px-1 text-sm text-gray-500 cursor-pointer hover:text-white"
							>
								Clear all
							</button>
						)}
					</Line>
					<div className="max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden flex shrink-0 items-center gap-3">
						<span className="hidden text-sm whitespace-nowrap text-gray-400 lg:inline" aria-live="polite">
							{d.total == null ? (
								"Counting…"
							) : (
								<>
									<RollingNumber value={d.total} className="font-bold text-white" />{" "}
									{searching ? (d.total === 1 ? "match" : "matches") : d.total === 1 ? "title" : "titles"}
								</>
							)}
						</span>
						<SortControl
							options={sorts}
							value={sort}
							onChange={(key) => d.filters.setSort(key as typeof d.filters.sort)}
							size="sm"
							align="right"
							footnote={searching ? undefined : "Relevance joins once you search."}
						/>
					</div>
				</div>
				<div className="mt-3 lg:mt-5">
					<ProtoGrid d={d} />
				</div>
				<Palette d={d} pieces={pieces} open={open} onClose={() => setOpen(false)} />
			</div>
		</MotionConfig>
	)
}

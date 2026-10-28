// PROTOTYPE - throwaway. Variant G, "Recipe line": the search heading, then one line that holds everything shaping
// the list, in order: how the search read the query, the picked tags, the essentials (where to watch, Not seen yet),
// every other active filter, then "+ Add" and a few honest next tags. Count and sort end the line. "+ Add" opens one
// panel right under the line (a popover on desktop, a snap sheet on phones): the filter search, then the real card
// stack (Mood, popular tiles, every other filter). Nothing narrows the list from anywhere else.
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, FilterSearchField, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { mergedChips } from "~/ui/filter-bar/ActiveFilters"
import { NotSeenSwitch, ServicesControl, SortControl } from "~/ui/filter-bar/controls"
import { type CardKey, cardOf, focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { type ActiveChip, FILTER_ACCENTS, discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { MENU, RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { ProtoGrid, type ProtoDiscover, TAGS, type Tag, short, tagId, useFilterPieces } from "../kit"

export const NAME = "Recipe line"

const TAG_CHIP = /^(mood|theme|style)-/
const NEXT_TAGS = 5
const LINE_FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"

// ---------------------------------------------------------------------------------------------------------------

function useIsPhone() {
	const [phone, setPhone] = useState(false)
	useEffect(() => {
		const query = window.matchMedia("(max-width: 1023px)")
		const update = () => setPhone(query.matches)
		update()
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	return phone
}

/** A thin rule between the line's parts. */
const Rule = () => <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />

function PickedTag({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onRemove}
			title={tag.description}
			aria-label={`Remove ${tag.name}`}
			className="group inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full pr-2.5 pl-3 text-sm font-semibold text-white outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
			style={{ background: `${tag.color}2e`, boxShadow: `inset 0 0 0 1px ${tag.color}99` }}
		>
			<span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />
			{tag.name}
			<XMarkIcon className="h-3.5 w-3.5 text-white/60 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

function FilterChip({ chip, onOpen, onRemove }: { chip: ActiveChip; onOpen: () => void; onRemove: () => void }) {
	return (
		<span className="flex h-9 shrink-0 items-center rounded-full bg-white/[0.06] text-sm text-gray-100">
			<button
				type="button"
				onClick={onOpen}
				aria-label={`Change ${chip.label}`}
				className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-l-full pr-1 pl-3 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`} />
				{chip.label.replace(/^Produced in /, "Made in ")}
			</button>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${chip.label}`}
				className="grid h-9 w-8 place-items-center rounded-r-full text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</span>
	)
}

function NextTag({ tag, count, onClick }: { tag: Tag; count: number; onClick: () => void }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			title={tag.description}
			aria-label={`Add ${tag.name}, ${count} titles`}
			className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm text-gray-300 ring-1 ring-inset ring-white/10 outline-none transition-colors cursor-pointer hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span className="h-2 w-2 rounded-full opacity-80" style={{ background: tag.color }} />
			{tag.name}
			<span className="text-xs tabular-nums text-gray-500">{short(count)}</span>
		</motion.button>
	)
}

const AddButton = forwardRef<HTMLButtonElement, { open: boolean; onClick: () => void; className?: string }>(
	function AddButton({ open, onClick, className = "" }, ref) {
		return (
			<motion.button
				ref={ref}
				type="button"
				whileTap={TAP}
				onClick={onClick}
				aria-haspopup="dialog"
				aria-expanded={open}
				className={`h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pr-3.5 pl-3 text-sm font-bold outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${open ? "bg-white text-gray-950" : "bg-white/[0.08] text-white ring-1 ring-white/15 hover:ring-white/30"} ${className}`}
			>
				<PlusIcon className="h-4 w-4" aria-hidden />
				Add
			</motion.button>
		)
	},
)

// ---------------------------------------------------------------------------------------------------------------

/** Tags worth adding next: from groups with no pick yet, so each count is what adding it would leave. */
function useNextTags(d: ProtoDiscover) {
	const total = d.total
	const pickedGroups = new Set(d.picked.map((t) => t.group))
	const sig = d.picked.map(tagId).join()
	return useMemo(() => {
		if (total == null) return []
		// Nothing picked yet: the moods lead. Afterwards, the other groups, best count first.
		const pool = TAGS.filter((t) => !pickedGroups.has(t.group) && (pickedGroups.size > 0 || t.group === "moods"))
		return pool
			.map((t) => ({ t, n: d.countFor(t) }))
			.filter((x): x is { t: Tag; n: number } => x.n != null && x.n > 0 && x.n < total)
			.sort((a, b) => b.n - a.n)
			.slice(0, NEXT_TAGS)
		// d changes every render; the counts come with total and the picks.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [total, d.counts, sig])
}

// ---------------------------------------------------------------------------------------------------------------

/** The panel under the line: the filter search, then the cards (or every matching option while searching). */
function PanelBody({
	pieces,
	query,
	setQuery,
	searchRef,
}: {
	pieces: ReturnType<typeof useFilterPieces>
	query: string
	setQuery: (q: string) => void
	searchRef: React.RefObject<HTMLInputElement>
}) {
	return (
		<>
			<div className="px-4 pt-3 pb-3 lg:px-5 lg:pt-4">
				<FilterSearchField value={query} onChange={setQuery} inputRef={searchRef} />
			</div>
			<div className="px-4 pb-6 lg:px-5">
				<FilterGroups data={pieces.groups} query={query} />
			</div>
		</>
	)
}

function PanelFooter({ d, secondary, onClose }: { d: ProtoDiscover; secondary: number; onClose: () => void }) {
	const anything = d.picked.length > 0 || secondary > 0
	return (
		<footer className="flex shrink-0 items-center gap-4 border-t border-white/5 bg-gray-950/90 px-4 py-3 lg:px-5">
			<button
				type="button"
				onClick={d.filters.clearSecondary}
				disabled={!anything}
				className="text-sm text-gray-400 cursor-pointer hover:text-white disabled:cursor-default disabled:text-gray-600"
			>
				Clear all
			</button>
			<span className="flex-1 text-right text-xs tabular-nums text-gray-500">
				{d.counts?.hidden ? `${d.counts.hidden.toLocaleString("en")} hidden` : ""}
			</span>
			<ShowTitlesButton counts={d.counts} onClick={onClose} className="h-11" />
		</footer>
	)
}

/** Desktop: a popover hanging from the line, under "+ Add" where there's room. */
function AddPopover({
	open,
	onClose,
	anchor,
	line,
	children,
	footer,
}: {
	open: boolean
	onClose: () => void
	anchor: HTMLElement | null
	line: HTMLElement | null
	children: ReactNode
	footer: ReactNode
}) {
	const panel = useRef<HTMLDivElement>(null)
	const [left, setLeft] = useState(0)
	useLayoutEffect(() => {
		if (!open || !anchor || !line) return
		const place = () => {
			const box = line.getBoundingClientRect()
			const at = anchor.getBoundingClientRect().left - box.left - 12
			const width = panel.current?.offsetWidth ?? 560
			setLeft(Math.max(0, Math.min(at, box.width - width)))
		}
		place()
		window.addEventListener("resize", place)
		return () => window.removeEventListener("resize", place)
	}, [open, anchor, line])
	// Closes on Escape and a press outside the panel and the line (the line's chips stay usable while it's open).
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const onDown = (e: PointerEvent) => {
			const target = e.target as Node
			if (panel.current?.contains(target) || line?.contains(target)) return
			// Menus the cards open in a portal (pickers) live under body.
			if ((target as HTMLElement).closest?.("[role=menu],[role=listbox]")) return
			onClose()
		}
		document.addEventListener("keydown", onKey)
		document.addEventListener("pointerdown", onDown)
		return () => {
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("pointerdown", onDown)
		}
	}, [open, onClose, line])
	return (
		<AnimatePresence>
			{open && (
				<motion.div
					ref={panel}
					role="dialog"
					aria-label="Add to the list"
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -6 }}
					transition={{ duration: 0.16 }}
					style={{ left }}
					className={`absolute top-full z-50 mt-2 flex max-h-[min(72vh,760px)] w-[560px] flex-col overflow-hidden ${MENU}`}
				>
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
					{footer}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function RecipeLine({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const phone = useIsPhone()
	const [open, setOpen] = useState(false)
	const [sheet, setSheet] = useState(-1)
	const [query, setQuery] = useState("")
	const search = useRef<HTMLInputElement>(null)
	const [line, setLine] = useState<HTMLDivElement | null>(null)
	const [add, setAdd] = useState<HTMLButtonElement | null>(null)
	const next = useNextTags(d)
	const searching = d.q !== null

	const openPanel = (card: CardKey | null = null) => {
		focusSheetOn(card)
		setQuery("")
		if (phone) setSheet(1)
		else setOpen(true)
	}
	const closePanel = () => {
		setOpen(false)
		setSheet(-1)
	}
	const toggle = () => (open || sheet >= 0 ? closePanel() : openPanel())
	useEffect(() => {
		if (open) search.current?.focus({ preventScroll: true })
	}, [open])

	const others = mergedChips(pieces.chips.filter((c) => !TAG_CHIP.test(c.key) && c.key !== "services"))
	const sorts = discoverSorts(searching, "signUp")
	const sort = sortShown(d.filters.sort, searching, "signUp")
	const showRead = searching && (d.reading.length > 0 || d.searchBusy)

	const panelBody = <PanelBody pieces={pieces} query={query} setQuery={setQuery} searchRef={search} />
	const footer = <PanelFooter d={d} secondary={pieces.secondaryCount} onClose={closePanel} />

	return (
		<div ref={setLine} className="relative mt-3 flex h-12 items-center gap-3 lg:mt-4">
			<div
				className="-ml-4 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pr-8 pl-4 [scrollbar-width:none] lg:ml-0 lg:pl-0 [&::-webkit-scrollbar]:hidden"
				style={{ maskImage: LINE_FADE, WebkitMaskImage: LINE_FADE }}
			>
				{showRead && (
					<>
						<span className="flex shrink-0 items-center gap-2">
							<span className="text-xs text-gray-500">Read as</span>
							{d.reading.length ? (
								<span className="shrink-0">
									<ReadAsChips reading={d.reading} />
								</span>
							) : (
								<span className="text-xs text-gray-500">…</span>
							)}
						</span>
						<Rule />
					</>
				)}
				{d.picked.length > 0 && (
					<>
						{d.picked.map((t) => (
							<PickedTag key={tagId(t)} tag={t} onRemove={() => d.toggle(t)} />
						))}
						<Rule />
					</>
				)}
				<ServicesControl
					{...pieces.servicesProps}
					size="sm"
					labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
					onAddServices={() => openPanel("services")}
				/>
				<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
				{others.length > 0 && <Rule />}
				{others.map((chip) => (
					<FilterChip
						key={chip.key}
						chip={chip}
						onOpen={() => openPanel(cardOf(chip.group))}
						onRemove={() => d.filters.update((s) => chip.remove(s))}
					/>
				))}
				<AddButton ref={setAdd} open={open} onClick={toggle} className="hidden lg:inline-flex" />
				{next.map(({ t, n }) => (
					<NextTag key={tagId(t)} tag={t} count={n} onClick={() => d.toggle(t)} />
				))}
			</div>
			<div className="max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden flex shrink-0 items-center gap-2 lg:gap-3">
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
				{/* Phones: "+ Add" stays in reach at the line's end, however far the line runs. */}
				<AddButton open={sheet >= 0} onClick={toggle} className="inline-flex lg:hidden" />
			</div>
			{!phone && (
				<AddPopover open={open} onClose={closePanel} anchor={add} line={line} footer={footer}>
					{panelBody}
				</AddPopover>
			)}
			{phone && (
				<SnapSheet
					index={sheet}
					onIndex={setSheet}
					label="Add to the list"
					initialFocus={search}
					footer={footer}
					header={<h2 className="brand-header px-4 pb-1 text-xl text-white">Add to the list</h2>}
				>
					{panelBody}
				</SnapSheet>
			)}
		</div>
	)
}

export function VariantG({ d }: { d: ProtoDiscover }) {
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
				<DiscoverHeading q={d.q} onSearch={(text) => d.setQ(text || null)} onClear={() => d.setQ(null)} explanation={null} />
				<RecipeLine d={d} />
				<div className="mt-3 lg:mt-5">
					<ProtoGrid d={d} />
				</div>
			</div>
		</MotionConfig>
	)
}

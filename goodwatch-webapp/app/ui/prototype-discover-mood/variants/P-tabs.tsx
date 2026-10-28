// PROTOTYPE - throwaway. The tabbed filter content variants P (palette) and T (bar) share: three tabs that split the
// filters by intent and by how often they're used.
// - Vibe: the mood search's state (examples, or the current query with its Read as), the moods as large chips, then
//   About and Style folded to one line each (copied from M-vibe).
// - Basics: the common filters as full controls: Streaming (the real card) with Not seen yet, Movies or shows, Genre,
//   Score, Released.
// - More filters: the niche ones as compact rows in three groups; a row opens the real card for that filter under it,
//   one at a time.
// Also the shared page pieces: the static title, the status line (count, the mood search as a value, active values,
// Clear all), the panel footer, and Clear all that also takes the mood search away.
import { AdjustmentsHorizontalIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useNavigate, useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import type { FilterState } from "~/domain/filter-state"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, ShowTitlesButton } from "~/ui/filter-bar"
import { OneLineChips, mergedChips } from "~/ui/filter-bar/ActiveFilters"
import { type CardKey, cardOf, focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { FiltersButton, NotSeenSwitch, ServicesControl, SortControl } from "~/ui/filter-bar/controls"
import {
	type ActiveChip,
	ANIME_LABELS,
	FILTER_ACCENTS,
	RELEASED_LABELS,
	TYPE_LABELS,
	compactCount,
	discoverSorts,
	sortShown,
} from "~/ui/filter-bar/labels"
import { RollingNumber, SHELL, TAP } from "~/ui/filter-bar/motion"
import { SERVICES_PATH } from "~/ui/settings/paths"
import { Chip, ChipList, type Option, RangeSlider, Segmented, ThresholdBar, byCount } from "~/ui/filter-bar/SheetControls"
import { goodwatchVibeIndex } from "~/utils/ratings"
import { EXAMPLE_PROMPTS, GROUP_LABEL, type ProtoDiscover, TAGS, type Tag, type TagGroup, tagId, type useFilterPieces } from "../kit"

export type Pieces = ReturnType<typeof useFilterPieces>
export type TabKey = "vibe" | "basics" | "more"
/** Where the tab content sits: the centered palette (two columns), the wide bar panel (three), or a phone (one). */
export type Layout = "palette" | "panel" | "phone"

export const TABS: { key: TabKey; label: string }[] = [
	{ key: "vibe", label: "Vibe" },
	{ key: "basics", label: "Basics" },
	{ key: "more", label: "More filters" },
]

export const PRIVATE = "search-private ph-no-capture sentry-mask"
export const SOLID_PANEL =
	"bg-[#0b1120] ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)]"

const VIBE_GROUPS = new Set(["moods", "themes", "styles"])
const BASIC_GROUPS = new Set(["services", "type", "anime", "genres", "minScore", "released", "years", "notSeenYet"])
export const tabOf = (chip: ActiveChip): TabKey =>
	VIBE_GROUPS.has(chip.group) ? "vibe" : BASIC_GROUPS.has(chip.group) ? "basics" : "more"

/** Active values per tab, for the tab badges. */
export function tabCounts(pieces: Pieces): Record<TabKey, number> {
	const out = { vibe: 0, basics: 0, more: 0 }
	for (const c of mergedChips(pieces.chips)) if (c.group !== "notSeenYet") out[tabOf(c)]++
	return out
}

const clearChips = (d: ProtoDiscover, chips: ActiveChip[]) =>
	d.filters.update((s) => chips.reduce<FilterState>((acc, c) => c.remove(acc), s))

// ---------------------------------------------------------------------------------------------------------------
// Clear all: the filters, then the mood search once the URL has the cleared filters (two URL writes in one tick would
// undo each other).

export function useClearAll(d: ProtoDiscover, pieces: Pieces) {
	const [params] = useSearchParams()
	const key = params.toString()
	const waiting = useRef<string | null>(null)
	useEffect(() => {
		if (waiting.current === null || waiting.current === key) return
		waiting.current = null
		if (d.q) d.setQ(null)
	}, [key, d])
	const count = pieces.secondaryCount + (d.q ? 1 : 0)
	const clear = () => {
		if (pieces.secondaryCount && d.q) {
			waiting.current = key
			d.filters.clearSecondary()
		} else if (d.q) d.setQ(null)
		else d.filters.clearSecondary()
	}
	return { count, clear }
}

// ---------------------------------------------------------------------------------------------------------------
// Page pieces

export function PageTitle() {
	return (
		<h1 className="brand-header text-[21px] leading-tight text-white sm:text-[26px] lg:text-[34px]">Discover movies and TV shows</h1>
	)
}

const colorOf = (chip: ActiveChip) => {
	const m = chip.key.match(/^(mood|theme|style)-(.+)$/)
	if (!m) return undefined
	const group = m[1] === "mood" ? "moods" : m[1] === "theme" ? "themes" : "styles"
	return TAGS.find((t) => t.group === group && t.key === m[2])?.color
}

/** An active value on the status line: its hue (tags) or its filter's dot, and × to take it off. */
export function ValueChip({ chip, onRemove }: { chip: ActiveChip; onRemove: () => void }) {
	const color = colorOf(chip)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onRemove}
			aria-label={`Remove ${chip.label}`}
			className={`group inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pr-2 pl-2.5 text-[13px] outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${color ? "font-semibold text-white" : "bg-white/[0.06] text-gray-100 hover:bg-white/10"}`}
			style={color ? { background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}99` } : undefined}
		>
			<span
				className={`h-2 w-2 rounded-full ${color ? "" : FILTER_ACCENTS[chip.group].dot}`}
				style={color ? { background: color } : undefined}
			/>
			{chip.label.replace(/^Produced in /, "Made in ")}
			<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

/** The mood search as a value: the query in quotes, removable, amber like the search. */
export function QueryChip({ d }: { d: ProtoDiscover }) {
	if (!d.q) return null
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={() => d.setQ(null)}
			aria-label={`Remove the mood search ${d.q}`}
			className={`group inline-flex h-8 max-w-[22rem] shrink-0 items-center gap-1.5 rounded-full bg-amber-400/[0.12] pr-2 pl-2.5 text-[13px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-400/40 outline-none cursor-pointer hover:bg-amber-400/20 focus-visible:ring-2 focus-visible:ring-amber-400 ${PRIVATE}`}
		>
			<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
			<span className="truncate">“{d.q}”</span>
			<XMarkIcon className="h-3.5 w-3.5 shrink-0 text-amber-400/60 group-hover:text-white" aria-hidden />
		</motion.button>
	)
}

const LINE_FADE = "linear-gradient(to right, black calc(100% - 2.5rem), transparent)"

/**
 * The one line under the bar: how many, the mood search as a value with its Read as, every other active value, and
 * Clear all. `lead` goes first on phones (the essentials). Fixed height; it scrolls sideways instead of wrapping.
 */
export function StatusLine({
	d,
	pieces,
	lead,
	className = "",
}: { d: ProtoDiscover; pieces: Pieces; lead?: ReactNode; className?: string }) {
	const all = useClearAll(d, pieces)
	const values = mergedChips(pieces.chips.filter((c) => c.key !== "services" || !d.filters.state.onMyServices))
	const searching = d.q !== null
	return (
		<div
			className={`-mx-4 flex h-10 min-w-0 items-center gap-2 overflow-x-auto pr-10 pl-4 [scrollbar-width:none] lg:mx-0 lg:pl-0 [&::-webkit-scrollbar]:hidden ${className}`}
			style={{ maskImage: LINE_FADE, WebkitMaskImage: LINE_FADE }}
		>
			{lead}
			<span className="shrink-0 pr-1 text-sm whitespace-nowrap text-gray-400" aria-live="polite">
				{d.total == null ? (
					"Counting…"
				) : (
					<>
						<RollingNumber value={d.total} className="font-bold text-white" />{" "}
						{searching ? (d.total === 1 ? "match" : "matches") : d.total === 1 ? "title" : "titles"}
					</>
				)}
			</span>
			{(d.q || values.length > 0) && <span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />}
			<QueryChip d={d} />
			{d.q && d.searchBusy && !d.reading.length && <span className="shrink-0 text-xs text-gray-500">Reading…</span>}
			{d.q && d.reading.length > 0 && (
				<span className="flex shrink-0 items-center gap-1.5">
					<span className="text-xs text-gray-500">Read as</span>
					<ReadAsChips reading={d.reading} className="flex-nowrap" />
				</span>
			)}
			{values.map((chip) => (
				<ValueChip key={chip.key} chip={chip} onRemove={() => d.filters.update((s) => chip.remove(s))} />
			))}
			{all.count > 1 && (
				<button
					type="button"
					onClick={all.clear}
					className="shrink-0 px-1 text-sm whitespace-nowrap text-gray-500 cursor-pointer hover:text-white"
				>
					Clear all
				</button>
			)}
		</div>
	)
}

/** The panel's footer: optionally the active values as chips, Clear all, and Show N titles. */
export function PanelFooter({
	d,
	pieces,
	onDone,
	chips = false,
}: { d: ProtoDiscover; pieces: Pieces; onDone: () => void; chips?: boolean }) {
	const all = useClearAll(d, pieces)
	const picks = pieces.chips.filter((c) => c.key !== "services" || !d.filters.state.onMyServices)
	return (
		<footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-white/[0.08] bg-[#0b1120] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:flex-nowrap lg:px-6 lg:pb-3">
			{chips && (
				<div className="flex h-8 min-w-0 basis-full items-center lg:basis-auto lg:flex-1">
					{picks.length ? (
						<OneLineChips chips={picks} state={d.filters.state} onChange={pieces.onChange} className="min-w-0 flex-1" />
					) : (
						<span className="text-sm text-gray-500">No filters yet</span>
					)}
				</div>
			)}
			<button
				type="button"
				onClick={all.clear}
				disabled={!all.count}
				className="shrink-0 rounded-md px-1 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				Clear all
			</button>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className={`h-11 min-w-44 ${chips ? "" : "ml-auto"} max-lg:flex-1`} />
		</footer>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The tabs: today's profile tab look (amber underline), with a badge for what's set inside.

export function TabStrip({
	tab,
	onTab,
	counts,
	right,
	className = "",
}: {
	tab: TabKey
	onTab: (tab: TabKey) => void
	counts: Record<TabKey, number>
	right?: ReactNode
	className?: string
}) {
	return (
		<div className={`flex items-center gap-3 border-b border-white/10 ${className}`}>
			<div
				role="tablist"
				aria-label="Filters"
				className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]"
				onKeyDown={(e) => {
					if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
					const i = TABS.findIndex((t) => t.key === tab)
					const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]
					onTab(next.key)
					;(e.currentTarget.querySelector(`[data-tab="${next.key}"]`) as HTMLElement | null)?.focus()
				}}
			>
				{TABS.map((t) => {
					const on = t.key === tab
					const n = counts[t.key]
					return (
						<button
							key={t.key}
							type="button"
							role="tab"
							data-tab={t.key}
							aria-selected={on}
							tabIndex={on ? 0 : -1}
							onClick={() => onTab(t.key)}
							className={`-mb-px flex min-h-12 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-[15px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
								on ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-100"
							}`}
						>
							{t.label}
							{n > 0 && (
								<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-bold tabular-nums text-gray-950">
									{n}
								</span>
							)}
						</button>
					)
				})}
			</div>
			{right && <div className="ml-auto flex min-w-0 shrink items-center">{right}</div>}
		</div>
	)
}

export function TabBody({
	tab,
	d,
	pieces,
	layout,
	onPrompt,
}: { tab: TabKey; d: ProtoDiscover; pieces: Pieces; layout: Layout; onPrompt: (text: string) => void }) {
	return (
		<div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
			{tab === "vibe" ? (
				<VibeTab d={d} layout={layout} onPrompt={onPrompt} />
			) : tab === "basics" ? (
				<BasicsTab d={d} pieces={pieces} layout={layout} />
			) : (
				<MoreTab d={d} pieces={pieces} layout={layout} />
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Section heads

function Head({
	dot,
	label,
	note,
	onClear,
	right,
	big = false,
}: {
	dot: string
	label: string
	note?: string
	onClear?: () => void
	right?: ReactNode
	big?: boolean
}) {
	return (
		<div className="mb-2.5 flex min-h-7 items-center gap-2">
			<span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
			<h3 className={`${big ? "text-[16px] font-bold text-white" : "text-[14px] font-semibold text-gray-100"}`}>{label}</h3>
			{note && <span className="text-[12px] text-gray-500">{note}</span>}
			<span className="ml-auto flex items-center gap-1">
				{onClear && (
					<button
						type="button"
						onClick={onClear}
						className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
				{right}
			</span>
		</div>
	)
}

/** The chips of a card, and Clear for them when any. */
function useCard(d: ProtoDiscover, pieces: Pieces, k: CardKey) {
	const chips = pieces.chips.filter((c) => cardOf(c.group) === k)
	return { chips, clear: chips.length ? () => clearChips(d, chips) : undefined }
}

// ---------------------------------------------------------------------------------------------------------------
// Vibe

const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")
const BY_GROUP: Record<TagGroup, Tag[]> = {
	moods: MOOD_TAGS,
	themes: TAGS.filter((t) => t.group === "themes"),
	styles: TAGS.filter((t) => t.group === "styles"),
}

const tagOption = (d: ProtoDiscover, t: Tag): Option => ({
	id: tagId(t),
	label: t.name,
	active: d.isOn(t),
	count: d.countFor(t),
	toggle: () => d.toggle(t),
	swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />,
})

function groupNote(d: ProtoDiscover, group: TagGroup) {
	const n = d.picked.filter((t) => t.group === group).length
	return n ? `Any of these · ${n} of 3` : "Up to 3"
}

const clearGroup = (d: ProtoDiscover, group: TagGroup) => {
	const picks = d.picked.filter((t) => t.group === group)
	return picks.length
		? () => d.filters.update((s) => ({ ...s, [group]: [] }))
		: undefined
}

/** A mood as a large chip: hue dot, name, and what it would leave; white when on, like the sheet's chips. */
function MoodChip({ d, t }: { d: ProtoDiscover; t: Tag }) {
	const on = d.isOn(t)
	const n = d.countFor(t)
	const dead = !on && n === 0
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			title={t.description}
			onClick={() => d.toggle(t)}
			className={`flex h-10 items-center gap-2 rounded-full px-4 text-[15px] whitespace-nowrap outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on
					? "bg-white font-semibold text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			<span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} />
			{t.name}
			{!on && n !== null && <span className="text-[12px] tabular-nums text-gray-500">{compactCount(n)}</span>}
		</motion.button>
	)
}

/** About or Style, folded to one fixed-height line: the picks and the best few, "+N" for the rest. */
function FoldedGroup({ d, group, few }: { d: ProtoDiscover; group: "themes" | "styles"; few: number }) {
	const [open, setOpen] = useState(false)
	const options = byCount(BY_GROUP[group].map((t) => tagOption(d, t)))
	const keep = Math.max(few, options.filter((o) => o.active).length)
	const rest = options.length - keep
	return (
		<section aria-label={GROUP_LABEL[group]}>
			<Head
				dot="bg-gray-500"
				label={GROUP_LABEL[group]}
				note={groupNote(d, group)}
				onClear={clearGroup(d, group)}
				right={
					<button
						type="button"
						onClick={() => setOpen(!open)}
						aria-expanded={open}
						className="flex h-6 items-center gap-0.5 rounded-md px-1.5 text-[12px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{open ? "Fewer" : `All ${options.length}`}
						<ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
					</button>
				}
			/>
			{open ? (
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-1.5">
					{options.map((o) => (
						<Chip key={o.id} o={o} />
					))}
				</motion.div>
			) : (
				<div className="flex h-8 gap-1.5 overflow-hidden">
					{options.slice(0, keep).map((o) => (
						<Chip key={o.id} o={o} />
					))}
					{rest > 0 && (
						<button
							type="button"
							onClick={() => setOpen(true)}
							className="flex h-8 shrink-0 items-center rounded-full px-2.5 text-[13px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							+{rest}
						</button>
					)}
				</div>
			)}
		</section>
	)
}

/** The mood search as the Vibe tab's first line: examples to run, or the query that's on with its Read as. */
function SearchRow({ d, onPrompt }: { d: ProtoDiscover; onPrompt: (text: string) => void }) {
	return (
		<section aria-label="Mood search">
			<div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-amber-300/90 uppercase">
				<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
				Mood search
			</div>
			{d.q ? (
				<div className="flex min-h-10 flex-wrap items-center gap-2">
					<QueryChip d={d} />
					{d.reading.length > 0 && <ReadAsChips reading={d.reading} />}
				</div>
			) : (
				<div className="-mx-4 flex h-10 items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-6 lg:px-6 [&::-webkit-scrollbar]:hidden">
					{EXAMPLE_PROMPTS.slice(0, 5).map((prompt) => (
						<button
							key={prompt}
							type="button"
							onClick={() => onPrompt(prompt)}
							className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-amber-400/[0.08] px-3.5 text-[13px] whitespace-nowrap text-amber-50/85 ring-1 ring-inset ring-amber-400/20 cursor-pointer outline-none hover:bg-amber-400/[0.16] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{prompt}
						</button>
					))}
				</div>
			)}
		</section>
	)
}

function VibeTab({ d, layout, onPrompt }: { d: ProtoDiscover; layout: Layout; onPrompt: (text: string) => void }) {
	const widening = d.picked.some((t) => t.group === "moods")
	const moods = (
		<section aria-label="Mood">
			<Head
				big
				dot={FILTER_ACCENTS.moods.dot}
				label="Mood"
				note={widening ? groupNote(d, "moods") : "Up to 3"}
				onClear={clearGroup(d, "moods")}
			/>
			<div className="flex flex-wrap gap-2">
				{MOOD_TAGS.map((t) => (
					<MoodChip key={tagId(t)} d={d} t={t} />
				))}
			</div>
		</section>
	)
	const fine = (
		<div className="flex flex-col gap-5">
			<FoldedGroup d={d} group="themes" few={layout === "panel" ? 4 : 5} />
			<FoldedGroup d={d} group="styles" few={layout === "panel" ? 4 : 5} />
		</div>
	)
	if (layout === "panel")
		return (
			<div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-10">
				<div className="flex flex-col gap-6">
					<SearchRow d={d} onPrompt={onPrompt} />
					{moods}
				</div>
				<div className="border-l border-white/[0.06] pl-8">{fine}</div>
			</div>
		)
	return (
		<div className="flex flex-col gap-6">
			<SearchRow d={d} onPrompt={onPrompt} />
			{moods}
			<div className="border-t border-white/[0.06] pt-5">{fine}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// One real card on its own: the real card stack, with every other card, the popular tiles and "Add a filter" hidden,
// and the card's own head (we draw ours). The stack shows the card it was asked to open at, so only one may mount at a
// time.

function OneCard({ k, data }: { k: CardKey; data: Pieces["groups"] }) {
	useState(() => {
		focusSheetOn(k)
		return 0
	})
	const s = `[data-one="${k}"]`
	const css = `${s} div:has(> section[id^="filter-card-"]:not(#filter-card-${k})), ${s} section[aria-label="Popular filters"], ${s} .ring-dashed, ${s} [aria-busy="true"], ${s} #filter-card-${k} > div:first-child { display: none } ${s} #filter-card-${k} { background: none; box-shadow: none !important; padding: 0; border-radius: 0 }`
	return (
		<div data-one={k}>
			<style dangerouslySetInnerHTML={{ __html: css }} />
			<FilterGroups data={data} query="" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Basics: the common filters, full size.

const YEAR_MIN = 1920
const SCORE_STEPS = [
	{ v: 0, label: "Any" },
	{ v: 60, label: "60+" },
	{ v: 70, label: "70+" },
	{ v: 80, label: "80+" },
]

function releasedRange(released: FilterState["released"]): [number, number] {
	const now = new Date().getFullYear()
	switch (released) {
		case "recent":
			return [now - 3, now]
		case "2010s":
			return [2010, 2019]
		case "2000s":
			return [2000, 2009]
		case "before2000":
			return [YEAR_MIN, 1999]
		default:
			return [YEAR_MIN, now]
	}
}

const GENRE_FOLDS: { label: string; names: string[] }[] = [
	{ label: "Action", names: ["Action", "Action & Adventure"] },
	{ label: "Adventure", names: ["Adventure", "Action & Adventure"] },
	{ label: "Sci-Fi", names: ["Science Fiction", "Sci-Fi & Fantasy"] },
	{ label: "Fantasy", names: ["Fantasy", "Sci-Fi & Fantasy"] },
	{ label: "War", names: ["War", "War & Politics"] },
]
const FOLDED = new Set(GENRE_FOLDS.flatMap((f) => f.names))

function genreOptions(d: ProtoDiscover): Option[] {
	const { state } = d.filters
	const counts = d.counts
	const all = Object.keys(counts?.optionCounts.genres ?? {})
	for (const g of state.genres) if (!all.includes(g)) all.push(g)
	const c = (n: string) => counts?.optionCounts.genres?.[n] ?? null
	const units = [
		...GENRE_FOLDS.filter((f) => f.names.some((n) => all.includes(n))),
		...all.filter((n) => !FOLDED.has(n)).map((n) => ({ label: n, names: [n] })),
	]
	const isOn = (u: { names: string[] }) => state.genres.includes(u.names[0])
	return units.map((u) => {
		const parts = u.names.map(c).filter((x): x is number => x !== null)
		return {
			id: u.label,
			label: u.label,
			active: isOn(u),
			count: parts.length ? parts.reduce((a, b) => a + b, 0) : null,
			toggle: () => {
				const on = units.filter((x) => (x === u ? !isOn(u) : isOn(x)))
				d.filters.set({ genres: [...new Set(on.flatMap((x) => x.names))] })
			},
		}
	})
}

function TypeSection({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const { state } = d.filters
	const c = (g: "type" | "anime", o: string) => d.counts?.optionCounts[g]?.[o] ?? null
	const card = useCard(d, pieces, "type")
	return (
		<section aria-label="Movies or shows">
			<Head big dot={FILTER_ACCENTS.type.dot} label="Movies or shows" onClear={card.clear} />
			<div className="flex flex-col gap-2">
				<div className="flex">
					<Segmented
						label="Movies or shows"
						value={state.type}
						onChange={(type) => d.filters.set({ type })}
						options={(["all", "movie", "show"] as const).map((id) => ({
							id,
							label: id === "all" ? "Both" : TYPE_LABELS[id],
							count: c("type", id),
						}))}
					/>
				</div>
				<div className="flex">
					<Segmented
						label="Anime"
						small
						value={state.anime}
						onChange={(anime) => d.filters.set({ anime })}
						options={(["any", "only", "none"] as const).map((id) => ({
							id,
							label: id === "any" ? "With anime" : ANIME_LABELS[id],
							count: c("anime", id),
						}))}
					/>
				</div>
			</div>
		</section>
	)
}

function GenreSection({ d, pieces, limit }: { d: ProtoDiscover; pieces: Pieces; limit: number }) {
	const card = useCard(d, pieces, "genres")
	return (
		<section aria-label="Genre">
			<Head big dot={FILTER_ACCENTS.genres.dot} label="Genre" note="Any of these" onClear={card.clear} />
			<ChipList options={genreOptions(d)} limit={limit} sort />
		</section>
	)
}

function ScoreSection({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const card = useCard(d, pieces, "minScore")
	return (
		<section aria-label="Score">
			<Head big dot={FILTER_ACCENTS.minScore.dot} label="Score" onClear={card.clear} />
			<ThresholdBar
				label="Score"
				steps={SCORE_STEPS}
				value={d.filters.state.minScore}
				onChange={(minScore) => d.filters.set({ minScore })}
				color={(v) => `bg-vibe-${goodwatchVibeIndex(v)}`}
				counts={(v) => d.counts?.optionCounts.minScore?.[String(v)] ?? null}
			/>
		</section>
	)
}

function ReleasedSection({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const { state } = d.filters
	const card = useCard(d, pieces, "released")
	const now = new Date().getFullYear()
	const range: [number, number] = state.years
		? [state.years.min ?? YEAR_MIN, state.years.max ?? now]
		: releasedRange(state.released)
	return (
		<section aria-label="Released">
			<Head big dot={FILTER_ACCENTS.released.dot} label="Released" onClear={card.clear} />
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap gap-1.5">
					{(["recent", "2010s", "2000s", "before2000"] as const).map((r) => (
						<Chip
							key={r}
							o={{
								id: r,
								label: RELEASED_LABELS[r],
								active: !state.years && state.released === r,
								count: state.years ? null : (d.counts?.optionCounts.released?.[r] ?? null),
								toggle: () =>
									d.filters.set({ released: state.released === r && !state.years ? "any" : r, years: undefined }),
							}}
						/>
					))}
				</div>
				<RangeSlider
					label="Released"
					min={YEAR_MIN}
					max={now}
					step={1}
					value={range}
					format={(y) => (y <= YEAR_MIN ? "Any year" : y >= now ? "Now" : String(y))}
					onCommit={([lo, hi]) => {
						const preset = (["recent", "2010s", "2000s", "before2000", "any"] as const).find((r) => {
							const [a, b] = releasedRange(r)
							return a === lo && b === hi
						})
						if (preset) d.filters.set({ released: preset, years: undefined })
						else
							d.filters.set({
								released: "any",
								years: { ...(lo > YEAR_MIN ? { min: lo } : {}), ...(hi < now ? { max: hi } : {}) },
							})
					}}
				/>
			</div>
		</section>
	)
}

function StreamingSection({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const card = useCard(d, pieces, "services")
	return (
		<section aria-label="Streaming">
			<Head big dot={FILTER_ACCENTS.services.dot} label="Streaming" onClear={card.clear} />
			<OneCard k="services" data={pieces.groups} />
			<div className="mt-4 flex">
				<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
			</div>
		</section>
	)
}

function BasicsTab({ d, pieces, layout }: { d: ProtoDiscover; pieces: Pieces; layout: Layout }) {
	if (layout === "panel")
		return (
			<div className="grid grid-cols-3 gap-10">
				<StreamingSection d={d} pieces={pieces} />
				<div className="flex flex-col gap-7">
					<TypeSection d={d} pieces={pieces} />
					<ScoreSection d={d} pieces={pieces} />
					<ReleasedSection d={d} pieces={pieces} />
				</div>
				<GenreSection d={d} pieces={pieces} limit={14} />
			</div>
		)
	if (layout === "palette")
		return (
			<div className="grid grid-cols-2 gap-x-8 gap-y-7">
				<div className="flex flex-col gap-7">
					<StreamingSection d={d} pieces={pieces} />
				</div>
				<div className="flex flex-col gap-7">
					<TypeSection d={d} pieces={pieces} />
					<ScoreSection d={d} pieces={pieces} />
				</div>
				<GenreSection d={d} pieces={pieces} limit={10} />
				<ReleasedSection d={d} pieces={pieces} />
			</div>
		)
	return (
		<div className="flex flex-col gap-7">
			<StreamingSection d={d} pieces={pieces} />
			<TypeSection d={d} pieces={pieces} />
			<GenreSection d={d} pieces={pieces} limit={8} />
			<ScoreSection d={d} pieces={pieces} />
			<ReleasedSection d={d} pieces={pieces} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// More filters: the niche ones, compact rows in groups; a row opens its real card under it.

const NICHE: { title: string; keys: { k: CardKey; label: string; hint: string }[] }[] = [
	{
		title: "Scores",
		keys: [
			{ k: "minMatch", label: "Taste match", hint: "How well it fits your taste" },
			{ k: "sourceScores", label: "Scores by source", hint: "IMDb, Rotten Tomatoes, Metacritic" },
			{ k: "scoreGap", label: "Critics vs audiences", hint: "Where they disagree" },
		],
	},
	{
		title: "Titles and people",
		keys: [
			{ k: "similarTo", label: "Similar to", hint: "Like titles you pick" },
			{ k: "people", label: "Cast and crew", hint: "Actors and directors" },
			{ k: "loved", label: "Loved", hint: "Steer toward" },
			{ k: "disliked", label: "Disliked", hint: "Steer away" },
		],
	},
	{
		title: "Details",
		keys: [
			{ k: "runtime", label: "Length", hint: "Short movies, short episodes" },
			{ k: "productionCountries", label: "Production country", hint: "Where it was made" },
			{ k: "ageLimit", label: "Age and content", hint: "Age rating and content" },
		],
	},
]

function NicheRow({
	d,
	pieces,
	k,
	label,
	hint,
	open,
	onToggle,
}: {
	d: ProtoDiscover
	pieces: Pieces
	k: CardKey
	label: string
	hint: string
	open: boolean
	onToggle: () => void
}) {
	const card = useCard(d, pieces, k)
	const value = card.chips.map((c) => c.label.replace(/^Produced in /, "")).join(", ")
	return (
		<div className={`rounded-xl transition-colors ${open ? "bg-white/[0.035] ring-1 ring-white/[0.06]" : ""}`}>
			<div className="flex h-11 items-center">
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={open}
					className="group flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 text-left cursor-pointer outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
					<span className="shrink-0 text-[14px] font-medium text-gray-100">{label}</span>
					{value ? (
						<span className="min-w-0 truncate text-[13px] font-semibold text-amber-200">{value}</span>
					) : (
						<span className="min-w-0 truncate text-[12px] text-gray-500">{hint}</span>
					)}
					<ChevronDownIcon
						className={`ml-auto h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:text-gray-300 ${open ? "rotate-180" : ""}`}
					/>
				</button>
				{card.clear && (
					<button
						type="button"
						onClick={card.clear}
						aria-label={`Clear ${label}`}
						className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-500 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</div>
			{open && (
				<motion.div
					initial={{ opacity: 0, y: -4 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.16 }}
					className="px-3 pt-1 pb-3"
				>
					<OneCard k={k} data={pieces.groups} />
				</motion.div>
			)}
		</div>
	)
}

function MoreTab({ d, pieces, layout }: { d: ProtoDiscover; pieces: Pieces; layout: Layout }) {
	const [open, setOpen] = useState<CardKey | null>(null)
	const groups = NICHE.map((g) => ({
		...g,
		keys: g.keys.filter((x) => x.k !== "ageLimit" || pieces.groups.ladder),
	}))
	const group = (g: (typeof groups)[number]) => (
		<section key={g.title} aria-label={g.title}>
			<h3 className="mb-1 px-3 text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">{g.title}</h3>
			<div className="flex flex-col">
				{g.keys.map((x) => (
					<NicheRow
						key={x.k}
						d={d}
						pieces={pieces}
						{...x}
						open={open === x.k}
						onToggle={() => setOpen(open === x.k ? null : x.k)}
					/>
				))}
			</div>
		</section>
	)
	if (layout === "panel") return <div className="-mx-3 grid grid-cols-3 gap-6">{groups.map(group)}</div>
	if (layout === "palette")
		return (
			<div className="-mx-3 grid grid-cols-2 gap-x-6 gap-y-5">
				<div className="flex flex-col gap-5">
					{group(groups[0])}
					{group(groups[2])}
				</div>
				{group(groups[1])}
			</div>
		)
	return <div className="-mx-3 flex flex-col gap-5">{groups.map(group)}</div>
}

// ---------------------------------------------------------------------------------------------------------------
// The bar's quick controls after the mood search: Mood, Streaming, Not seen yet, Sort, Filters (desktop), and the same
// essentials small for the phone's status line.

export function useSort(d: ProtoDiscover) {
	const searching = d.filters.searching
	return {
		options: discoverSorts(searching, "signUp"),
		value: sortShown(d.filters.sort, searching, "signUp"),
		onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
		footnote: searching ? undefined : "Relevance joins once you search.",
	}
}

/** Overlapping hue dots for the picked tags, or the mood hues dimmed when nothing is picked. */
export function HueDots({ tags, size = 12 }: { tags: Tag[]; size?: number }) {
	const shown = tags.length ? tags.slice(0, 4) : MOOD_TAGS.slice(0, 4)
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			{shown.map((t, i) => (
				<span
					key={tagId(t)}
					className={`rounded-full ring-2 ring-gray-950 ${tags.length ? "" : "opacity-60"}`}
					style={{ width: size, height: size, background: t.color, marginLeft: i ? -size / 3 : 0 }}
				/>
			))}
		</span>
	)
}

export function pickedLabel(picked: Tag[]) {
	const sorted = [...picked.filter((t) => t.group === "moods"), ...picked.filter((t) => t.group !== "moods")]
	if (!sorted.length) return null
	const head = sorted.slice(0, 2).map((t) => t.name).join(" + ")
	return sorted.length > 2 ? `${head} +${sorted.length - 2}` : head
}

export function MoodButton({
	d,
	open,
	onClick,
	small = false,
}: { d: ProtoDiscover; open: boolean; onClick: () => void; small?: boolean }) {
	const label = pickedLabel(d.picked)
	return (
		<motion.button
			type="button"
			data-bar-trigger
			whileTap={TAP}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-expanded={open}
			className={`flex max-w-[16rem] shrink-0 items-center gap-2.5 text-sm font-bold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${small ? "h-9 px-3" : "h-12 px-4"} ${
				open ? "bg-white/[0.09] text-white ring-white/25" : label ? "text-white hover:ring-white/25" : "text-gray-200 hover:ring-white/25"
			}`}
		>
			<HueDots tags={d.picked} size={small ? 11 : 14} />
			<span className="truncate">{label ?? "Mood"}</span>
		</motion.button>
	)
}

/** Mood, Streaming, Not seen yet, Sort and Filters at the bar's 48 px height (desktop). */
export function QuickControls({
	d,
	pieces,
	open,
	onMood,
	onFilters,
}: { d: ProtoDiscover; pieces: Pieces; open: TabKey | null; onMood: () => void; onFilters: () => void }) {
	const navigate = useNavigate()
	const sort = useSort(d)
	return (
		<>
			<MoodButton d={d} open={open === "vibe"} onClick={onMood} />
			<div className="shrink-0 [&>div]:h-12 [&>div]:p-1">
				<ServicesControl
					{...pieces.servicesProps}
					size="sm"
					labels={{ ...pieces.servicesProps.labels, mine: "My services" }}
					onAddServices={() => navigate(SERVICES_PATH)}
				/>
			</div>
			<div className="flex shrink-0 xl:[&>button]:w-auto">
				<NotSeenSwitch {...pieces.notSeenProps} compact />
			</div>
			<SortControl {...sort} align="right" />
			<span data-bar-trigger className="contents">
				<FiltersButton count={pieces.secondaryCount} expanded={open === "basics" || open === "more"} onClick={onFilters} compact />
			</span>
		</>
	)
}

/** The essentials small, leading the phone's status line: Mood, Streaming, Not seen yet, Sort. */
export function PhoneEssentials({ d, pieces, onMood }: { d: ProtoDiscover; pieces: Pieces; onMood: () => void }) {
	const navigate = useNavigate()
	const sort = useSort(d)
	return (
		<>
			<MoodButton d={d} open={false} onClick={onMood} small />
			<ServicesControl
				{...pieces.servicesProps}
				size="sm"
				labels={{ ...pieces.servicesProps.labels, mine: "Mine" }}
				onAddServices={() => navigate(SERVICES_PATH)}
			/>
			<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
			<SortControl {...sort} size="sm" portal />
			<span aria-hidden className="h-5 w-px shrink-0 bg-white/10" />
		</>
	)
}

/** The Filters key on phones: an icon square with the count, beside the mood search. */
export function PhoneFiltersKey({ count, onClick }: { count: number; onClick: () => void }) {
	return (
		<motion.button
			type="button"
			whileTap={{ scale: 0.9 }}
			onClick={onClick}
			aria-haspopup="dialog"
			aria-label={count ? `Filters, ${count} active` : "Filters"}
			className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.08] text-white ring-1 ring-white/10 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<AdjustmentsHorizontalIcon className="h-5 w-5" />
			{count > 0 && (
				<span
					aria-hidden
					className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 ring-2 ring-gray-950"
				>
					{count}
				</span>
			)}
		</motion.button>
	)
}

/** Desktop (1024 px and up) or not; false on the server and the first paint. */
export function useWide() {
	const [wide, setWide] = useState(false)
	useEffect(() => {
		const m = window.matchMedia("(min-width: 1024px)")
		const f = () => setWide(m.matches)
		f()
		m.addEventListener("change", f)
		return () => m.removeEventListener("change", f)
	}, [])
	return wide
}

// PROTOTYPE - throwaway. Variant E, "Rail": one sticky left rail is the single home for everything that narrows the
// list. Top: the essentials (the real On my services and Not seen yet). Then a Vibe card (every mood as a hue-dot
// chip with its count, About and Style trimmed to the most common with "+N more"). Then the real filter card stack
// with its popular tiles and Add a filter. The rail collapses to a slim strip so the grid gets its width back. Main:
// the search heading, Read as, today's count line with the sort at its right, the grid. Phones: no rail; the heading, a
// quick row, and one bottom sheet holding exactly the rail.
import {
	AdjustmentsHorizontalIcon,
	ChevronDoubleLeftIcon,
	ChevronDoubleRightIcon,
	ChevronDownIcon,
	EyeIcon,
	EyeSlashIcon,
	GlobeAltIcon,
	TvIcon,
} from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { SnapSheet } from "~/ui/filter-bar"
import { FilterInsight } from "~/ui/filter-bar/ActiveFilters"
import { NotSeenSwitch, ServicesControl, SortControl } from "~/ui/filter-bar/controls"
import { type CardKey, focusSheetOn } from "~/ui/filter-bar/filter-cards"
import { FilterGroups, FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import { compactCount, discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { PopularInline } from "~/ui/filter-bar/PopularFilters"
import { More } from "~/ui/filter-bar/SheetControls"
import { ProtoGrid, type ProtoDiscover, TAGS, type Tag, type TagGroup, tagId, useFilterPieces } from "../kit"

export const NAME = "Rail"

type Pieces = ReturnType<typeof useFilterPieces>

const MOODS = TAGS.filter((t) => t.group === "moods")
const ABOUT = TAGS.filter((t) => t.group === "themes")
const STYLE = TAGS.filter((t) => t.group === "styles")
const MAX_PER_GROUP = 3
const TASTE = "signUp" as const
const COLLAPSED_KEY = "proto-dm-e-collapsed"

// The Vibe card holds moods, themes and styles, so the stack below leaves out their own cards.
const STACK_CSS = `.e-stack div:has(> #filter-card-moods), .e-stack div:has(> #filter-card-themes), .e-stack div:has(> #filter-card-styles) { display: none }`

// ---------------------------------------------------------------------------------------------------------------
// Honest counts. A group with no picks yet: what the tag would leave (the intersection). A group with picks: the tag
// widens it ("any of"), so the chip says how many it adds.

function tagCount(d: ProtoDiscover, t: Tag): { text: string; title?: string; dead: boolean } {
	const n = d.countFor(t)
	if (d.isOn(t) || n == null) return { text: "", dead: false }
	const inGroup = d.picked.filter((p) => p.group === t.group).length
	if (inGroup >= MAX_PER_GROUP) return { text: "", title: "Three is the most. This one replaces the first.", dead: false }
	if (inGroup > 0) {
		const adds = d.total == null ? null : Math.max(0, n - d.total)
		return {
			text: adds ? `+${compactCount(adds)}` : "",
			title: adds ? `Or ${t.name}: adds ${adds.toLocaleString("en")} titles` : undefined,
			dead: adds === 0,
		}
	}
	return { text: compactCount(n), dead: n === 0 }
}

/** The sheet's chip (32 px, quiet count, white when on) with the tag's hue dot and an honest count. */
function TagChip({ t, d, size = "md" }: { t: Tag; d: ProtoDiscover; size?: "md" | "lg" }) {
	const on = d.isOn(t)
	const { text, title, dead } = tagCount(d, t)
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			title={title}
			onClick={() => d.toggle(t)}
			className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${size === "lg" ? "h-9" : "h-8"} ${
				on
					? "bg-white font-semibold text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
			{t.name}
			{text && <span className="text-[11px] tabular-nums text-gray-500">{text}</span>}
		</motion.button>
	)
}

/** The tags of a group ordered by how many titles they had when the page first counted, so picks don't reshuffle. */
function useBaselineOrder(d: ProtoDiscover) {
	const base = useRef<Map<string, number> | null>(null)
	if (!base.current && d.counts) base.current = new Map(TAGS.map((t) => [tagId(t), d.countFor(t) ?? 0]))
	return (tags: Tag[]) => {
		const map = base.current
		return map ? [...tags].sort((a, b) => (map.get(tagId(b)) ?? 0) - (map.get(tagId(a)) ?? 0)) : tags
	}
}

function TagGroupRow({
	label,
	tags,
	d,
	limit,
}: {
	label: string
	tags: Tag[]
	d: ProtoDiscover
	limit?: number
}) {
	const [open, setOpen] = useState(false)
	const group: TagGroup = tags[0].group
	const picks = d.picked.filter((t) => t.group === group).length
	const top = limit && !open ? tags.slice(0, limit) : tags
	// Picks beyond the most common still show, at the end.
	const shown = [...top, ...tags.filter((t) => !top.includes(t) && d.isOn(t))]
	const hidden = tags.length - shown.length
	return (
		<div>
			<div className="mb-1.5 flex h-5 items-center gap-2 text-[12px]">
				<span className="font-semibold text-gray-400">{label}</span>
				{picks > 0 && <span className="text-gray-500">any of these</span>}
			</div>
			<div className="flex flex-wrap gap-1.5">
				{shown.map((t) => (
					<TagChip key={tagId(t)} t={t} d={d} />
				))}
				{(hidden > 0 || open) && <More hidden={hidden} open={open} onClick={() => setOpen(!open)} />}
			</div>
		</div>
	)
}

function VibeCard({ d }: { d: ProtoDiscover }) {
	const order = useBaselineOrder(d)
	return (
		<section id="e-vibe" aria-label="Vibe" className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
			<div className="-mt-1 mb-2 flex min-h-8 items-center gap-2">
				<span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
				<span className="text-[14px] font-semibold text-gray-100">Vibe</span>
				{d.picked.length > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label="set" />}
				{d.picked.length > 0 && (
					<button
						type="button"
						onClick={d.clearTags}
						className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</div>
			<div className="flex flex-col gap-4">
				<TagGroupRow label="Mood" tags={MOODS} d={d} />
				<TagGroupRow label="About" tags={order(ABOUT)} d={d} limit={6} />
				<TagGroupRow label="Style" tags={order(STYLE)} d={d} limit={5} />
			</div>
		</section>
	)
}

/** On my services and Not seen yet, stacked to the rail's width. */
function Essentials({ pieces }: { pieces: Pieces }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="*:w-full [&_[role=radio]]:flex-1 [&>div>span]:flex-1 [&>div>span>button]:w-full">
				<ServicesControl {...pieces.servicesProps} size="sm" labels={{ ...pieces.servicesProps.labels, mine: "My services" }} />
			</div>
			<NotSeenSwitch {...pieces.notSeenProps} size="sm" className="w-full" />
		</div>
	)
}

/** Everything the rail holds; the desktop rail and the phone sheet show exactly this. */
function RailBody({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const [query, setQuery] = useState("")
	return (
		<div className="flex flex-col gap-4">
			<Essentials pieces={pieces} />
			<VibeCard d={d} />
			<section aria-label="More filters" className="flex flex-col gap-3">
				<h3 className="mt-1 text-[13px] font-semibold text-gray-400">More filters</h3>
				<FilterSearchField value={query} onChange={setQuery} />
				<div className="e-stack">
					<FilterGroups data={pieces.groups} query={query} />
				</div>
			</section>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop rail and its collapsed strip.

function useCollapsed() {
	const [collapsed, setCollapsed] = useState(false)
	useEffect(() => {
		try {
			setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1")
		} catch {}
	}, [])
	const set = (next: boolean) => {
		setCollapsed(next)
		try {
			window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0")
		} catch {}
	}
	return [collapsed, set] as const
}

function CountBadge({ n }: { n: number }) {
	return (
		<span
			className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums ${n ? "bg-amber-500 text-gray-950" : "bg-white/10 text-gray-400"}`}
		>
			{n}
		</span>
	)
}

function Rail({ d, pieces, onCollapse }: { d: ProtoDiscover; pieces: Pieces; onCollapse: () => void }) {
	const active = pieces.chips.length
	return (
		<div className="flex h-full flex-col">
			<div className="flex h-12 shrink-0 items-center gap-2 pr-2">
				<h2 className="brand-header text-xl text-white">Filters</h2>
				<CountBadge n={active} />
				{active > 0 && (
					<button
						type="button"
						onClick={d.filters.clearSecondary}
						className="ml-auto rounded-md px-1.5 py-0.5 text-[13px] text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear all
					</button>
				)}
				<button
					type="button"
					onClick={onCollapse}
					aria-label="Collapse filters"
					title="Collapse"
					className={`${active > 0 ? "" : "ml-auto"} grid h-8 w-8 place-items-center rounded-lg text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400`}
				>
					<ChevronDoubleLeftIcon className="h-4 w-4" />
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1 pr-2 pb-28 [scrollbar-width:thin]">
				<RailBody d={d} pieces={pieces} />
			</div>
		</div>
	)
}

function StripButton({
	label,
	onClick,
	lit,
	children,
}: {
	label: string
	onClick: () => void
	lit?: string
	children: React.ReactNode
}) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-label={label}
			title={label}
			className={`relative grid h-10 w-10 place-items-center rounded-xl ring-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${lit ?? "bg-white/[0.04] text-gray-400 ring-white/10 hover:text-white"}`}
		>
			{children}
		</motion.button>
	)
}

function Strip({ d, pieces, onExpand }: { d: ProtoDiscover; pieces: Pieces; onExpand: () => void }) {
	const active = pieces.chips.length
	const { servicesProps, notSeenProps } = pieces
	return (
		<div className="flex flex-col items-center gap-2 pt-1">
			<StripButton label={active ? `Show filters, ${active} active` : "Show filters"} onClick={onExpand}>
				<ChevronDoubleRightIcon className="h-4 w-4 text-gray-200" />
				{active > 0 && (
					<span className="absolute -top-1.5 -right-1.5">
						<CountBadge n={active} />
					</span>
				)}
			</StripButton>
			<span className="my-1 h-px w-6 bg-white/10" />
			<StripButton
				label={servicesProps.on ? "On my services" : servicesProps.hasServices ? "Everywhere" : "Add my services"}
				onClick={() => (servicesProps.hasServices ? servicesProps.onChange(!servicesProps.on) : onExpand())}
				lit={servicesProps.on ? "bg-emerald-700/70 text-white ring-emerald-500/40" : undefined}
			>
				{servicesProps.on ? <TvIcon className="h-4 w-4" /> : <GlobeAltIcon className="h-4 w-4" />}
			</StripButton>
			<StripButton
				label={notSeenProps.on ? "Not seen yet: on" : "Not seen yet: off"}
				onClick={() => notSeenProps.onChange(!notSeenProps.on)}
				lit={notSeenProps.on ? "bg-blue-600/25 text-blue-300 ring-blue-500/40" : undefined}
			>
				{notSeenProps.on ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
			</StripButton>
			{d.picked.length > 0 && <span className="my-1 h-px w-6 bg-white/10" />}
			{d.picked.map((t) => (
				<button
					key={tagId(t)}
					type="button"
					onClick={onExpand}
					aria-label={t.name}
					title={t.name}
					className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] cursor-pointer outline-none hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
				</button>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: one quick row, one sheet.

const PHONE_BUTTONS: { key: CardKey; label: string }[] = [
	{ key: "genres", label: "Genre" },
	{ key: "minScore", label: "Score" },
	{ key: "type", label: "Movies & shows" },
]

function QuickRow({ d, pieces, onOpen }: { d: ProtoDiscover; pieces: Pieces; onOpen: (key: CardKey | null) => void }) {
	const active = pieces.chips.length
	const pill =
		"flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
	const { servicesProps, notSeenProps } = pieces
	return (
		<div className="-mx-4 mt-3 flex h-9 gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={() => onOpen(null)}
				aria-label={active ? `Filters, ${active} active` : "Filters"}
				className={`${pill} bg-white/[0.08] pr-2.5 pl-3 font-bold text-white ring-1 ring-white/15`}
			>
				<AdjustmentsHorizontalIcon className="h-4 w-4" />
				Filters
				{active > 0 && <CountBadge n={active} />}
			</motion.button>
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={() => onOpen("services")}
				className={`${pill} pr-2 ${servicesProps.on ? "bg-emerald-700 font-semibold text-white" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10"}`}
			>
				{servicesProps.on ? "My services" : servicesProps.labels.everywhere}
				<ChevronDownIcon className="h-4 w-4 text-gray-400" />
			</motion.button>
			<motion.button
				type="button"
				role="switch"
				aria-checked={notSeenProps.on}
				whileTap={TAP}
				onClick={() => notSeenProps.onChange(!notSeenProps.on)}
				className={`${pill} ${notSeenProps.on ? "bg-blue-600 font-semibold text-white" : "bg-white/[0.06] text-gray-200 ring-1 ring-white/10"}`}
			>
				{notSeenProps.on ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
				Not seen yet
			</motion.button>
			<span aria-hidden className="my-2 w-px shrink-0 bg-white/10" />
			{MOODS.map((t) => (
				<TagChip key={tagId(t)} t={t} d={d} size="lg" />
			))}
			<span aria-hidden className="my-2 w-px shrink-0 bg-white/10" />
			{PHONE_BUTTONS.map((b) => (
				<motion.button
					key={b.key}
					type="button"
					whileTap={TAP}
					onClick={() => onOpen(b.key)}
					className={`${pill} pr-2 bg-white/[0.06] text-gray-200 ring-1 ring-white/10`}
				>
					{b.label}
					<ChevronDownIcon className="h-4 w-4 text-gray-500" />
				</motion.button>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantE({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d, TASTE)
	const [collapsed, setCollapsed] = useCollapsed()
	const [sheet, setSheet] = useState(-1)
	const searching = d.filters.searching
	const sorts = discoverSorts(searching, TASTE)
	const sort = sortShown(d.filters.sort, searching, TASTE)
	const sortControl = (size: "md" | "sm") => (
		<SortControl
			options={sorts}
			value={sort}
			onChange={(key) => d.filters.setSort(key)}
			footnote={searching ? undefined : "Relevance joins once you search."}
			size={size}
			align="right"
		/>
	)
	const displayChips = pieces.chips.filter((c) => c.key !== "services")

	return (
		<MotionConfig reducedMotion="user">
			<style dangerouslySetInnerHTML={{ __html: STACK_CSS }} />
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-24 lg:px-8 lg:pt-6">
				<div className="lg:flex lg:items-start lg:gap-8">
					{/* Desktop: the rail. Its width is fixed per state, so only the collapse itself moves the grid. */}
					<aside
						aria-label="Filters"
						className={`sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 lg:block ${collapsed ? "w-12" : "w-[300px]"}`}
					>
						<AnimatePresence mode="wait" initial={false}>
							{collapsed ? (
								<motion.div
									key="strip"
									className="h-full"
									initial={{ opacity: 0, x: -8 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -8 }}
									transition={{ duration: 0.14 }}
								>
									<Strip d={d} pieces={pieces} onExpand={() => setCollapsed(false)} />
								</motion.div>
							) : (
								<motion.div
									key="rail"
									className="h-full"
									initial={{ opacity: 0, x: -12 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{ opacity: 0, x: -12 }}
									transition={{ duration: 0.16 }}
								>
									<Rail d={d} pieces={pieces} onCollapse={() => setCollapsed(true)} />
								</motion.div>
							)}
						</AnimatePresence>
					</aside>

					<main className="min-w-0 flex-1">
						<DiscoverHeading
							q={d.q}
							onSearch={(text) => d.setQ(text)}
							onClear={() => d.setQ(null)}
							explanation={d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null}
						/>

						{/* Phones: the quick row, then the count and the sort. */}
						<div className="lg:hidden">
							<QuickRow
								d={d}
								pieces={pieces}
								onOpen={(key) => {
									focusSheetOn(key)
									setSheet(0)
								}}
							/>
							<div className="mt-3 flex h-9 items-center justify-between gap-3">
								<span className="text-sm text-gray-400 tabular-nums" aria-live="polite">
									{d.total == null ? "" : (
										<>
											<span className="font-semibold text-white">{d.total.toLocaleString("en")}</span>{" "}
											{searching ? "best fits" : "showing"}
										</>
									)}
								</span>
								{sortControl("sm")}
							</div>
						</div>

						{/* Desktop: today's count line, the sort at its right. */}
						<div className="mt-5 hidden items-start gap-4 lg:flex">
							<FilterInsight
								counts={d.counts}
								chips={displayChips}
								state={d.filters.state}
								onChange={pieces.onChange}
								onDrop={d.filters.drop}
								onClear={d.filters.clearSecondary}
								searching={searching}
								idle={<PopularInline data={pieces.groups} />}
								className="min-h-9 min-w-0 flex-1"
							/>
							<div className="shrink-0">{sortControl("sm")}</div>
						</div>

						{d.searchError && <p className="mt-2 text-sm text-red-400">The search failed. Try again.</p>}
						<div className="mt-4">
							<ProtoGrid d={d} />
						</div>
					</main>
				</div>

				{/* Phones: one sheet, exactly the rail. */}
				<div className="lg:hidden">
					<SnapSheet
						index={sheet}
						onIndex={setSheet}
						label="Filters"
						header={
							<div className="flex items-center gap-2 px-4 pb-2">
								<span className="brand-header text-xl text-white">Filters</span>
								<CountBadge n={pieces.chips.length} />
								{pieces.chips.length > 0 && (
									<button
										type="button"
										onClick={d.filters.clearSecondary}
										className="ml-2 text-[13px] text-gray-400 cursor-pointer hover:text-white"
									>
										Clear all
									</button>
								)}
								<motion.button
									type="button"
									whileTap={TAP}
									onClick={() => setSheet(-1)}
									className="ml-auto flex h-9 items-center gap-1 rounded-xl bg-linear-to-b from-amber-500 to-amber-700 px-3.5 text-sm font-bold text-white"
								>
									{d.total == null ? (
										"Done"
									) : (
										<>
											Show <RollingNumber value={d.total} />
										</>
									)}
								</motion.button>
							</div>
						}
					>
						<div className="px-4 pt-1 pb-10">
							<RailBody d={d} pieces={pieces} />
						</div>
					</SnapSheet>
				</div>
			</div>
		</MotionConfig>
	)
}

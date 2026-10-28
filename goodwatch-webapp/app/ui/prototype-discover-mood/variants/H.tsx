// PROTOTYPE - throwaway. Variant H, "Docked panel": today's page and bar as they are, but Filters opens the sheet's
// content as a docked, non-modal panel on the right. No dimming, no focus trap: the grid reflows narrower beside it,
// it stays open while you browse and scroll, results and counts update live. Its top is pinned: Find a filter and the
// Mood card, then the rest of the cards scroll. Moods also sit in one fixed-height row right under the heading for
// one-tap picking. Phones: today's slab and its sheet, with the same mood row.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterBar, SLAB_CLEARANCE } from "~/ui/filter-bar"
import { FilterInsight, OneLineChips } from "~/ui/filter-bar/ActiveFilters"
import { FiltersButton, NotSeenSwitch, ServicesControl } from "~/ui/filter-bar/controls"
import { cardOf } from "~/ui/filter-bar/filter-cards"
import { FilterGroups, FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import { ForYouSort } from "~/ui/filter-bar/ForYou"
import type { ActiveChip } from "~/ui/filter-bar/labels"
import { FILTER_ACCENTS, compactCount, discoverSorts, sortShown } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { PopularInline } from "~/ui/filter-bar/PopularFilters"
import { ProtoGrid, type ProtoDiscover, TAGS, type Tag, tagId, useFilterPieces } from "../kit"

export const NAME = "Docked panel"

type Pieces = ReturnType<typeof useFilterPieces>

const MOODS = TAGS.filter((t) => t.group === "moods")
const MAX_MOODS = 3
const TASTE = "signUp" as const
const PANEL_W = "w-[400px] xl:w-[440px]"

// The Mood card is pinned at the panel's top, so the scrolling stack leaves out its own copy.
const STACK_CSS = `.h-stack div:has(> #filter-card-moods) { display: none }`

// ---------------------------------------------------------------------------------------------------------------
// Mood chips with honest counts: with no mood picked, what the mood would leave; with one picked, how many it adds
// (moods combine as "any of").

function moodCount(d: ProtoDiscover, t: Tag): { text: string; title?: string; dead: boolean } {
	const n = d.countFor(t)
	if (d.isOn(t) || n == null) return { text: "", dead: false }
	const picks = d.picked.filter((p) => p.group === "moods").length
	if (picks >= MAX_MOODS) return { text: "", title: "Three moods is the most. This one replaces the first.", dead: false }
	if (picks > 0) {
		const adds = d.total == null ? null : Math.max(0, n - d.total)
		return {
			text: adds ? `+${compactCount(adds)}` : "",
			title: adds ? `Or ${t.name}: adds ${adds.toLocaleString("en")} titles` : undefined,
			dead: adds === 0,
		}
	}
	return { text: compactCount(n), dead: n === 0 }
}

function MoodChip({ t, d, tall = false }: { t: Tag; d: ProtoDiscover; tall?: boolean }) {
	const on = d.isOn(t)
	const { text, title, dead } = moodCount(d, t)
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			title={title}
			onClick={() => d.toggle(t)}
			className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${tall ? "h-9" : "h-8"} ${
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

/** One line of moods under the heading: fixed height, scrolls sideways, never wraps. */
function MoodRow({ d }: { d: ProtoDiscover }) {
	const picks = d.picked.filter((t) => t.group === "moods")
	return (
		<div className="-mx-4 mt-3 flex h-9 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:mt-4 lg:px-0">
			<span className="shrink-0 pr-1 text-sm font-semibold text-gray-400">
				Mood{picks.length > 0 && <span className="font-normal text-gray-500"> · any of</span>}
			</span>
			{MOODS.map((t) => (
				<MoodChip key={tagId(t)} t={t} d={d} tall />
			))}
			{picks.length > 0 && (
				<button
					type="button"
					onClick={() => {
						for (const t of picks) d.toggle(t)
					}}
					className="shrink-0 px-2 text-sm text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					Clear
				</button>
			)}
		</div>
	)
}

/** The sheet's Mood card, pinned: every mood, so the panel's top keeps one height. */
function MoodCard({ d }: { d: ProtoDiscover }) {
	const picks = d.picked.filter((t) => t.group === "moods")
	return (
		<section id="h-mood-card" aria-label="Mood" className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
			<div className="-mt-1 mb-3 flex min-h-8 items-center gap-2">
				<span className={`h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS.moods.dot}`} />
				<span className="text-[14px] font-semibold text-gray-100">Mood</span>
				{picks.length > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-label="set" />}
				<span className="ml-auto text-[12px] text-gray-500">{picks.length > 0 ? "Any of, up to three" : "Up to three"}</span>
				{picks.length > 0 && (
					<button
						type="button"
						onClick={() => {
							for (const t of picks) d.toggle(t)
						}}
						className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</div>
			<div className="flex flex-wrap gap-1.5">
				{MOODS.map((t) => (
					<MoodChip key={tagId(t)} t={t} d={d} />
				))}
			</div>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The docked panel: the sheet's content, non-modal.

const cardFor = (chip: ActiveChip) => cardOf(chip.group) ?? chip.group

function DockedPanel({ d, pieces, onClose }: { d: ProtoDiscover; pieces: Pieces; onClose: () => void }) {
	const [query, setQuery] = useState("")
	const search = useRef<HTMLInputElement>(null)
	const scroller = useRef<HTMLDivElement>(null)
	const [target, setTarget] = useState<{ group: string; n: number } | null>(null)
	useEffect(() => {
		search.current?.focus({ preventScroll: true })
	}, [])
	// A tapped chip scrolls to its card (the Mood card is already in view at the top).
	useEffect(() => {
		if (!target) return
		const el =
			target.group === "moods"
				? document.getElementById("h-mood-card")
				: scroller.current?.querySelector<HTMLElement>(`#filter-card-${target.group}`)
		if (!el) return
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		if (target.group !== "moods") el.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" })
		el.animate([{ boxShadow: "0 0 0 2px rgba(251,191,36,.6)" }, { boxShadow: "0 0 0 2px rgba(251,191,36,0)" }], {
			duration: 1200,
		})
	}, [target])
	const total = d.counts?.total ?? null
	return (
		<div
			className="flex h-full flex-col overflow-hidden rounded-2xl bg-gray-950 ring-1 ring-white/10 shadow-[-20px_0_60px_-30px_rgba(0,0,0,.9)]"
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose()
			}}
		>
			<header className="shrink-0 px-4 pt-4 pb-3">
				<div className="flex items-center gap-3">
					<h2 className="brand-header text-xl text-white">Filters</h2>
					<span className="text-sm text-gray-400 tabular-nums" aria-live="polite">
						{total == null ? "" : (
							<>
								<RollingNumber value={total} className="font-semibold text-white" /> {total === 1 ? "title" : "titles"}
							</>
						)}
					</span>
					{pieces.chips.length > 0 && (
						<button
							type="button"
							onClick={d.filters.clearSecondary}
							className="ml-auto text-[13px] text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							Clear all
						</button>
					)}
					<button
						type="button"
						onClick={onClose}
						aria-label="Close filters"
						className={`${pieces.chips.length > 0 ? "" : "ml-auto"} grid h-8 w-8 place-items-center rounded-full bg-white/5 text-gray-300 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400`}
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				</div>
				<FilterSearchField value={query} onChange={setQuery} inputRef={search} className="mt-3" />
				<OneLineChips
					chips={pieces.chips}
					state={d.filters.state}
					onChange={pieces.onChange}
					onGoTo={(chip) => {
						setQuery("")
						setTarget((t) => ({ group: cardFor(chip), n: (t?.n ?? 0) + 1 }))
					}}
					className="mt-3"
				/>
				<div className="mt-3">
					<MoodCard d={d} />
				</div>
			</header>
			<div ref={scroller} className="h-stack min-h-0 flex-1 scroll-pt-2 overflow-y-auto overscroll-contain border-t border-white/5 px-4 pt-3 pb-8 [scrollbar-width:thin]">
				<FilterGroups data={pieces.groups} query={query} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantH({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d, TASTE)
	const [open, setOpen] = useState(false)
	// The column stays reserved until the panel has slid out, so the grid moves once per open and once per close.
	const [reserved, setReserved] = useState(false)
	const [sortOpen, setSortOpen] = useState(false)
	const searching = d.filters.searching
	const sorts = discoverSorts(searching, TASTE)
	const sort = sortShown(d.filters.sort, searching, TASTE)
	const displayChips = pieces.chips.filter((c) => c.key !== "services")
	const toggle = () => {
		if (!open) setReserved(true)
		setOpen(!open)
	}

	return (
		<MotionConfig reducedMotion="user">
			<style dangerouslySetInnerHTML={{ __html: STACK_CSS }} />
			<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
				<DiscoverHeading
					q={d.q}
					onSearch={(text) => d.setQ(text)}
					onClear={() => d.setQ(null)}
					explanation={d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null}
				/>
				<MoodRow d={d} />

				{/* Phones: today's bar (quick row, slab and its sheet). */}
				<div className="lg:hidden">
					<FilterBar filters={d.filters} counts={d.counts} taste={TASTE} />
				</div>

				{/* Desktop: today's row, with Filters docking the panel instead of opening the sheet. */}
				<div className="mt-4 hidden flex-wrap items-center gap-2.5 lg:flex">
					<ServicesControl {...pieces.servicesProps} />
					<NotSeenSwitch {...pieces.notSeenProps} compact />
					<ForYouSort
						sort={{
							options: sorts,
							value: sort,
							onChange: (key: string) => d.filters.setSort(key as typeof d.filters.sort),
							footnote: searching ? undefined : "Relevance joins once you search.",
							open: sortOpen,
							onOpenChange: setSortOpen,
						}}
					/>
					<div className={`ml-auto rounded-2xl transition-shadow ${open ? "shadow-[0_0_0_2px_rgba(251,191,36,.55)]" : ""}`}>
						<FiltersButton count={pieces.secondaryCount} expanded={open} onClick={toggle} compact />
					</div>
				</div>

				<div className="lg:mt-5 lg:flex lg:gap-6">
					<div className="min-w-0 flex-1">
						<FilterInsight
							counts={d.counts}
							chips={displayChips}
							state={d.filters.state}
							onChange={pieces.onChange}
							onDrop={d.filters.drop}
							onClear={d.filters.clearSecondary}
							searching={searching}
							idle={<PopularInline data={pieces.groups} />}
							className="hidden lg:flex"
						/>
						{d.searchError && <p className="mt-2 text-sm text-red-400">The search failed. Try again.</p>}
						<div className="mt-4">
							<ProtoGrid d={d} />
						</div>
					</div>
					{reserved && (
						<div className={`hidden shrink-0 lg:block ${PANEL_W}`}>
							<div className="sticky top-[4.75rem] h-[calc(100vh-5.75rem)]">
								<AnimatePresence onExitComplete={() => setReserved(false)}>
									{open && (
										<motion.aside
											key="panel"
											aria-label="Filters"
											className="h-full"
											initial={{ opacity: 0, x: 32 }}
											animate={{ opacity: 1, x: 0 }}
											exit={{ opacity: 0, x: 32 }}
											transition={{ type: "spring", stiffness: 420, damping: 40 }}
										>
											<DockedPanel d={d} pieces={pieces} onClose={() => setOpen(false)} />
										</motion.aside>
									)}
								</AnimatePresence>
							</div>
						</div>
					)}
				</div>
			</div>
		</MotionConfig>
	)
}

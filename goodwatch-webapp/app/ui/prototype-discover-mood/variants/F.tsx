// PROTOTYPE - throwaway. Variant F, "Mood row": today's page with the real FilterBar kept as it is, plus one row of the
// eleven moods under the heading. The count line's "Try +" turns into "Combine" once a mood is picked (or a search's
// Read as is on): the tags from other groups with the most titles left, named explorer style ("Funny + Crime · 325").
// Filters (the desktop button and the phone slab's key) opens one sheet whose top is the essentials and the Mood card,
// so the row on the page and the sheet read as the same place.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterBar, FilterGroups, FilterSearchField, SLAB_CLEARANCE, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { FilterInsight, OneLineChips } from "~/ui/filter-bar/ActiveFilters"
import { NotSeenSwitch, ServicesControl } from "~/ui/filter-bar/controls"
import { FILTER_ACCENTS, compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { popularFor } from "~/ui/filter-bar/PopularFilters"
import { ChipList, type Option } from "~/ui/filter-bar/SheetControls"
import { useModalDialog } from "~/ui/filter-bar/useModalDialog"
import { PlusIcon } from "@heroicons/react/20/solid"
import { GROUP_LABEL, ProtoGrid, type ProtoDiscover, TAGS, type Tag, type TagGroup, tagId, useFilterPieces } from "../kit"

export const NAME = "Mood row"

const MOODS = TAGS.filter((t) => t.group === "moods")
const GROUPS: TagGroup[] = ["moods", "themes", "styles"]
type Pieces = ReturnType<typeof useFilterPieces>

const Dot = ({ color, className = "h-2 w-2" }: { color: string; className?: string }) => (
	<span aria-hidden className={`shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />
)

// ---------------------------------------------------------------------------------------------------------------
// The mood row: one line, 40 px chips, sideways on phones. With a mood picked, the others say what they would add.

function MoodRow({ d }: { d: ProtoDiscover }) {
	const anyMood = d.picked.some((t) => t.group === "moods")
	// The row's end fades while more moods sit past it.
	const row = useRef<HTMLDivElement>(null)
	const [more, setMore] = useState(false)
	useEffect(() => {
		const el = row.current
		if (!el) return
		const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
		check()
		el.addEventListener("scroll", check, { passive: true })
		const observer = new ResizeObserver(check)
		observer.observe(el)
		return () => {
			el.removeEventListener("scroll", check)
			observer.disconnect()
		}
	}, [])
	return (
		<div
			ref={row}
			style={more ? { maskImage: "linear-gradient(to right, black calc(100% - 4rem), transparent)" } : undefined}
			role="group"
			aria-label="Mood"
			className="-mx-4 flex h-10 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0"
		>
			{MOODS.map((t) => {
				const on = d.isOn(t)
				const n = d.countFor(t)
				// With a mood on, another mood widens the list ("either"): its count is what it adds.
				const added = anyMood && n !== null && d.total !== null ? Math.max(0, n - d.total) : null
				return (
					<motion.button
						key={t.key}
						type="button"
						aria-pressed={on}
						whileTap={TAP}
						onClick={() => d.toggle(t)}
						title={t.description}
						className={`flex h-10 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-3 text-sm whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
							on
								? "bg-white font-semibold text-gray-950"
								: "bg-white/[0.06] text-gray-200 ring-1 ring-white/[0.06] hover:bg-white/[0.11] hover:text-white"
						}`}
					>
						<Dot color={t.color} className="h-2.5 w-2.5" />
						{t.name}
						{!on && (
							<span className="min-w-[2ch] text-[11px] tabular-nums text-gray-500">
								{anyMood ? (added ? `+${compactCount(added)}` : "") : n !== null ? compactCount(n) : ""}
							</span>
						)}
						{on && <XMarkIcon className="h-3.5 w-3.5 text-gray-500" />}
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Combine: once a mood is picked (or a search was read), the tags of the groups without picks, by titles left.

interface Suggestion {
	tag: Tag
	count: number
}

const names = (tags: Tag[]) =>
	GROUPS.map((g) => tags.filter((t) => t.group === g).map((t) => t.name))
		.filter((list) => list.length)
		.map((list) => list.join(" or "))

function useCombine(d: ProtoDiscover) {
	const readAs = d.q !== null && d.reading.length > 0
	const anchored = d.picked.length > 0 || readAs
	const quoted = d.q ? `“${d.q.length > 22 ? `${d.q.slice(0, 21).trimEnd()}…` : d.q}”` : ""
	const anchor = d.picked.length ? names(d.picked).join(" + ") : quoted
	const fresh = useMemo(() => {
		if (!anchored || !d.counts) return null
		const open = GROUPS.filter((g) => !d.picked.some((t) => t.group === g))
		const total = d.total ?? Number.POSITIVE_INFINITY
		const all: Suggestion[] = TAGS.filter((t) => open.includes(t.group))
			.map((tag) => ({ tag, count: d.countFor(tag) ?? 0 }))
			// Honest: it has to narrow the list and leave enough to browse.
			.filter((s) => s.count >= 5 && s.count < total)
			.sort((a, b) => b.count - a.count)
		const out: Suggestion[] = []
		const perGroup: Partial<Record<TagGroup, number>> = {}
		for (const s of all) {
			if ((perGroup[s.tag.group] ?? 0) >= 4) continue
			perGroup[s.tag.group] = (perGroup[s.tag.group] ?? 0) + 1
			out.push(s)
			if (out.length === 6) break
		}
		return out
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [anchored, d.counts, d.picked.map(tagId).join(",")])
	// While new counts are on their way the last suggestions stay, so the line doesn't blink.
	const last = useRef<Suggestion[]>([])
	if (fresh) last.current = fresh
	if (!anchored) last.current = []
	return { anchored, anchor, suggestions: fresh ?? last.current }
}

const LINK =
	"flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-sm whitespace-nowrap cursor-pointer outline-none ring-1 ring-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 lg:h-8 lg:bg-transparent lg:px-0 lg:ring-0"

/** The line after the count: "Try + On Netflix …" while nothing is picked, then "Combine Funny + Crime · 325 …". */
function CombineLine({ d, pieces, className = "" }: { d: ProtoDiscover; pieces: Pieces; className?: string }) {
	const { anchored, anchor, suggestions } = useCombine(d)
	const extra = d.picked.filter((t) => t.group !== "moods")
	const popular = anchored ? [] : popularFor(pieces.groups).slice(0, 5)
	return (
		<div
			className={`-mx-4 flex h-9 min-w-0 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:h-8 lg:gap-4 lg:px-0 ${className}`}
		>
			{anchored ? (
				<>
					{extra.map((t) => (
						<motion.button
							key={tagId(t)}
							type="button"
							whileTap={TAP}
							onClick={() => d.toggle(t)}
							aria-label={`Remove ${t.name}`}
							className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white pr-2 pl-3 text-sm font-semibold whitespace-nowrap text-gray-950 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:h-8"
						>
							<Dot color={t.color} />
							<span className="text-gray-500">{GROUP_LABEL[t.group]}</span>
							{t.name}
							<XMarkIcon className="h-3.5 w-3.5 text-gray-500" />
						</motion.button>
					))}
					{suggestions.length > 0 && <span className="shrink-0 text-sm text-gray-500">Combine</span>}
					{suggestions.map(({ tag, count }) => (
						<motion.button
							key={tagId(tag)}
							type="button"
							whileTap={TAP}
							onClick={() => d.toggle(tag)}
							className={`${LINK} font-semibold text-gray-200`}
						>
							<Dot color={tag.color} />
							<span className="font-normal text-gray-400">{anchor}</span>
							<span className="text-gray-500">+</span>
							{tag.name}
							<span className="text-[12px] font-normal tabular-nums text-gray-500">· {count.toLocaleString("en")}</span>
						</motion.button>
					))}
				</>
			) : (
				<>
					{popular.length > 0 && <span className="shrink-0 text-sm text-gray-500">Try</span>}
					{popular.map((p) => (
						<motion.button
							key={p.id}
							type="button"
							whileTap={TAP}
							onClick={() => pieces.onChange({ ...pieces.groups.state, ...p.apply(pieces.groups) })}
							className={`${LINK} font-semibold text-gray-300`}
						>
							<PlusIcon className="h-3.5 w-3.5 text-gray-500" />
							{p.label}
						</motion.button>
					))}
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The sheet: today's Filters sheet with the essentials and the Mood card pinned on top. Desktop from the right,
// phones from the bottom (today's SnapSheet), same content.

function MoodCard({ d }: { d: ProtoDiscover }) {
	const options: Option[] = MOODS.map((t) => ({
		id: t.key,
		label: t.name,
		active: d.isOn(t),
		count: d.countFor(t),
		toggle: () => d.toggle(t),
		swatch: <Dot color={t.color} />,
	}))
	const any = options.some((o) => o.active)
	return (
		<section aria-label="Mood" className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.06]">
			<div className="-mt-1 mb-3 flex min-h-8 items-center gap-2">
				<span className={`h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS.moods.dot}`} />
				<span className="flex-1 text-[14px] font-semibold text-gray-100">Mood</span>
				{any && (
					<button
						type="button"
						onClick={() => d.filters.set({ moods: [] })}
						className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</div>
			<ChipList options={options} />
		</section>
	)
}

function SheetBody({ d, pieces, search }: { d: ProtoDiscover; pieces: Pieces; search?: React.RefObject<HTMLInputElement> }) {
	const [query, setQuery] = useState("")
	return (
		<>
			<FilterSearchField value={query} onChange={setQuery} inputRef={search} />
			<OneLineChips chips={pieces.chips} state={pieces.groups.state} onChange={pieces.onChange} className="mt-3" />
			{query.trim() ? (
				<FilterGroups data={pieces.groups} query={query} className="mt-4" />
			) : (
				<div className="mt-4 flex flex-col gap-3">
					<section aria-label="Essentials" className="flex flex-wrap gap-2">
						<ServicesControl {...pieces.servicesProps} size="sm" />
						<NotSeenSwitch {...pieces.notSeenProps} size="sm" />
					</section>
					<MoodCard d={d} />
					{/* The Mood card is pinned above, so the stack leaves its own out. */}
					<FilterGroups data={pieces.groups} query="" className="[&_div:has(>#filter-card-moods)]:hidden" />
				</div>
			)}
		</>
	)
}

function SideSheet({ open, onClose, d, pieces }: { open: boolean; onClose: () => void; d: ProtoDiscover; pieces: Pieces }) {
	const panel = useRef<HTMLElement>(null)
	const search = useRef<HTMLInputElement>(null)
	const titleId = useId()
	useModalDialog({ open, onClose, container: panel, initialFocus: search })
	useEffect(() => {
		if (!open) return
		const root = document.documentElement
		const before = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter }
		root.style.scrollbarGutter = "stable"
		root.style.overflow = "hidden"
		return () => {
			root.style.overflow = before.overflow
			root.style.scrollbarGutter = before.gutter
		}
	}, [open])
	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						aria-hidden
						className="fixed inset-0 z-[1001] bg-black/60"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
					/>
					<motion.aside
						// biome-ignore lint/a11y/useSemanticElements: animated sheet with its own focus trap, like today's
						ref={panel}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 380, damping: 40 }}
						className="fixed inset-y-0 right-0 z-[1002] flex w-full max-w-[480px] flex-col bg-gray-950 ring-1 ring-white/10 shadow-[-30px_0_80px_-20px_rgba(0,0,0,.9)]"
					>
						<header className="flex items-center justify-between px-6 pt-6 pb-4">
							<h2 id={titleId} className="brand-header text-2xl text-white">
								Filters
							</h2>
							<button
								type="button"
								onClick={onClose}
								aria-label="Close filters"
								className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-gray-300 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</header>
						<div className="flex-1 overflow-y-auto px-6 pb-8">
							<SheetBody d={d} pieces={pieces} search={search} />
						</div>
						<Footer d={d} pieces={pieces} onClose={onClose} />
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	)
}

function Footer({ d, pieces, onClose }: { d: ProtoDiscover; pieces: Pieces; onClose: () => void }) {
	return (
		<footer className="flex shrink-0 items-center gap-4 border-t border-white/5 bg-gray-950 px-4 pt-3 pb-5 lg:px-6 lg:py-4">
			<button
				type="button"
				onClick={d.filters.clearSecondary}
				className="text-sm text-gray-400 cursor-pointer hover:text-white"
			>
				Clear all
			</button>
			<span className="flex-1 text-right text-xs tabular-nums text-gray-500">
				{d.counts?.hidden ? `${d.counts.hidden.toLocaleString("en")} hidden` : ""}
			</span>
			<ShowTitlesButton counts={pieces.groups.counts} onClick={onClose} />
		</footer>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantF({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [side, setSide] = useState(false)
	const [snap, setSnap] = useState(-1)
	const open = () => {
		if (window.matchMedia("(min-width: 1024px)").matches) setSide(true)
		else setSnap(0)
	}
	return (
		<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
			<DiscoverHeading
				q={d.q}
				onSearch={(text) => d.setQ(text)}
				onClear={() => d.setQ(null)}
				explanation={d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null}
			/>
			<div className="mt-3 lg:mt-4">
				<MoodRow d={d} />
			</div>
			<CombineLine d={d} pieces={pieces} className="mt-2 lg:hidden" />
			{/* The real bar. Its Filters button (desktop) and the slab's Filters key (phones) open this page's sheet; its
			    own count line and the phone's quick-filter row make way for the line below and the mood row. */}
			<div
				className="lg:mt-4 [&>div:first-child>div:nth-child(2)]:hidden [&>div:nth-child(2)>div:first-child]:hidden"
				onClickCapture={(event) => {
					const button = (event.target as HTMLElement).closest<HTMLElement>('button[aria-haspopup="dialog"]')
					if (!button?.getAttribute("aria-label")?.startsWith("Filters")) return
					event.preventDefault()
					event.stopPropagation()
					open()
				}}
			>
				<FilterBar filters={d.filters} counts={d.counts} />
			</div>
			<div className="mt-5 hidden items-center gap-5 lg:flex">
				<FilterInsight
					counts={d.counts}
					chips={pieces.chips.filter((c) => c.key !== "services")}
					state={d.filters.state}
					onChange={pieces.onChange}
					onDrop={d.filters.drop}
					onClear={d.filters.clearSecondary}
					searching={d.filters.searching}
					className="shrink-0"
				/>
				<span aria-hidden className="h-4 w-px shrink-0 bg-white/10" />
				<CombineLine d={d} pieces={pieces} className="flex-1" />
			</div>
			<div className="mt-4">
				<ProtoGrid d={d} />
			</div>
			<SideSheet open={side} onClose={() => setSide(false)} d={d} pieces={pieces} />
			<SnapSheet
				index={snap}
				onIndex={setSnap}
				label="Filters"
				footer={<Footer d={d} pieces={pieces} onClose={() => setSnap(-1)} />}
			>
				<div className="px-4 pt-1 pb-6">
					<SheetBody d={d} pieces={pieces} />
				</div>
			</SnapSheet>
		</div>
	)
}

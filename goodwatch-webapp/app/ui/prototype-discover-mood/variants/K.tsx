// PROTOTYPE - throwaway. Variant K, "Mood shelves": browsing with no picks and no query, the page is one poster row per
// mood (the Sides of you rows' look), each fetched as it scrolls near. A row's heading names the mood with its count and
// "Open". Opening a row picks that mood and turns the page into the normal grid; the mood stays above the grid as a
// removable chip, with "+" suggestions from the other groups (honest counts: what each would leave) and "or" moods that
// widen. The real FilterBar stays above everything, so the essentials and Filters never move. A query skips the shelves.
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import type { DiscoverResults } from "~/server/discover-results.server"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterBar, SLAB_CLEARANCE } from "~/ui/filter-bar"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { gridPosterPriority } from "~/utils/tmdb-image"
import { ProtoGrid, type ProtoDiscover, TAGS, type Tag, tagId } from "../kit"

export const NAME = "Mood shelves"

const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")
const PER_ROW = 8
const CARD_W = "w-[40%] shrink-0 snap-start xs:w-[30%] sm:w-[23%] md:w-[19%] lg:w-[15.5%]"

export function VariantK({ d }: { d: ProtoDiscover }) {
	const shelves = d.q === null && d.picked.length === 0
	const top = useRef<HTMLDivElement>(null)
	const open = (t: Tag) => {
		d.toggle(t)
		const y = (top.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 88
		if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) })
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
				<FilterBar filters={d.filters} counts={d.counts} taste="signUp" />
			</div>
			<div ref={top} className="mt-4 scroll-mt-24">
				{shelves ? <MoodIndex d={d} onOpen={open} /> : <PickedRow d={d} />}
			</div>
			<div className="mt-4">{shelves ? <Shelves d={d} onOpen={open} /> : <ProtoGrid d={d} />}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The row above the content. Browsing: every mood as a chip (hue, count), one line that scrolls sideways. Picked: the
// picks as removable chips, then "+" tags that narrow and "or" moods that widen. Both keep the same 44 px height.

function ChipRow({ children, label }: { children: ReactNode; label: string }) {
	return (
		<div
			role="group"
			aria-label={label}
			className="-mx-4 flex h-11 items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
		>
			{children}
		</div>
	)
}

const Dot = ({ color, className = "h-2.5 w-2.5" }: { color: string; className?: string }) => (
	<span aria-hidden className={`shrink-0 rounded-full ${className}`} style={{ background: color }} />
)

function MoodIndex({ d, onOpen }: { d: ProtoDiscover; onOpen: (t: Tag) => void }) {
	return (
		<ChipRow label="Moods">
			{MOOD_TAGS.map((t) => {
				const n = d.countFor(t)
				const dead = n === 0
				return (
					<motion.button
						key={t.key}
						type="button"
						whileTap={TAP}
						disabled={dead}
						onClick={() => onOpen(t)}
						className={`flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${dead ? "bg-white/[0.02] text-gray-600" : "cursor-pointer bg-white/[0.06] text-gray-100 ring-1 ring-white/10 hover:bg-white/[0.11] hover:text-white"}`}
					>
						<Dot color={t.color} />
						<span className="font-semibold">{t.name}</span>
						{n !== null && <span className="text-[11px] tabular-nums text-gray-500">{compactCount(n)}</span>}
					</motion.button>
				)
			})}
		</ChipRow>
	)
}

function PickedRow({ d }: { d: ProtoDiscover }) {
	const total = d.total ?? 0
	const pickedGroups = new Set(d.picked.map((t) => t.group))
	const perGroup = (g: Tag["group"]) => d.picked.filter((t) => t.group === g).length
	// Narrowing: tags from groups with no pick yet; each count is the intersection with everything as it is.
	const combine = TAGS.filter((t) => !pickedGroups.has(t.group))
		.map((t) => ({ t, n: d.countFor(t) }))
		.filter((s): s is { t: Tag; n: number } => s.n !== null && s.n > 0 && s.n < total)
		.sort((a, b) => b.n - a.n)
		.slice(0, 10)
	// Widening: other moods while a mood is picked (and room for one more); the count is the "any of" total.
	const widen = pickedGroups.has("moods") && perGroup("moods") < 3
		? MOOD_TAGS.filter((t) => !d.isOn(t))
				.map((t) => ({ t, n: d.countFor(t) }))
				.filter((s): s is { t: Tag; n: number } => s.n !== null && s.n > total)
				.sort((a, b) => b.n - a.n)
				.slice(0, 4)
		: []
	const lead = d.picked[0]
	return (
		<ChipRow label="Picked tags">
			{d.q === null && (
				<motion.button
					type="button"
					whileTap={TAP}
					onClick={d.clearTags}
					className="flex h-10 shrink-0 items-center gap-1 rounded-full pr-3 pl-2 text-sm font-semibold text-gray-300 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<ChevronLeftIcon className="h-4 w-4" />
					All moods
				</motion.button>
			)}
			{d.picked.map((t) => (
				<motion.button
					key={tagId(t)}
					layout="position"
					type="button"
					whileTap={TAP}
					onClick={() => d.toggle(t)}
					aria-label={`Remove ${t.name}`}
					className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-white pr-2.5 pl-3.5 text-[15px] font-bold whitespace-nowrap text-gray-950 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					style={t === lead ? { boxShadow: `0 0 0 2px ${t.color}55, 0 8px 24px -10px ${t.color}` } : undefined}
				>
					<Dot color={t.color} />
					{t.name}
					<XMarkIcon className="h-4 w-4 text-gray-500" />
				</motion.button>
			))}
			{combine.length > 0 && <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-white/10" />}
			{combine.map(({ t, n }) => (
				<Suggestion key={tagId(t)} t={t} n={n} onClick={() => d.toggle(t)} />
			))}
			{widen.length > 0 && (
				<span className="ml-2 shrink-0 text-xs font-semibold text-gray-500">or</span>
			)}
			{widen.map(({ t, n }) => (
				<Suggestion key={tagId(t)} t={t} n={n} widen onClick={() => d.toggle(t)} />
			))}
		</ChipRow>
	)
}

function Suggestion({ t, n, widen = false, onClick }: { t: Tag; n: number; widen?: boolean; onClick: () => void }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-label={`${widen ? "Or" : "Add"} ${t.name}, ${n.toLocaleString("en")} titles`}
			className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap text-gray-200 cursor-pointer outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${widen ? "border border-dashed border-white/20 hover:bg-white/[0.06]" : "bg-white/[0.06] hover:bg-white/[0.11]"}`}
		>
			{widen ? <Dot color={t.color} className="h-2 w-2" /> : <PlusIcon className="h-3.5 w-3.5 text-gray-500" />}
			{!widen && <Dot color={t.color} className="h-2 w-2" />}
			{t.name}
			<span className="text-[11px] tabular-nums text-gray-500">{compactCount(n)}</span>
		</motion.button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The shelves. Moods with nothing under the current filters fold to one line at the end.

function Shelves({ d, onOpen }: { d: ProtoDiscover; onOpen: (t: Tag) => void }) {
	const live = MOOD_TAGS.filter((t) => d.countFor(t) !== 0)
	const empty = MOOD_TAGS.filter((t) => d.countFor(t) === 0)
	return (
		<div className="flex flex-col gap-6">
			{live.map((t, i) => (
				<Shelf key={t.key} d={d} t={t} index={i} onOpen={() => onOpen(t)} />
			))}
			{empty.length > 0 && (
				<p className="text-sm text-gray-500">
					None with these filters: {empty.map((t) => t.name).join(", ")}
				</p>
			)}
		</div>
	)
}

function useNear<T extends Element>() {
	const ref = useRef<T>(null)
	const [near, setNear] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el || near) return
		const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
			rootMargin: "600px 0px",
		})
		io.observe(el)
		return () => io.disconnect()
	}, [near])
	return [ref, near] as const
}

function shelfQuery(filterQuery: string, mood: string) {
	const params = new URLSearchParams(filterQuery)
	params.set("moods", mood)
	params.set("page", "1")
	return params.toString()
}

function Shelf({ d, t, index, onOpen }: { d: ProtoDiscover; t: Tag; index: number; onOpen: () => void }) {
	const [ref, near] = useNear<HTMLElement>()
	const query = shelfQuery(d.filters.query, t.key)
	const row = useQuery<DiscoverResults>({
		queryKey: ["proto-k-shelf", query],
		enabled: near,
		staleTime: 60_000,
		placeholderData: (previous) => previous,
		queryFn: async ({ signal }) => {
			const response = await fetch(`/api/discover/results?${query}`, { signal })
			if (!response.ok) throw new Error(`Results ${response.status}`)
			return (await response.json()) as DiscoverResults
		},
	})
	const count = row.data?.total ?? d.countFor(t)
	const cards = row.data?.cards.slice(0, PER_ROW) ?? []
	return (
		<section
			ref={ref}
			aria-label={t.name}
			className="-mx-4 border-y border-white/10 bg-white/[0.03] px-4 pt-4 pb-3 lg:mx-0 lg:rounded-xl lg:border lg:px-5"
			style={{ borderTopColor: t.color, borderTopWidth: 3 }}
		>
			<div className="mb-3 flex items-center gap-3">
				<button
					type="button"
					onClick={onOpen}
					className="group flex min-w-0 items-baseline gap-2.5 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
				>
					<Dot color={t.color} className="h-2.5 w-2.5 self-center" />
					<h2 className="truncate text-lg leading-tight font-bold text-white group-hover:text-amber-100 md:text-xl">
						{t.name}
					</h2>
					{count != null && (
						<span className="shrink-0 text-sm tabular-nums text-gray-400">{count.toLocaleString("en")}</span>
					)}
				</button>
				<span className="hidden min-w-0 truncate text-sm text-gray-500 md:block">{t.description}</span>
				<button
					type="button"
					onClick={onOpen}
					className="ml-auto flex shrink-0 items-center gap-0.5 text-sm font-bold text-amber-400 cursor-pointer hover:text-amber-300"
				>
					Open
					<ChevronRightIcon className="h-4 w-4" />
				</button>
			</div>
			<Rail label={t.name}>
				{cards.length
					? cards.map((card, i) => {
							const priority = index < 2 && i < 6 ? gridPosterPriority(index * 6 + i) : "lazy"
							return (
								<div key={card.key} className={CARD_W}>
									<TitlePosterCard card={card} posterPriority={priority} skipOffscreen={priority === "lazy"} />
								</div>
							)
						})
					: Array.from({ length: PER_ROW }, (_, i) => (
							<div key={i} className={CARD_W}>
								<div className="aspect-[2/3] rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]" />
							</div>
						))}
				{cards.length > 0 && count != null && count > cards.length && (
					<div className={CARD_W}>
						<button
							type="button"
							onClick={onOpen}
							className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-lg bg-white/[0.04] text-center ring-1 ring-white/10 cursor-pointer outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<span
								className="grid h-11 w-11 place-items-center rounded-full text-gray-950"
								style={{ background: t.color }}
							>
								<ChevronRightIcon className="h-6 w-6" />
							</span>
							<span className="text-sm font-bold text-white">All {compactCount(count)}</span>
							<span className="text-xs text-gray-400">{t.name}</span>
						</button>
					</div>
				)}
			</Rail>
		</section>
	)
}

// Sideways rail with edge arrows on hover (as Sides of you).
function Rail({ label, children }: { label: string; children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const [overflows, setOverflows] = useState(false)
	const update = useCallback(() => {
		const el = ref.current
		if (el) setOverflows(el.scrollWidth > el.clientWidth + 4)
	}, [])
	useEffect(() => {
		update()
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(update)
		observer.observe(el)
		return () => observer.disconnect()
	}, [update])
	const step = (direction: 1 | -1) => {
		const el = ref.current
		if (!el) return
		const end = el.scrollWidth - el.clientWidth
		if (direction === 1 && el.scrollLeft >= end - 4) el.scrollTo({ left: 0, behavior: "smooth" })
		else if (direction === -1 && el.scrollLeft <= 4) el.scrollTo({ left: end, behavior: "smooth" })
		else el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" })
	}
	const arrow = `absolute top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-gray-950 shadow-[0_4px_16px_rgba(0,0,0,0.6)] ring-2 ring-gray-950/40 transition-[opacity,transform] hover:scale-110 focus-visible:opacity-100 md:flex ${overflows ? "opacity-0 group-hover/rail:opacity-100" : "pointer-events-none opacity-0"}`
	return (
		<div className="group/rail relative">
			<div
				ref={ref}
				className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
			>
				{children}
			</div>
			<button type="button" aria-label={`Scroll ${label} back`} onClick={() => step(-1)} tabIndex={overflows ? 0 : -1} className={`${arrow} -left-4`}>
				<ChevronLeftIcon className="h-7 w-7" />
			</button>
			<button type="button" aria-label={`Scroll ${label} forward`} onClick={() => step(1)} tabIndex={overflows ? 0 : -1} className={`${arrow} -right-4`}>
				<ChevronRightIcon className="h-7 w-7" />
			</button>
		</div>
	)
}

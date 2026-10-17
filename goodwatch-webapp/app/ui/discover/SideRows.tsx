// Sides of you on Discover (#671): while For you is on, a row per group of the member's taste and a row of the titles
// that fit none ("More for you"). Groups keep the order the server gives; "More for you" always comes last.
// Inside a row, titles keep the list's order. A group shows its trait name and the loved titles that stand for it, with
// no summary line. "More like this" narrows Discover to the group; the group's moods open Watch next. Wording:
// side-rows-copy.ts.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import type {
	DiscoverResults,
	DiscoverSideRow,
} from "~/server/discover-results.server"
import type { DiscoverSide } from "~/server/discover-sides.server"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { gridPosterPriority, tmdbImageUrl } from "~/utils/tmdb-image"
import { SIDE_ROWS_COPY as COPY } from "./side-rows-copy"

// Telling groups apart starts with their names and posters; the hue only helps.
const HUES = ["#f59e0b", "#38bdf8", "#e879f9", "#4ade80", "#fb7185"]
const NO_SIDE_HUE = "#9ca3af"
// Cards a wide screen shows in a row without scrolling: the first two rows' load first.
const IN_VIEW = 6

const hueOf = (side: DiscoverSide) =>
	side.number === null ? NO_SIDE_HUE : HUES[(side.number - 1) % HUES.length]
const labelOf = (side: DiscoverSide) => side.name ?? COPY.noGroup

export function SideRows({
	rows,
	onSeeAll,
}: {
	rows: DiscoverSideRow[]
	onSeeAll: (id: string) => void
}) {
	// "More for you" always comes last, after the groups.
	const ordered = [
		...rows.filter((row) => row.number !== null),
		...rows.filter((row) => row.number === null),
	]
	return (
		<div className="flex flex-col gap-6">
			{ordered.map((row, r) => (
				<section
					key={row.id}
					aria-label={labelOf(row)}
					className="-mx-4 border-y border-white/10 bg-white/[0.03] px-4 pt-4 pb-3 lg:mx-0 lg:rounded-xl lg:border lg:px-5"
					style={{ borderTopColor: hueOf(row), borderTopWidth: 3 }}
				>
					<div className="mb-3">
						<SideHeader
							side={row}
							action={
								row.total > row.cards.length && (
									<button
										type="button"
										onClick={() => onSeeAll(row.id)}
										className="shrink-0 cursor-pointer text-sm font-bold text-amber-400 hover:text-amber-300"
									>
										{COPY.seeAll(row.total)}
									</button>
								)
							}
						/>
					</div>
					<PosterRail label={labelOf(row)}>
						{row.cards.map((card, i) => {
							const priority =
								r < 2 && i < IN_VIEW
									? gridPosterPriority(r * IN_VIEW + i)
									: "lazy"
							return (
								<div
									key={card.key}
									className="w-[40%] shrink-0 snap-start xs:w-[30%] sm:w-[23%] md:w-[19%] lg:w-[15.5%]"
								>
									<TitlePosterCard
										card={card}
										posterPriority={priority}
										skipOffscreen={priority === "lazy"}
									/>
								</div>
							)
						})}
					</PosterRail>
				</section>
			))}
		</div>
	)
}

// A row that scrolls sideways without a visible scrollbar. Touch screens swipe; pointer screens get round arrow
// buttons at the edges while hovering a row that overflows. Each click moves about one view's width; at either end
// the row wraps around to the other end.
function PosterRail({
	label,
	children,
}: {
	label: string
	children: ReactNode
}) {
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
		const atStart = el.scrollLeft <= 4
		const atEnd = el.scrollLeft >= end - 4
		if (direction === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" })
		else if (direction === -1 && atStart)
			el.scrollTo({ left: end, behavior: "smooth" })
		else
			el.scrollBy({
				left: direction * el.clientWidth * 0.85,
				behavior: "smooth",
			})
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
			<button
				type="button"
				aria-label={`Scroll ${label} back`}
				onClick={() => step(-1)}
				tabIndex={overflows ? 0 : -1}
				className={`${arrow} -left-4`}
			>
				<ChevronLeftIcon className="h-7 w-7 stroke-current stroke-1" />
			</button>
			<button
				type="button"
				aria-label={`Scroll ${label} forward`}
				onClick={() => step(1)}
				tabIndex={overflows ? 0 : -1}
				className={`${arrow} -right-4`}
			>
				<ChevronRightIcon className="h-7 w-7 stroke-current stroke-1" />
			</button>
		</div>
	)
}

/** Above the grid while Discover is narrowed to one side: the side, back to all sides, and Watch next. */
export function SideBanner({
	side,
	onAll,
}: {
	side: DiscoverSide
	onAll: () => void
}) {
	return (
		<div className="mb-5 rounded-lg border border-white/10 bg-gray-900/60 p-3">
			<SideHeader
				side={side}
				action={
					<button
						type="button"
						onClick={onAll}
						className="shrink-0 cursor-pointer text-sm font-bold text-amber-400 hover:text-amber-300"
					>
						{COPY.backToAll}
					</button>
				}
			/>
		</div>
	)
}

// The name gets the width beside the posters; the links take a line of their own under it, full width on phones so
// a two-line name never shares its width with them. "More for you" has neither posters nor Watch next: its action
// sits beside its name.
function SideHeader({
	side,
	action,
}: {
	side: DiscoverSide
	action: ReactNode
}) {
	const posters = side.here.length > 0
	// "More for you" keeps its action beside its name; a group's name gets the width, its links a line under it.
	const linksBelow = side.number !== null
	return (
		<div
			className={`grid items-center gap-x-3 gap-y-1 ${posters ? "grid-cols-[auto_1fr]" : "grid-cols-1"}`}
		>
			{posters && (
				<span
					className={`flex shrink-0 -space-x-3 ${linksBelow ? "md:row-span-2" : ""}`}
					aria-hidden
				>
					{side.here.map((t, i) => (
						<img
							key={t.key}
							src={tmdbImageUrl(t.poster, "w185")}
							alt=""
							title={t.title}
							className="aspect-[2/3] h-10 rounded-sm md:h-14 object-cover ring-2 ring-gray-950"
							style={{ zIndex: side.here.length - i }}
							draggable={false}
						/>
					))}
				</span>
			)}
			<div
				className={`flex min-w-0 items-start gap-2 ${linksBelow ? "self-end" : ""}`}
			>
				<span
					className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
					style={{ background: hueOf(side) }}
					aria-hidden
				/>
				<h2 className="line-clamp-2 text-lg leading-tight font-bold text-white md:text-xl">
					{labelOf(side)}
				</h2>
				{!linksBelow && <div className="ml-auto self-center">{action}</div>}
			</div>
			{linksBelow && (
				<div
					className={`flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 self-start ${posters ? "col-span-2 md:col-span-1" : ""}`}
				>
					{side.moods.length > 0 ? (
						<Link
							to={`/watch-next?moods=${side.moods.join(",")}`}
							prefetch="intent"
							className="text-sm font-semibold text-amber-200 underline-offset-2 hover:text-amber-100 hover:underline"
						>
							{COPY.watchNext}
						</Link>
					) : (
						<span />
					)}
					{action}
				</div>
			)}
		</div>
	)
}

/** The rows of the first page, or null when Discover shows its grid. */
export const sideRowsOf = (first: DiscoverResults | null) =>
	first?.sides?.layout === "rows" ? first.sides.rows : null

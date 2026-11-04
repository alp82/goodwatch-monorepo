// A shelf's block in More like this's expanded view: its caption, heading and note (where the shelf's were: the
// heading moves from the shelf's), a Show all into Discover filtered the nearest way Discover can (`discover`,
// discover-links.ts), then one row of the shelf's own control, a Movies / Shows filter for a mixed list and the sort
// (Discover's SortControl), and two rows of the titles as the production poster card, bigger than the shelf's. A card
// opens the quick view, stepping through the block.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import {
	type ReactNode,
	Suspense,
	lazy,
	useEffect,
	useMemo,
	useState,
} from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { SegmentedTabs } from "~/ui/details/SegmentedTabs"
import { CAPTION } from "~/ui/details/page-ui"
import { SortControl } from "~/ui/filter-bar/controls"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { SizeRule } from "~/utils/tmdb-image"
import { SEE_ALL } from "./Shelf"
import { type ShelfTitle, shelfAnchor, shelfKey } from "./shelf-data"

const ShelfQuickView = lazy(
	reloadOnStaleChunk(() =>
		import("./ShelfQuickView").then((module) => ({
			default: module.ShelfQuickView,
		})),
	),
)

const WIDE: SizeRule[] = [
	["(min-width: 1280px)", "190px"],
	["(min-width: 640px)", "22vw"],
	[null, "32vw"],
]

/** The block's columns, a step above the shelf's row. */
const GRID_COLS = "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
/** GRID_COLS's columns from each breakpoint up, widest first. */
const COLS: [number, number][] = [
	[1280, 6],
	[1024, 5],
	[640, 4],
	[0, 3],
]

function useCols() {
	const [cols, setCols] = useState(COLS[0][1])
	useEffect(() => {
		const mqs = COLS.map(
			([w, n]) => [window.matchMedia(`(min-width: ${w}px)`), n] as const,
		)
		const on = () => setCols(mqs.find(([m]) => m.matches)?.[1] ?? 3)
		on()
		for (const [m] of mqs) m.addEventListener("change", on)
		return () => {
			for (const [m] of mqs) m.removeEventListener("change", on)
		}
	}, [])
	return cols
}

export function ExpandedHead({
	kind,
	title,
	note,
	action,
}: {
	kind: ReactNode
	title: ReactNode
	note?: ReactNode
	action?: ReactNode
}) {
	// The heading stays the shelf's (the same sizes), so it reads as the shelf grown.
	return (
		<div className="flex items-end gap-4">
			<div data-shelf-head="" className="min-w-0 flex-1">
				<p className={CAPTION}>{kind}</p>
				<h2 className="mt-1 text-pretty text-lg leading-snug font-semibold text-gray-100">
					{title}
				</h2>
				{note && <p className="mt-0.5 text-sm text-gray-500">{note}</p>}
			</div>
			{action && (
				<div data-shelf-fade="" className="shrink-0">
					{action}
				</div>
			)}
		</div>
	)
}

export function ExpandedShelf({
	id,
	kind,
	title,
	note,
	controls,
	titles,
	caption,
	current,
	reason,
	busy,
	empty,
	listKey = "",
	discover,
	order,
}: {
	id: string
	kind: ReactNode
	title: ReactNode
	note?: ReactNode
	controls?: ReactNode
	titles: ShelfTitle[]
	caption?: (t: ShelfTitle, i: number) => ReactNode
	current?: string
	reason?: ReactNode
	busy?: boolean
	empty?: ReactNode
	listKey?: string
	/** Show all's Discover link (none: no Show all). */
	discover?: string | null
	order?: string
}) {
	return (
		<div className="pb-4">
			<ExpandedHead
				kind={kind}
				title={title}
				note={note}
				action={
					discover && titles.length > 0 ? (
						<Link to={discover} prefetch="intent" className={SEE_ALL}>
							Show all
							<ChevronRightIcon
								className="-mr-1 h-4 w-4 text-gray-400"
								aria-hidden="true"
							/>
						</Link>
					) : undefined
				}
			/>
			{/* The shelf's own controls share the grid's row (its Kind tabs, the sort on the right). */}
			<CardGrid
				controls={controls}
				id={id}
				titles={titles}
				caption={caption}
				current={current}
				reason={reason ?? title}
				busy={busy}
				empty={empty}
				listKey={listKey}
				rows={2}
				order={order}
			/>
		</div>
	)
}

type Sort = "shelf" | "best" | "new"

function CardGrid({
	id,
	titles,
	caption,
	current,
	reason,
	busy = false,
	empty,
	listKey = "",
	order = "Best match",
	rows,
	controls,
}: {
	id: string
	titles: ShelfTitle[]
	caption?: (t: ShelfTitle, i: number) => ReactNode
	current?: string
	reason: ReactNode
	busy?: boolean
	empty?: ReactNode
	listKey?: string
	/** The name of the list's own order ("Most watched"). */
	order?: string
	/** At most this many rows (none: every title). */
	rows?: number
	/** The shelf's own controls, first on the row with the Kind tabs and the sort. */
	controls?: ReactNode
}) {
	const cols = useCols()
	const [sort, setSort] = useState<Sort>("shelf")
	const [type, setType] = useState<"all" | "movie" | "show">("all")
	const movies = titles.filter((t) => t.type === "movie").length
	const mixed = movies > 0 && movies < titles.length
	const list = useMemo(() => {
		const indexed = titles.map((t, i) => ({ t, i }))
		const kept = indexed.filter(
			({ t }) => type === "all" || !mixed || t.type === type,
		)
		if (sort === "best")
			kept.sort((a, b) => (b.t.goodwatch ?? -1) - (a.t.goodwatch ?? -1))
		if (sort === "new") kept.sort((a, b) => (b.t.year ?? 0) - (a.t.year ?? 0))
		return rows ? kept.slice(0, rows * cols) : kept
	}, [titles, sort, type, mixed, rows, cols])
	const shelf = `${id}-x`
	const [open, setOpen] = useState<number | null>(null)
	const openable = list.map(({ t }) => t).filter((t) => shelfKey(t) !== current)
	return (
		<>
			{/* One sort (Discover's sort dropdown, on the right of the filters' row), Movies / Shows only in a mixed list. */}
			{(titles.length > 1 || mixed || controls) && (
				<div data-shelf-fade="" className="mt-5 flex items-start gap-3">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
						{controls}
						{mixed && (
							<SegmentedTabs
								label="Kind"
								value={type}
								onChange={(k) => setType(k as "all" | "movie" | "show")}
								tabs={[
									{ key: "all", label: "All", count: titles.length },
									{ key: "movie", label: "Movies", count: movies },
									{
										key: "show",
										label: "Shows",
										count: titles.length - movies,
									},
								]}
							/>
						)}
					</div>
					{titles.length > 1 && (
						// On a phone the button drops its "Sort" word (Discover's pill does the same).
						<div className="ml-auto shrink-0 max-sm:[&_[data-sort-button]>span.text-gray-400]:hidden">
							<SortControl
								size="sm"
								align="right"
								portal
								menuClassName="w-64"
								options={[
									{ key: "shelf", label: order, hint: "The shelf's own order" },
									{
										key: "best",
										label: "Highest score",
										hint: "GoodWatch score, highest first",
									},
									{ key: "new", label: "Newest", hint: "Latest release first" },
								]}
								value={sort}
								onChange={(s) => setSort(s as Sort)}
							/>
						</div>
					)}
				</div>
			)}
			{list.length === 0 && empty ? (
				<p className="mt-4 flex min-h-[4.5rem] items-center rounded-xl bg-white/[0.025] px-4 text-sm text-gray-500 ring-1 ring-white/10">
					{empty}
				</p>
			) : (
				<ul
					key={listKey}
					aria-busy={busy}
					style={{ opacity: busy ? 0.55 : 1 }}
					className={`shelf-busy mt-4 grid gap-x-2 gap-y-4 sm:gap-x-3 ${GRID_COLS}`}
				>
					{list.map(({ t, i }) => {
						const key = shelfKey(t)
						const here = key === current
						const at = openable.indexOf(t)
						return (
							<li
								key={key}
								data-shelf-key={key}
								data-pop-id={shelfAnchor(shelf, t)}
								aria-current={here ? "page" : undefined}
								className="relative min-w-0"
							>
								<div
									className={`relative ${here ? "pointer-events-none" : ""}`}
								>
									<MovieTvCard
										mediaType={t.type}
										posterSizes={WIDE}
										actions={here ? false : "bottom"}
										onOpen={here ? undefined : () => setOpen(at)}
										details={{
											tmdb_id: t.tmdbId,
											title: t.title,
											release_year: t.year,
											poster_path: t.poster,
											goodwatch_overall_score_normalized_percent: t.goodwatch,
										}}
									/>
									<span
										aria-hidden="true"
										className="pointer-events-none absolute -inset-1 rounded-xl ring-2 ring-amber-400 transition-opacity duration-200"
										style={{
											opacity:
												here || (open !== null && openable[open] === t) ? 1 : 0,
										}}
									/>
								</div>
								{caption && (
									<p
										className={`mt-1.5 truncate px-0.5 text-xs tabular-nums ${here ? "font-semibold text-amber-300" : "text-gray-400"}`}
									>
										{caption(t, i)}
									</p>
								)}
							</li>
						)
					})}
				</ul>
			)}
			{open !== null && openable[open] && (
				<Suspense fallback={null}>
					<ShelfQuickView
						shelf={shelf}
						list={openable}
						reason={reason}
						index={open}
						onIndex={setOpen}
						onClose={() => setOpen(null)}
					/>
				</Suspense>
			)}
		</>
	)
}

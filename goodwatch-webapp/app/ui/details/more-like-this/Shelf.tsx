// One More like this shelf: a caption (why it's here), a heading, a muted line of evidence, an optional control under
// the heading, and a row of poster cards with previous / next on a desktop. A card opens the quick view, stepping
// through the shelf.
// - `listKey`: when it changes, the new cards fade in (opacity only) and the row scrolls back to its start.
// - `busy` dims the cards while a new answer is on its way (the old ones stay); `empty` says why there's nothing.
// Inside the ExpandProvider (expanded-view.tsx) a shelf with more than its row shows gets a See more, which opens the
// expanded view, and the shelf's block there (ExpandedShelves.tsx) is portalled into it.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import {
	type ReactNode,
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { CAPTION } from "~/ui/details/page-ui"
import { StepButton } from "~/ui/row-arrows"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { SizeRule } from "~/utils/tmdb-image"
import { ExpandPortal, useExpand } from "./expanded-view"
import { type ShelfTitle, shelfAnchor, shelfKey } from "./shelf-data"

// The expanded view's block for this shelf, loaded once the view opens.
const ExpandedShelf = lazy(
	reloadOnStaleChunk(() =>
		import("./ExpandedShelves").then((module) => ({
			default: module.ExpandedShelf,
		})),
	),
)
const ShelfQuickView = lazy(
	reloadOnStaleChunk(() =>
		import("./ShelfQuickView").then((module) => ({
			default: module.ShelfQuickView,
		})),
	),
)

const SHELF_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "150px"],
	["(min-width: 1024px)", "12vw"],
	[null, "30vw"],
]

const ITEM =
	"w-[calc((100%-2*0.5rem)/3.3)] sm:w-[calc((100%-4*0.5rem)/5.5)] lg:w-[calc((100%-7*0.5rem)/8)]"

/** The shelves' motion: opacity only, none with reduced motion. */
export const SHELF_STYLE = `
@keyframes shelf-in { from { opacity: 0; } to { opacity: 1; } }
.shelf-in { animation: shelf-in .24s ease both; }
.shelf-busy { transition: opacity .2s ease; }
@media (prefers-reduced-motion: reduce) { .shelf-in { animation: none; } .shelf-busy { transition: none; } }
`

/** A quiet link or button beside a shelf's heading ("Fingerprint ›", "All their work ›"). */
export const ACTION =
	"inline-flex cursor-pointer items-center gap-1 rounded text-[13px] font-semibold whitespace-nowrap text-gray-400 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-amber-300"

/** The shelf's See more: a quiet pill, the page's chip look, so it reads as the way in. */
export const SEE_ALL =
	"inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap text-gray-100 ring-1 ring-white/20 transition-colors duration-150 hover:bg-white/[0.07] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"

export interface ShelfProps {
	id: string
	kind: ReactNode
	title: ReactNode
	note?: ReactNode
	action?: ReactNode
	/** Chips or a switch under the heading. */
	controls?: ReactNode
	titles: ShelfTitle[]
	listKey?: string
	busy?: boolean
	/** Shown in the row's place when there are no titles. */
	empty?: ReactNode
	/** The quick view's reason line. */
	reason?: ReactNode
	caption?: (t: ShelfTitle, i: number) => ReactNode
	/** The page's own title, marked and not openable. */
	current?: string
	children?: ReactNode
	/** False: no See more (a shelf whose row already shows everything). */
	seeAll?: boolean
	/** The expanded view's Show all: Discover filtered the nearest way to this shelf (discover-links.ts). */
	discover?: string | null
	/** The expanded view's name for the shelf's own order (default "Best match"). */
	order?: string
}

export function Shelf({
	id,
	kind,
	title,
	note,
	action,
	controls,
	titles,
	listKey = "",
	busy = false,
	empty,
	reason,
	caption,
	current,
	children,
	seeAll = true,
	discover,
	order,
}: ShelfProps) {
	const row = useRef<HTMLUListElement>(null)
	const section = useRef<HTMLElement>(null)
	const x = useExpand()
	const posters = titles
		.slice(0, 3)
		.map((t) => t.poster)
		.join("|")
	useEffect(() => {
		if (!x) return
		return x.register(id, {
			el: section.current,
			count: titles.length,
			posters: posters.split("|").map((p) => p || null),
		})
	}, [x?.register, id, titles.length, posters])
	const [edges, setEdges] = useState({ start: true, end: true })
	const measure = useCallback(() => {
		const el = row.current
		if (!el) return
		setEdges({
			start: el.scrollLeft <= 4,
			end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
		})
	}, [])
	useEffect(() => {
		const el = row.current
		if (!el) return
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [measure, titles.length])
	// A new answer starts at its first card.
	useEffect(() => {
		row.current?.scrollTo({ left: 0 })
	}, [listKey])
	const step = (d: -1 | 1) => {
		const el = row.current
		if (!el) return
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		el.scrollBy({
			left: d * el.clientWidth * 0.75,
			behavior: reduce ? "auto" : "smooth",
		})
	}
	const [open, setOpen] = useState<number | null>(null)
	const openable = titles.filter((t) => shelfKey(t) !== current)
	const scrolls = !(edges.start && edges.end)

	return (
		<section ref={section} aria-labelledby={`${id}-h`} className="min-w-0">
			{/* On a narrow screen the actions go under the heading instead of squeezing it. */}
			<div className="flex flex-wrap items-end gap-x-4 gap-y-2">
				<div data-shelf-head="" className="min-w-[min(100%,18rem)] flex-1">
					<p data-shelf-kind="" className={CAPTION}>
						{kind}
					</p>
					<h3
						id={`${id}-h`}
						className="mt-1 text-pretty text-lg leading-snug font-semibold text-gray-100"
					>
						{title}
					</h3>
					{note && <p className="mt-0.5 text-sm text-gray-500">{note}</p>}
				</div>
				<div className="flex shrink-0 items-center gap-3">
					{action}
					{/* See more only when there is more to see than the row already shows. */}
					{x && seeAll && titles.length > 0 && scrolls && (
						<button
							type="button"
							onClick={() => x.open(id)}
							className={SEE_ALL}
						>
							See more
							<span className="text-xs font-normal text-gray-400 tabular-nums">
								{titles.length}
							</span>
						</button>
					)}
					{scrolls && (
						<div className="hidden items-center gap-1 lg:flex">
							<StepButton
								label="Previous titles"
								disabled={edges.start}
								onClick={() => step(-1)}
							>
								<ChevronLeftIcon className="h-5 w-5" />
							</StepButton>
							<StepButton
								label="More titles"
								disabled={edges.end}
								onClick={() => step(1)}
							>
								<ChevronRightIcon className="h-5 w-5" />
							</StepButton>
						</div>
					)}
				</div>
			</div>
			{controls && <div className="mt-3">{controls}</div>}
			{titles.length === 0 && empty ? (
				<p className="mt-3 flex min-h-[4.5rem] items-center rounded-xl bg-white/[0.025] px-4 text-sm text-gray-500 ring-1 ring-white/10">
					{empty}
				</p>
			) : (
				<ul
					key={listKey}
					ref={row}
					data-shelf-row=""
					onScroll={measure}
					aria-busy={busy}
					style={{ opacity: busy ? 0.55 : 1 }}
					className="shelf-in shelf-busy -mx-4 mt-2 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 py-1.5 [scrollbar-width:none] lg:-mx-1.5 lg:scroll-px-1.5 lg:px-1.5 [&::-webkit-scrollbar]:hidden"
				>
					{titles.map((t, i) => {
						const key = shelfKey(t)
						const here = key === current
						const at = openable.indexOf(t)
						return (
							<li
								key={key}
								data-pop-id={shelfAnchor(id, t)}
								data-shelf-key={key}
								data-find-title={t.title}
								data-find-year={t.year ?? undefined}
								aria-current={here ? "page" : undefined}
								className={`relative min-w-0 shrink-0 snap-start ${ITEM}`}
							>
								<div
									className={`relative ${here ? "pointer-events-none" : ""}`}
								>
									<MovieTvCard
										mediaType={t.type}
										posterSizes={SHELF_POSTER_SIZES}
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
			<ExpandPortal
				id={id}
				block={
					<Suspense fallback={<div aria-busy="true" className="h-80" />}>
						<ExpandedShelf
							id={id}
							kind={kind}
							title={title}
							note={note}
							controls={controls}
							titles={titles}
							caption={caption}
							current={current}
							reason={reason}
							busy={busy}
							empty={empty}
							listKey={listKey}
							discover={discover}
							order={order}
						/>
					</Suspense>
				}
			/>
			{children}
			{open !== null && openable[open] && (
				<Suspense fallback={null}>
					<ShelfQuickView
						shelf={id}
						list={openable}
						reason={reason ?? title}
						index={open}
						onIndex={setOpen}
						onClose={() => setOpen(null)}
					/>
				</Suspense>
			)}
		</section>
	)
}

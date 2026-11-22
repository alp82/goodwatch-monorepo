// Titles as the real poster cards: a rail, a grid with its pager, and
// the small untinted thumbs that decorate a card which is itself the link.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { DISCOVER_GRID } from "~/ui/discover/DiscoverGrid"
import { SectionHeading } from "~/ui/heading"
import { RowArrows, useStepRow } from "~/ui/row-arrows"
import { NAV_PILL } from "~/ui/selection/selected"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { gridPosterPriority } from "~/utils/tmdb-image"
import type { ShowTitle } from "~/domain/browse/types"
import { poster } from "~/ui/browse/base"

/** The title page shelves' item widths: 3.3 posters on a phone, 5.5 on a tablet, 8 on a desktop. */
const RAIL_ITEM =
	"w-[calc((100%-2*0.5rem)/3.3)] shrink-0 snap-start sm:w-[calc((100%-4*0.75rem)/5.5)] lg:w-[calc((100%-7*0.75rem)/8)]"
/** Wider items, for a rail inside a narrower column. */
const RAIL_ITEM_WIDE =
	"w-[calc((100%-2*0.5rem)/3.3)] shrink-0 snap-start sm:w-[calc((100%-3*0.75rem)/4.4)] lg:w-[calc((100%-4*0.75rem)/5)]"

type MediaKindTitle = { card: Pick<ShowTitle["card"], "media_type"> }

/** Whether a list holds movies and shows together (`/all/...`): only then a show says that it is one. */
export const isMixed = (titles: MediaKindTitle[]) =>
	titles.some((t) => t.card.media_type === "show") &&
	titles.some((t) => t.card.media_type !== "show")

/**
 * The mark of a show in a mixed list: a small word in the poster's top left corner (movies carry none, so half the
 * posters stay clean). It sits over the card, not in it, and never takes the click.
 */
export function ShowMark({ title, mixed }: { title: MediaKindTitle; mixed: boolean }) {
	if (!mixed || title.card.media_type !== "show") return null
	return (
		<span className="pointer-events-none absolute top-2 left-2 z-10 rounded-[5px] bg-gray-950/80 px-1.5 py-0.5 text-[10px] leading-4 font-bold tracking-wide text-gray-100 uppercase ring-1 ring-white/15 backdrop-blur-sm">
			Show
		</span>
	)
}

/**
 * A row of real poster cards with the shelves' arrows. `to` makes the heading the link to the row's full page.
 * `aside` sits at the heading's right, before the arrows.
 */
export function PosterRail({
	id,
	title,
	line,
	to,
	titles,
	eager = false,
	wide = false,
	aside,
}: {
	id: string
	title?: ReactNode
	line?: ReactNode
	to?: string
	titles: ShowTitle[]
	eager?: boolean
	wide?: boolean
	aside?: ReactNode
}) {
	const row = useStepRow<HTMLUListElement>([titles.length])
	const mixed = isMixed(titles)
	if (!titles.length) return null
	const heading = title && (
		<>
			<SectionHeading as="h2" size="group" id={`rail-${id}`} className="group-hover:text-amber-300">
				{title}
				{to && (
					<span
						aria-hidden
						className="ml-1 inline-block text-amber-300 transition-transform duration-200 group-hover:translate-x-0.5"
					>
						›
					</span>
				)}
			</SectionHeading>
			{line && <p className="mt-0.5 text-sm text-gray-400">{line}</p>}
		</>
	)
	return (
		<section aria-labelledby={title ? `rail-${id}` : undefined} className="min-w-0 space-y-3">
			{(title || aside) && (
				<div className="flex items-end gap-4">
					{to ? (
						<Link
							to={to}
							prefetch="intent"
							className="group min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{heading}
						</Link>
					) : (
						<div className="min-w-0 flex-1">{heading}</div>
					)}
					{aside}
					<RowArrows row={row} label={typeof title === "string" ? title : "titles"} />
				</div>
			)}
			<ul
				ref={row.ref}
				onScroll={row.measure}
				className="-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] sm:-mx-6 sm:gap-3 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
			>
				{titles.map((t, i) => (
					<li key={t.card.key} className={`relative ${wide ? RAIL_ITEM_WIDE : RAIL_ITEM}`}>
						<ShowMark title={t} mixed={mixed} />
						<TitlePosterCard
							card={t.card}
							posterPriority={eager ? gridPosterPriority(i) : "lazy"}
							skipOffscreen={i > 7}
						/>
					</li>
				))}
			</ul>
		</section>
	)
}

/** The page's full list: Discover's grid of real poster cards. */
export function TitleGrid({ titles, eager = true }: { titles: ShowTitle[]; eager?: boolean }) {
	const mixed = isMixed(titles)
	return (
		<div className={DISCOVER_GRID}>
			{titles.map((t, i) => (
				<div key={t.card.key} className="relative min-w-0">
					<ShowMark title={t} mixed={mixed} />
					<TitlePosterCard
						card={t.card}
						posterPriority={eager ? gridPosterPriority(i) : "lazy"}
						skipOffscreen={i > 18}
					/>
				</div>
			))}
		</div>
	)
}

/** Page links under a grid. `to(n)` is page n's address. */
export function Pager({
	page,
	pages,
	to,
}: {
	page: number
	pages: number
	to: (n: number) => string
}) {
	if (pages <= 1) return null
	const shown = Array.from({ length: pages }, (_, i) => i + 1).filter(
		(n) => n === 1 || n === pages || Math.abs(n - page) <= 2,
	)
	return (
		<nav aria-label="Pages" className="flex flex-wrap items-center gap-1.5 text-sm">
			{shown.map((n, i) => (
				<span key={n} className="flex items-center gap-1.5">
					{i > 0 && shown[i - 1] !== n - 1 && <span className="text-gray-600">…</span>}
					<Link
						to={to(n)}
						aria-current={n === page ? "page" : undefined}
						className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${n === page ? NAV_PILL : "bg-white/[0.05] text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"}`}
					>
						{n}
					</Link>
				</span>
			))}
		</nav>
	)
}

/**
 * Posters as decoration inside a card that is itself one link (so they are images, not links). Never tinted or
 * dimmed. Three by default; on hover of the parent `group` they rise a few pixels, one after the other.
 */
export function PosterTrio({
	titles,
	className = "",
}: {
	titles: { card: Pick<ShowTitle["card"], "key" | "poster_path" | "title"> }[]
	className?: string
}) {
	return (
		<span
			className={`grid gap-1.5 ${className}`}
			style={{ gridTemplateColumns: `repeat(${Math.max(1, titles.length)}, minmax(0, 1fr))` }}
		>
			{titles.map((t, i) => (
				<span
					key={t.card.key}
					className="block overflow-hidden rounded-md bg-gray-800 shadow-md shadow-black/40 ring-1 ring-white/10 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
					style={{ transitionDelay: `${i * 35}ms` }}
				>
					{t.card.poster_path && (
						<img
							src={poster(t.card.poster_path, "w185")}
							alt={t.card.title}
							loading="lazy"
							decoding="async"
							className="block aspect-[2/3] w-full object-cover"
						/>
					)}
				</span>
			))}
		</span>
	)
}

/** One small poster that links to its title page. */
export function Thumb({
	title,
	className = "",
	size = "w185",
}: {
	title: ShowTitle
	className?: string
	size?: string
}) {
	return (
		<Link
			to={title.to}
			prefetch="intent"
			title={`${title.card.title}${title.card.release_year ? ` (${title.card.release_year})` : ""}`}
			className={`block shrink-0 overflow-hidden rounded-md bg-gray-800 ring-1 ring-white/10 outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none ${className}`}
		>
			{title.card.poster_path && (
				<img
					src={poster(title.card.poster_path, size)}
					alt={title.card.title}
					loading="lazy"
					decoding="async"
					className="block aspect-[2/3] h-full w-full object-cover"
				/>
			)}
		</Link>
	)
}

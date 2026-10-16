// Sides of you on Discover (#671): while For you is on, a row per group of the member's taste and a row of the titles
// that fit none ("More for you"), in the order the server gives (each row where its first title sits in the list).
// Inside a row, titles keep the list's order. A group shows its trait name and the loved titles that stand for it, with
// no summary line. "More like this" narrows Discover to the group; the group's moods open Watch next. Wording:
// side-rows-copy.ts.
import { Link } from "@remix-run/react"
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
	return (
		<div className="flex flex-col gap-10">
			{rows.map((row, r) => (
				<section key={row.id} aria-label={labelOf(row)}>
					<div className="mb-3 flex items-end justify-between gap-3">
						<SideHeader side={row} />
						{row.total > row.cards.length && (
							<button
								type="button"
								onClick={() => onSeeAll(row.id)}
								className="shrink-0 cursor-pointer text-sm font-bold text-amber-400 hover:text-amber-300"
							>
								{COPY.seeAll(row.total)}
							</button>
						)}
					</div>
					<div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
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
					</div>
				</section>
			))}
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
		<div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-gray-900/60 p-3">
			<SideHeader side={side} />
			<button
				type="button"
				onClick={onAll}
				className="cursor-pointer text-sm font-bold text-amber-400 hover:text-amber-300"
			>
				{COPY.backToAll}
			</button>
		</div>
	)
}

function SideHeader({ side }: { side: DiscoverSide }) {
	return (
		<div className="flex min-w-0 items-center gap-3">
			{side.here.length > 0 && (
				<span className="flex shrink-0 -space-x-3" aria-hidden>
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
			<div className="min-w-0">
				<div className="flex items-start gap-2">
					<span
						className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
						style={{ background: hueOf(side) }}
						aria-hidden
					/>
					<h2 className="line-clamp-2 text-lg leading-tight font-bold text-white md:text-xl">
						{labelOf(side)}
					</h2>
				</div>
				{side.moods.length > 0 && (
					<Link
						to={`/watch-next?moods=${side.moods.join(",")}`}
						prefetch="intent"
						className="text-sm font-semibold text-amber-200 underline-offset-2 hover:text-amber-100 hover:underline"
					>
						{COPY.watchNext}
					</Link>
				)}
			</div>
		</div>
	)
}

/** The rows of the first page, or null when Discover shows its grid. */
export const sideRowsOf = (first: DiscoverResults | null) =>
	first?.sides?.layout === "rows" ? first.sides.rows : null

// A page of a best-of list: numbered rows (rank, small poster, title, year and genres, the score pill), two columns
// on a wide screen, with the links to the list's pages above and below. Every title is a plain link in the server
// HTML, to the sitemap's address of its page. The page is the same for every visitor: the server's HTML shows the
// GoodWatch score in the pill, and a member's own score, state and services join it from their data.
import { Link } from "@remix-run/react"
import { type ListKind, pagePath, pageRange } from "~/domain/best-lists"
import type { ListTitle } from "~/server/best-lists.server"
import type { RowServices } from "~/server/row-services.server"
import { createMediaKey } from "~/types/user-data"
import { TmdbImage } from "~/ui/TmdbImage"
import {
	RowLogos,
	RowScores,
	rowMark,
	useRowMarks,
} from "~/ui/list-row/RowScores"
import MediaText from "~/ui/media-text/MediaText"
import { presentedText } from "~/ui/media-text/media-text"

// The rows a phone shows without scrolling: their posters load at once.
const EAGER_ROWS = 6

export function ListPageLinks({
	kind,
	page,
	pages,
	total,
}: { kind: ListKind; page: number; pages: number; total: number }) {
	if (pages < 2) return null
	return (
		<nav
			aria-label="Pages of the list"
			className="flex flex-wrap gap-2 text-sm"
		>
			{Array.from({ length: pages }, (_, i) => i + 1).map((n) => {
				const { first, last } = pageRange(n, total)
				return (
					<Link
						key={n}
						to={pagePath(kind, n)}
						prefetch="intent"
						aria-current={n === page ? "page" : undefined}
						aria-label={`Ranks ${first} to ${last}`}
						className={`rounded-md px-3 py-1.5 tabular-nums ${n === page ? "bg-amber-400 font-bold text-black" : "bg-white/[0.06] text-gray-300 ring-1 ring-white/10 hover:bg-white/10"}`}
					>
						{first}–{last}
					</Link>
				)
			})}
		</nav>
	)
}

export function RankedTitles({
	titles,
	first,
	services,
}: {
	titles: ListTitle[]
	first: number
	/** The member's own services per title; null for a guest. */
	services?: RowServices | null
}) {
	const marksOf = useRowMarks()
	return (
		<ol
			start={first}
			className="mx-auto mt-6 grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-x-8 px-4 lg:grid-cols-2"
		>
			{titles.map((t, i) => {
				const marks = marksOf(t.media_type, t.tmdb_id)
				return (
					<li
						key={t.tmdb_id}
						className="border-b border-white/5 hover:bg-white/[0.02]"
					>
						<Link
							to={t.path}
							prefetch="intent"
							className="group flex items-center gap-3 py-1.5 pl-1"
						>
							<span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-gray-500 group-hover:text-amber-300 sm:w-9">
								{first + i}
							</span>
							{t.poster_path ? (
								<TmdbImage
									kind="poster"
									path={t.poster_path}
									width={40}
									priority={i < EAGER_ROWS ? "eager" : "lazy"}
									className="h-12 w-8 shrink-0 rounded-sm bg-white/5 object-cover sm:h-15 sm:w-10"
								/>
							) : (
								<span className="block h-12 w-8 shrink-0 rounded-sm bg-white/10 sm:h-15 sm:w-10" />
							)}
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-semibold text-white sm:text-base">
									<MediaText value={presentedText(t, "title", t.title)} />
								</span>
								<span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
									<RowLogos
										services={
											services?.[createMediaKey(t.media_type, t.tmdb_id)]
										}
									/>
									<span className="truncate">
										{[t.release_year, t.genres.join(", ")]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</span>
							</span>
							<RowScores
								goodwatch={t.goodwatch_overall_score_normalized_percent}
								score={marks.score}
								mark={rowMark(marks)}
							/>
						</Link>
					</li>
				)
			})}
		</ol>
	)
}

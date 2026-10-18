// A page of a best-of list: numbered rows (rank, small poster, title, year and genres, the GoodWatch ring), two columns
// on a wide screen, with the links to the list's pages above and below. Every title is a plain link in the server
// HTML, to the sitemap's address of its page.
import { Link } from "@remix-run/react"
import { type ListKind, pagePath, pageRange } from "~/domain/best-lists"
import type { ListTitle } from "~/server/best-lists.server"
import { TmdbImage } from "~/ui/TmdbImage"
import ScoreRing from "~/ui/details/hero/ScoreRing"
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
}: { titles: ListTitle[]; first: number }) {
	return (
		<ol
			start={first}
			className="mx-auto mt-6 grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-x-8 px-4 lg:grid-cols-2"
		>
			{titles.map((t, i) => (
				<li
					key={t.tmdb_id}
					className="border-b border-white/5 hover:bg-white/[0.02]"
				>
					<Link
						to={t.path}
						prefetch="intent"
						className="group flex items-center gap-3 py-1.5 pl-1"
					>
						<span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-gray-500 group-hover:text-amber-300">
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
							<span className="block truncate text-xs text-gray-500">
								{[t.release_year, t.genres.join(", ")]
									.filter(Boolean)
									.join(" · ")}
							</span>
						</span>
						<ScoreRing media={{ details: t }} size={36} label={false} />
					</Link>
				</li>
			))}
		</ol>
	)
}

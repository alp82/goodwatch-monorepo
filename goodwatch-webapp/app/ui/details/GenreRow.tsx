import { Link } from "@remix-run/react"
import type { GenreRow as GenreRowData } from "~/server/genre-row/genre-row.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { SmallBadgesContext } from "~/ui/title-card/small-badges"
import type { SizeRule } from "~/utils/tmdb-image"

// Four across below the large breakpoint, eight across the content width (at most 1,216 px) from it.
const GENRE_ROW_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "150px"],
	["(min-width: 1024px)", "12vw"],
	[null, "23vw"],
]

export interface GenreRowProps {
	row: GenreRowData
	mediaType: "movie" | "show"
}

/**
 * Eight titles of the genre the breadcrumb shows, "More drama movies", with the heading linking to the genre page. The
 * hub rows' cards, four across and two rows on a phone, one row of eight from the large breakpoint.
 */
export default function GenreRow({ row, mediaType }: GenreRowProps) {
	return (
		<section aria-labelledby="genre-row-title">
			<h2 id="genre-row-title" className="mt-6 text-2xl font-bold">
				<Link to={row.path} className="transition-colors hover:text-amber-400">
					{row.heading}
				</Link>
			</h2>
			<SmallBadgesContext.Provider value={true}>
				<ul className="mt-4 grid grid-cols-4 lg:grid-cols-8 gap-2">
					{row.titles.map((title) => (
						<li key={title.tmdb_id}>
							<MovieTvCard
								details={title}
								mediaType={mediaType}
								posterSizes={GENRE_ROW_POSTER_SIZES}
							/>
						</li>
					))}
				</ul>
			</SmallBadgesContext.Provider>
		</section>
	)
}

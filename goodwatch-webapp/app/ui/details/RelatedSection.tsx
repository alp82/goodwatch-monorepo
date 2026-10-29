// Related titles: the related map, the movie's series (only when there is one), and the genre row.
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useMovieCollection } from "~/routes/api.movie.collection"
import type { GenreRow as GenreRowData } from "~/server/genre-row/genre-row.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import GenreRow from "~/ui/details/GenreRow"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { LIST } from "~/ui/details/page-ui"
import RelatedMap from "~/ui/related-map/RelatedMap"
import { titlePath } from "~/utils/helpers"

type Media = MovieResult | ShowResult

/** The movie's series as a list: poster, title, year, score; the page's own movie marked. Nothing without one. */
function SeriesList({ media }: { media: Media }) {
	const series = media.mediaType === "movie" ? media.movie_series : undefined
	const collectionId = series?.id.toString() ?? ""
	const movieIds = (series?.movie_ids ?? []).map(String).join(",")
	const query = useMovieCollection({ collectionId, movieIds })
	if (!series) return null
	const movies = [...(query.data?.movies ?? [])].sort(
		(a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999),
	)
	if (!movies.length) return null
	const now = new Date().getFullYear()
	return (
		<section aria-labelledby="series-h">
			<h3 id="series-h" className="text-lg font-semibold text-gray-100">
				In this series{" "}
				<span className="text-sm font-normal text-gray-500">
					· {movies.length} films
				</span>
			</h3>
			<ol className={`${LIST} mt-3 max-w-2xl`}>
				{movies.map((m, i) => {
					const here = m.tmdb_id === media.details.tmdb_id
					const upcoming =
						!m.goodwatch_overall_score_normalized_percent &&
						(m.release_year ?? 0) >= now
					const row = (
						<>
							<span className="w-4 shrink-0 text-center text-xs tabular-nums text-gray-500">
								{i + 1}
							</span>
							<TmdbImage
								kind="poster"
								path={m.poster_path}
								width={40}
								alt=""
								className="h-[60px] w-10 shrink-0 rounded-md object-cover ring-1 ring-white/10"
							/>
							<span className="flex min-w-0 flex-1 flex-col">
								<span
									className={`truncate text-[15px] font-semibold ${here ? "text-amber-300" : "text-white"}`}
								>
									{m.title}
								</span>
								<span className="text-xs text-gray-400">
									{m.release_year}
									{here && " · You're here"}
									{upcoming && " · Coming"}
								</span>
							</span>
							{m.goodwatch_overall_score_normalized_percent ? (
								<ScoreRing
									media={{
										details: {
											goodwatch_overall_score_normalized_percent:
												m.goodwatch_overall_score_normalized_percent,
										},
									}}
									size={32}
									label={false}
								/>
							) : null}
							{/* The current row keeps the chevron's room, so the scores line up. */}
							<ChevronRightIcon
								className={`h-4 w-4 shrink-0 text-gray-500 ${here ? "invisible" : ""}`}
								aria-hidden="true"
							/>
						</>
					)
					return (
						<li key={m.tmdb_id}>
							{here ? (
								<div
									aria-current="page"
									className="flex items-center gap-3 border-l-2 border-amber-400 bg-amber-400/[0.05] px-3 py-2.5"
								>
									{row}
								</div>
							) : (
								<Link
									to={titlePath("movie", m.tmdb_id, m.title)}
									prefetch="intent"
									className="flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 hover:bg-white/[0.04]"
								>
									{row}
								</Link>
							)}
						</li>
					)
				})}
			</ol>
		</section>
	)
}

export function RelatedSection({
	media,
	genreRow,
}: { media: Media; genreRow?: GenreRowData }) {
	return (
		<div
			className="flex flex-col gap-12 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-100"
			data-feedback-area="related"
		>
			<RelatedMap media={media} />
			<SeriesList media={media} />
			{genreRow && <GenreRow row={genreRow} mediaType={media.mediaType} />}
		</div>
	)
}

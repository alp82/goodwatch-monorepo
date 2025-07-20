import React from "react"
import MovieSeries from "~/ui/details/MovieSeries"
import type {
	MovieResult,
	MovieSeriesResult,
	ShowResult,
} from "~/server/types/details-types"

export interface SequelsPrequelsFranchiseProps {
	media: MovieResult | ShowResult
}

export default function SequelsPrequelsFranchise({
	media,
}: SequelsPrequelsFranchiseProps) {
	const { details, mediaType } = media

	let movie_series: MovieSeriesResult | undefined
	if (mediaType === "movie") {
		movie_series = media.movie_series
	}

	return (
		<>
			<h2 className="mt-6 text-2xl font-bold">Sequels and Prequels</h2>
			{movie_series ? (
				<MovieSeries movieSeries={movie_series} movieId={details.tmdb_id} />
			) : (
				<div className="my-4 text-gray-400 italic">
					No sequels or prequels available
				</div>
			)}
		</>
	)
}

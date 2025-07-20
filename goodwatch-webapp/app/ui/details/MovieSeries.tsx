import { useFetcher } from "@remix-run/react"
import React, { useEffect } from "react"
import type { MoviesInCollection } from "~/server/collection.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import type { MovieSeriesResult } from "~/server/types/details-types"

export interface MovieSeriesProps {
	movieSeries: MovieSeriesResult
	movieId: number
}

export default function MovieSeries({
	movieSeries,
	movieId,
}: MovieSeriesProps) {
	const collectionId = movieSeries?.id.toString()
	const movieIds = (movieSeries?.movie_ids || [])
		.map((movieId) => movieId.toString())
		.join(",")
	const moviesFetcher = useFetcher<MoviesInCollection>()

	useEffect(() => {
		if (!movieIds) return

		moviesFetcher.submit(
			{ collectionId, movieIds },
			{
				method: "get",
				action: "/api/movie/collection",
			},
		)
	}, [movieIds])

	const movies = moviesFetcher.data?.movies || []
	return (
		<>
			{movieSeries && (
				<div className="mt-8 mb-4">
					<div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
						{movies.map((movie) => {
							return (
								<div
									key={movie.tmdb_id}
									className={
										movie.tmdb_id === movieId
											? "opacity-50 pointer-events-none"
											: ""
									}
								>
									<MovieTvCard
										details={movie}
										mediaType="movie"
										prefetch={true}
									/>
								</div>
							)
						})}
					</div>
				</div>
			)}
		</>
	)
}

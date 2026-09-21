import { useMovieCollection } from "~/routes/api.movie.collection"
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
	const collectionId = movieSeries?.id.toString() || ""
	const movieIds = (movieSeries?.movie_ids || [])
		.map((movieId) => movieId.toString())
		.join(",")
	const moviesQuery = useMovieCollection({ collectionId, movieIds })
	const movies = moviesQuery.data?.movies || []
	return (
		<>
			{movieSeries && (
				<div className="mt-8 mb-4">
					{moviesQuery.isError && (
						<p role="status" className="mb-4 text-sm text-gray-400">
							This collection could not be loaded.{" "}
							<button
								type="button"
								className="underline"
								disabled={moviesQuery.isFetching}
								onClick={() => moviesQuery.refetch()}
							>
								Try again
							</button>
						</p>
					)}
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

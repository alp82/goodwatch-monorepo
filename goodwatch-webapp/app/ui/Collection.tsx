import React, { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { titleToDashed } from "~/utils/helpers";
import type { Collection as CollectionType } from "~/server/details.server";
import type { MoviesInCollection } from "~/server/collection.server";
import { MovieCard } from "~/ui/MovieCard";

export interface CollectionProps {
	collection: CollectionType;
	movieId: number;
}

export default function Collection({ collection, movieId }: CollectionProps) {
	const collectionId = collection?.id.toString();
	const movieIds = (collection?.movie_ids || [])
		.map((movieId) => movieId.toString())
		.join(",");
	const moviesFetcher = useFetcher<MoviesInCollection>();

	useEffect(() => {
		if (!movieIds) return;

		moviesFetcher.submit(
			{ collectionId, movieIds },
			{
				method: "get",
				action: "/api/movie/collection",
			},
		);
	}, [movieIds]);

	const movies = moviesFetcher.data?.movies || [];
	return (
		<>
			{collection && (
				<div className="mt-8 mb-4">
					<div className="mb-2 text-lg font-bold">
						Movies from same collection
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
						{movies.map((movie) => {
							const url = `/movie/${movie.tmdb_id}-${titleToDashed(movie.title)}`;
							return (
								<div
									key={movie.tmdb_id}
									className={
										movie.tmdb_id === movieId
											? "opacity-50 pointer-events-none"
											: ""
									}
								>
									<MovieCard movie={movie} prefetch={true} />
								</div>
							);
						})}
					</div>
				</div>
			)}
		</>
	);
}

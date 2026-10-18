import type { MovieDetails } from "~/server/details.server";
import { cached } from "~/utils/cache";
import { query } from "~/utils/crate";

export interface MoviesInCollection {
	collectionId: string;
	movies: MovieDetails[];
}

export interface MovieCollectionParams {
	collectionId: string;
	movieIds: string;
}

export const getMoviesInCollection = async (params: MovieCollectionParams) => {
	return await cached<MovieCollectionParams, MoviesInCollection>({
		// The name is part of the cache key: v2 values carry the release year.
		name: "movie-collection-v2",
		target: _getMoviesInCollection,
		params,
		ttlMinutes: 60 * 24,
	});
};

export async function _getMoviesInCollection({
	collectionId,
	movieIds,
}: MovieCollectionParams): Promise<MoviesInCollection> {
	const movieIdsArray = movieIds.split(",").map(id => parseInt(id.trim()));
	const collectionQuery = `
    SELECT tmdb_id, title, release_year, poster_path, goodwatch_overall_score_normalized_percent
    FROM movie
    WHERE tmdb_id IN (${movieIdsArray.map(() => '?').join(', ')})
    ORDER BY release_date ASC
  `;
	const result = await query(collectionQuery, movieIdsArray);
	if (!result.length)
		throw Error(`movie collection with ID "${collectionId}" has no movies`);

	const movies = result as MovieDetails[];
	return {
		collectionId,
		movies,
	};
}

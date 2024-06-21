import { cached } from "~/utils/cache";
import { executeQuery } from "~/utils/postgres";
import type { MovieDetails } from "~/server/details.server";

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
		name: "movie-collection",
		target: _getMoviesInCollection,
		params,
		ttlMinutes: 60 * 24,
	});
};

export async function _getMoviesInCollection({
	collectionId,
	movieIds,
}: MovieCollectionParams): Promise<MoviesInCollection> {
	const collectionQuery = `
    SELECT tmdb_id, title, poster_path, aggregated_overall_score_normalized_percent
    FROM movies
    WHERE tmdb_id = ANY($1::int[])
    ORDER BY release_date ASC
  `;
	const result = await executeQuery(collectionQuery, [movieIds.split(",")]);
	if (!result.rows.length)
		throw Error(`movie collection with ID "${collectionId}" has no movies`);

	const movies = result.rows as MovieDetails[];
	return {
		collectionId,
		movies,
	};
}

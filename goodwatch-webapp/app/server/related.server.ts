import { cached } from "~/utils/cache"
import { query as crateQuery } from "~/utils/crate"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"

export interface RelatedMovie extends AllRatings {
	tmdb_id: number
	title: string
	release_year: string
	poster_path: string
	fingerprint_score: number
	ann_score: number
	score: number
}

export interface RelatedShow extends AllRatings {
	tmdb_id: number
	title: string
	release_year: string
	poster_path: string
	fingerprint_score: number
	ann_score: number
	score: number
}

export interface RelatedMovieParams {
	tmdb_id: number
	fingerprint_key: string
	source_media_type: "movie" | "show"
}

export interface RelatedShowParams {
	tmdb_id: number
	fingerprint_key: string
	source_media_type: "movie" | "show"
}

export const getRelatedMovies = async (params: RelatedMovieParams) => {
	return await cached({
		name: "related-movie",
		target: _getRelatedMovies as any,
		params,
		ttlMinutes: 60 * 24,
		// ttlMinutes: 0,
	}) as unknown as RelatedMovie[]
}

export const getRelatedShows = async (params: RelatedShowParams) => {
	return await cached({
		name: "related-show",
		target: _getRelatedShows as any,
		params,
		ttlMinutes: 60 * 24,
		// ttlMinutes: 0,
	}) as unknown as RelatedShow[]
}

async function _getRelatedMovies({
	tmdb_id,
	fingerprint_key,
	source_media_type,
}: RelatedMovieParams): Promise<RelatedMovie[]> {
	const sourceTable = source_media_type === "movie" ? "movie" : "show"
	
	const result = await crateQuery<RelatedMovie>(`
		SELECT
			tmdb_id,
			title,
			release_year,
			poster_path,
			fingerprint_scores['${fingerprint_key}'] AS fingerprint_score,
			_score AS ann_score,
			(_score + 0.1 * (1.0 / (1.0 + POWER(ABS(COALESCE(fingerprint_scores['${fingerprint_key}'], 0) - (
				SELECT fingerprint_scores['${fingerprint_key}'] 
				FROM ${sourceTable} 
				WHERE tmdb_id = $1
			)) / 2.5281, 2.3691)))) AS score,
			${getRatingKeys().join(", ")}
		FROM movie
		WHERE tmdb_id <> $1
			AND goodwatch_overall_score_voting_count >= 5000
			AND goodwatch_overall_score_normalized_percent >= 50
			AND poster_path IS NOT NULL
			AND KNN_MATCH(
				vector_fingerprint,
				(SELECT vector_fingerprint FROM ${sourceTable} WHERE tmdb_id = $1),
				10000
			)
		ORDER BY score DESC
		LIMIT 50
	`, [tmdb_id])

	return result
}

async function _getRelatedShows({
	tmdb_id,
	fingerprint_key,
	source_media_type,
}: RelatedShowParams): Promise<RelatedShow[]> {
	const sourceTable = source_media_type === "movie" ? "movie" : "show"
	
	const result = await crateQuery<RelatedShow>(`
		SELECT
			tmdb_id,
			title,
			release_year,
			poster_path,
			fingerprint_scores['${fingerprint_key}'] AS fingerprint_score,
			_score AS ann_score,
			(_score + 0.1 * (1.0 / (1.0 + POWER(ABS(COALESCE(fingerprint_scores['${fingerprint_key}'], 0) - (
				SELECT fingerprint_scores['${fingerprint_key}'] 
				FROM ${sourceTable} 
				WHERE tmdb_id = $1
			)) / 2.5281, 2.3691)))) AS score,
			${getRatingKeys().join(", ")}
		FROM show
		WHERE tmdb_id <> $1
			AND goodwatch_overall_score_voting_count >= 5000
			AND goodwatch_overall_score_normalized_percent >= 50
			AND poster_path IS NOT NULL
			AND KNN_MATCH(
				vector_fingerprint,
				(SELECT vector_fingerprint FROM ${sourceTable} WHERE tmdb_id = $1),
				10000
			)
		ORDER BY score DESC
		LIMIT 50
	`, [tmdb_id])

	return result
}

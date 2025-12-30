import type { WithSimilar } from "~/routes/api.similar-media";
import { cached } from "~/utils/cache";
import { query } from "~/utils/crate";
import { type AllRatings, getRatingKeys } from "~/utils/ratings";

const LIMIT_PER_SEARCH = 100;

export interface SimilarMedia extends AllRatings {
	tmdb_id: number;
	media_type: "movie" | "show";
	title: string;
	release_year: string;
	popularity: number;
	poster_path: string;
	backdrop_path: string;
}

export interface SimilarMovie extends SimilarMedia {}

export interface SimilarTV extends SimilarMedia {}

export type SimilarResult = SimilarMovie | SimilarTV;


export type SimilarMediaResult = {
	movies: SimilarMovie[];
	shows: SimilarTV[];
};

export interface SimilarMediaParams {
	searchTerm: string;
	withSimilarJson: string;
}

export const getSimilarMedia = async (params: SimilarMediaParams) => {
	return await cached<SimilarMediaParams, SimilarMediaResult>({
		name: "similar-media",
		target: _getSimilarMedia,
		params,
		// ttlMinutes: 60 * 24,
		ttlMinutes: 0,
	});
};

async function _getSimilarMedia({
	searchTerm,
	withSimilarJson,
}: SimilarMediaParams): Promise<SimilarMediaResult> {
	const withSimilar = JSON.parse(withSimilarJson);

	const movies = await _getSearchResults({
		tableName: "movie",
		searchTerm,
		withSimilar,
	});
	const shows = await _getSearchResults({
		tableName: "show",
		searchTerm,
		withSimilar,
	});

	return {
		movies,
		shows,
	};
}

interface CombinedResultProps {
	tableName: "movie" | "show";
	searchTerm: string;
	withSimilar: WithSimilar[];
}

const _getSearchResults = async <T extends SimilarResult>({
	tableName,
	searchTerm,
	withSimilar,
}: CombinedResultProps) => {
	const mediaType = tableName === "movie" ? "movie" : "show";

	const selectedSimilarForMediaType = withSimilar.filter(
		(similar) => similar.mediaType === mediaType,
	);
	const selectedSimilarCondition = selectedSimilarForMediaType
		.map((similar) => {
			return `m.tmdb_id = ${similar.tmdbId}`;
		})
		.join(" OR ");

	let searchWhereConditions = "";
	const searchParams: string[] = [];

	if (searchTerm) {
		const words = searchTerm.split(" ").filter(Boolean);
		
		// Build search conditions for each word
		const wordConditions = words
			.map(() => {
				searchParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
				return `(m.title ILIKE ? OR m.original_title ILIKE ?)`;
			})
			.join(" OR ");

		// Also add individual word matching for better partial matches
		const individualWordConditions = words
			.map((word) => {
				searchParams.push(`%${word}%`, `%${word}%`);
				return `(m.title ILIKE ? OR m.original_title ILIKE ?)`;
			})
			.join(" AND ");

		searchWhereConditions = `(${wordConditions}) OR (${individualWordConditions})`;
	}

	// CrateDB doesn't support UNION with CTEs in subqueries, so we'll use a simpler approach
	const searchQuery = `
		SELECT
			m.tmdb_id,
			'${mediaType}' as media_type,
			m.title,
			m.original_title,
			m.release_year,
			m.popularity,
			m.poster_path,
			m.backdrop_path,
			${getRatingKeys()
				.map((key) => `m.${key}`)
				.join(", ")},
			CASE
				WHEN ${selectedSimilarCondition || "FALSE"} THEN 10000.0
				WHEN ${searchTerm ? `(m.title ILIKE ? OR m.original_title ILIKE ?)` : "FALSE"} THEN 5000.0 + m.popularity
				ELSE m.popularity
			END AS relevance
		FROM
			${tableName} as m
		WHERE
			m.title IS NOT NULL
			AND m.poster_path IS NOT NULL
			AND (
				${selectedSimilarCondition ? `(${selectedSimilarCondition})` : "FALSE"}
				${searchTerm ? `OR (${searchWhereConditions})` : ""}
			)
		ORDER BY
			relevance DESC,
			m.goodwatch_overall_score_voting_count DESC
		LIMIT ${LIMIT_PER_SEARCH}
  `;

	// Add params for the relevance scoring (starts with search term)
	if (searchTerm) {
		searchParams.push(`${searchTerm}%`, `${searchTerm}%`);
	}
	const searchRows = await query<T>(searchQuery, searchParams);

	return searchRows;
};

import type { WithSimilar } from "~/routes/api.similar-media"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"
import { type AllRatings, getRatingKeys } from "~/utils/ratings"

const LIMIT_PER_SEARCH = 30

export interface SimilarMedia extends AllRatings {
	tmdb_id: number
	media_type: "movie" | "tv"
	title: string
	release_year: string
	popularity: number
	poster_path: string
	backdrop_path: string
}

export interface SimilarMovie extends SimilarMedia {}

export interface SimilarTV extends SimilarMedia {}

export type SimilarResult = SimilarMovie | SimilarTV

export type SimilarMediaResult = {
	movies: SimilarMovie[]
	tv: SimilarTV[]
}

export interface SimilarMediaParams {
	searchTerm: string
	withSimilarJson: string
}

export const getSimilarMedia = async (params: SimilarMediaParams) => {
	return await cached<SimilarMediaParams, SimilarMediaResult>({
		name: "similar-media",
		target: _getSimilarMedia,
		params,
		ttlMinutes: 60 * 24,
		// ttlMinutes: 0,
	})
}

async function _getSimilarMedia({
	searchTerm,
	withSimilarJson,
}: SimilarMediaParams): Promise<SimilarMediaResult> {
	const withSimilar = JSON.parse(withSimilarJson)

	const movies = await _getSearchResults({
		tableName: "movies",
		searchTerm,
		withSimilar,
	})
	const tv = await _getSearchResults({
		tableName: "tv",
		searchTerm,
		withSimilar,
	})

	return {
		movies,
		tv,
	}
}

interface CombinedResultProps {
	tableName: "movies" | "tv"
	searchTerm: string
	withSimilar: WithSimilar[]
}

const _getSearchResults = async <T extends SimilarResult>({
	tableName,
	searchTerm,
	withSimilar,
}: CombinedResultProps) => {
	const mediaType = tableName === "movies" ? "movie" : "tv"

	const exactMatchCondition = searchTerm
		? `
		m.title ILIKE $1
		OR m.original_title ILIKE $1
		OR m.alternative_titles_text ILIKE $1
	`
		: ""
	const words = searchTerm.split(" ").filter(Boolean)
	const wordConditions = words
		.map(
			(_, index) => `
				m.title ILIKE $${index + 2}
				OR m.original_title ILIKE $${index + 2}
				OR m.alternative_titles_text ILIKE $${index + 2}
			`,
		)
		.join(" OR ")

	const selectedSimilarForMediaType = withSimilar.filter(
		(similar) => similar.mediaType === mediaType,
	)
	const selectedSimilarCondition = selectedSimilarForMediaType
		.map((similar) => {
			return `
			m.tmdb_id = ${similar.tmdbId}
		`
		})
		.join(" OR ")

	const searchWhereConditions = `
		${searchTerm ? `(${exactMatchCondition})` : "TRUE"}
		OR (${wordConditions || "TRUE"})
	`

	const searchQuery = `
		(
			SELECT
				m.tmdb_id,
				'${mediaType}' as media_type,
				m.title,
				m.release_year,
				m.popularity,
				m.poster_path,
				m.backdrop_path,
				${getRatingKeys()
					.map((key) => `m.${key}`)
					.join(", ")},
				1000 AS relevance
			FROM
				${tableName} as m
			WHERE
				${selectedSimilarCondition || "FALSE"}
		)
		UNION
		(
			WITH ranked_media AS (
				SELECT
					m.tmdb_id,
					'${mediaType}' as media_type,
					m.title,
					m.release_year,
					m.popularity,
					m.poster_path,
					m.backdrop_path,
					${getRatingKeys()
						.map((key) => `m.${key}`)
						.join(", ")},
					${
						searchTerm
							? `
								ts_rank_cd(
									setweight(to_tsvector(m.title), 'A') ||
									setweight(to_tsvector(m.original_title), 'B') ||
									setweight(to_tsvector(m.alternative_titles_text), 'C'),
									plainto_tsquery($1)
								) +
							`
							: ""
					}
					(m.popularity / 1000)
					AS relevance
				FROM
					${tableName} as m
				JOIN
					vectors_media as vm ON vm.tmdb_id = m.tmdb_id AND vm.media_type = '${mediaType}' 
				WHERE
					(${searchWhereConditions})
					${selectedSimilarCondition ? `AND m.tmdb_id NOT IN (${selectedSimilarForMediaType.map((similar) => similar.tmdbId).join(", ")})` : ""}
			)
			SELECT *
			FROM ranked_media
			ORDER BY
				relevance DESC NULLS LAST,
				aggregated_overall_score_voting_count DESC
			LIMIT ${LIMIT_PER_SEARCH - selectedSimilarForMediaType.length}
		)
		LIMIT ${LIMIT_PER_SEARCH};
  `

	// search query - only if search term was provided

	const searchParams = [
		...(searchTerm ? [`%${searchTerm}%`] : []),
		...words.map((word) => `%${word}%`),
	]
	const searchResult = await executeQuery<T>(searchQuery, searchParams)
	const searchRows: T[] = searchResult.rows

	return searchRows
}

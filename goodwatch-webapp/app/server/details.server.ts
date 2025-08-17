import {
	increasePriorityForMovies,
	// increasePriorityForTVs, // TODO: Update to use 'show' instead of 'tv'
} from "~/server/utils/priority"
import { cached } from "~/utils/cache"
import { getRatingKeys } from "~/utils/ratings"
import {
	duplicateProviderMapping,
	duplicateProviders,
} from "~/utils/streaming-links"
import { query } from "~/utils/crate"
import {
	buildFingerprint,
	type DNAAnalysis,
	type FingerprintResult,
} from "~/server/utils/fingerprint"
import {
	type MovieDetails,
	type ShowDetails,
	type DetailsMovieParams,
	type DetailsShowParams,
	getFieldsByMediaType,
	generateMediaFieldAssignments,
	type QueryResult,
	type MovieQueryResult,
	type ShowQueryResult,
	type RawMediaResult,
	type ShowResult,
	type MovieResult,
} from "~/server/types/details-types"

export const getDetailsForMovie = async (params: DetailsMovieParams) => {
	return await cached<DetailsMovieParams, MovieResult>({
		name: "details-movie",
		target: _getDetailsForMovie,
		params,
		ttlMinutes: 30,
		// ttlMinutes: 0,
	})
}

export const getDetailsForShow = async (params: DetailsShowParams) => {
	return await cached<DetailsShowParams, ShowResult>({
		name: "details-show",
		target: _getDetailsForShow,
		params,
		ttlMinutes: 30,
		// ttlMinutes: 0,
	})
}

const _getDetailsForMovie = async ({
	movieId,
	country,
	language,
}: DetailsMovieParams): Promise<MovieResult> => {
	const mediaType = "movie"
	const result = (await _fetchFromDB(
		mediaType,
		movieId,
		country,
		language,
	)) as MovieQueryResult

	const fingerprint = _processFingerprint(result)

	return {
		...result,
		mediaType,
		fingerprint,
	}
}

const _getDetailsForShow = async ({
	showId,
	country,
	language,
}: DetailsShowParams): Promise<ShowResult> => {
	const mediaType = "show"
	const result = (await _fetchFromDB(
		mediaType,
		showId,
		country,
		language,
	)) as ShowQueryResult
	const fingerprint = _processFingerprint(result)

	return {
		...result,
		mediaType,
		fingerprint,
	}
}

const _fetchFromDB = async (
	mediaType: "movie" | "show",
	mediaId: string,
	country: string,
	language: string,
): Promise<QueryResult> => {
	const mediaTable = mediaType === "movie" ? "movie" : "show"
	const fields = getFieldsByMediaType(mediaType).join(", ")
	const mediaFieldAssignments = generateMediaFieldAssignments(mediaType)

	const result = (await query(`
		WITH
				params_media_tmdb_id AS (SELECT ${mediaId} AS val),
				params_media_type AS (SELECT '${mediaType}' AS val),
				params_country_code AS (SELECT '${country}' AS val),

				-- main movie/show entity
				media_data AS (
						SELECT ${fields} FROM ${mediaTable} WHERE tmdb_id = (SELECT val FROM params_media_tmdb_id) LIMIT 1
				),

				${
					mediaType === "movie"
						? `movie_series AS (
								SELECT {
										id = ms.tmdb_id,
										name = ms.name,
										poster_path = ms.poster_path,
										backdrop_path = ms.backdrop_path,
										movie_ids = (
												SELECT array_agg(m.tmdb_id)
												FROM movie m
												WHERE m.movie_series_id = ms.tmdb_id
										)
								} AS val
								FROM movie_series ms
								WHERE ms.tmdb_id = (SELECT movie_series_id FROM media_data)
								LIMIT 1
						),`
						: ""
				}		
						    
				${
					mediaType === "show"
						? `seasons AS (
								SELECT {
										id = s.tmdb_id,
										name = s.name,
										season_number = s.season_number,
										air_date = s.air_date,
										episode_count = s.episode_count,
										overview = s.overview,
										poster_path = s.poster_path,
										vote_average = s.vote_average
								} AS val
								FROM season s
								WHERE s.show_id = (SELECT tmdb_id FROM media_data) 
								ORDER BY s.air_date ASC
						),`
						: ""
				}

				-- translations
				alternative_titles AS (
						SELECT array_agg(obj) AS val
						FROM (
								SELECT {country_code = country_code, title = title} AS obj
								FROM alternative_title
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND country_code = (SELECT val FROM params_country_code)
								GROUP BY 1 -- Group by the object itself to use raw values
						) AS sub
				),
		
				translations AS (
						SELECT array_agg(obj) AS val
						FROM (
								SELECT {
										language_code = language_code,
										country_code = country_code,
										title = title,
										overview = overview,
										tagline = tagline,
										homepage = homepage,
										runtime = runtime
								} AS obj
								FROM translation
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND country_code = (SELECT val FROM params_country_code)
								GROUP BY 1
						) AS sub
				),

				-- releases & age ratings
				releases AS (
						SELECT array_agg(obj) AS val
						FROM (
								SELECT {
										country_code = country_code,
										release_type = release_type,
										release_date = release_date,
										certification = certification,
										note = note,
										descriptors = descriptors
								} AS obj
								FROM release_event
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND country_code = (SELECT val FROM params_country_code)
								GROUP BY 1
						) AS sub
				),

				release_certifications AS (
					SELECT array_agg(certification) AS certs
					FROM (
								 SELECT certification
								 FROM release_event
								 WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									 AND media_type = (SELECT val FROM params_media_type)
									 AND country_code = (SELECT val FROM params_country_code)
									 AND certification IS NOT NULL
								 GROUP BY certification
							 ) as sub
				),

				age_certifications AS (
					SELECT array_agg(obj) AS val
					FROM (
								 SELECT {
									 certification_code = certification_code,
									 meaning = meaning,
									 order_default = order_default
									 } AS obj
								 FROM age_certification
								 WHERE media_type = (SELECT val FROM params_media_type)
									 AND country_code = (SELECT val FROM params_country_code)
									 AND certification_code = ANY((SELECT certs FROM release_certifications))
								 GROUP BY 1
							 ) AS sub
				),

				-- Streaming
				streaming_availabilities AS (
						SELECT array_agg(obj) AS val
						FROM (
								SELECT {
										streaming_service_id = streaming_service_id,
										streaming_type = streaming_type,
										tmdb_link = tmdb_link,
										stream_url = stream_url,
										price_dollar = price_dollar,
										quality = quality
								} AS obj
								FROM streaming_availability
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND country_code = (SELECT val FROM params_country_code)
								GROUP BY 1
						) AS sub
				),
		
				streaming_service_ids AS (
						SELECT array_agg(streaming_service_id) AS ids
						FROM (
								SELECT DISTINCT streaming_service_id
								FROM streaming_availability
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND country_code = (SELECT val FROM params_country_code)
						) as sub
				),
		
				streaming_services AS (
						SELECT array_agg(obj) AS val
						FROM (
								SELECT {
										tmdb_id = tmdb_id,
										name = name,
										logo = logo_path,
										order_default = subscript(order_by_country, (SELECT val FROM params_country_code))
								} AS obj
								FROM streaming_service
								WHERE tmdb_id = ANY((SELECT ids FROM streaming_service_ids))
								GROUP BY 1
						) AS sub
				),

				-- Actor and crew fetching
				appeared_in_data AS (
						SELECT person_tmdb_id, credit_id, character, order_default, episode_count_character, episode_count_total
						FROM person_appeared_in
						WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
							AND media_type = (SELECT val FROM params_media_type)
				),
				worked_on_data AS (
						SELECT person_tmdb_id, credit_id, job, department, episode_count_job, episode_count_total
						FROM person_worked_on
						WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
							AND media_type = (SELECT val FROM params_media_type)
				),
				person_ids AS (
						SELECT array_agg(person_tmdb_id) as ids FROM (
								SELECT person_tmdb_id FROM appeared_in_data
								UNION ALL
								SELECT person_tmdb_id FROM worked_on_data
						) as sub
				),
				people_data AS (
						SELECT tmdb_id, name, popularity, profile_path
						FROM person
						WHERE tmdb_id = ANY((SELECT ids FROM person_ids))
				),

				actors AS (
						SELECT array_agg(obj) AS val
						FROM (
								SELECT
										{
												id = p.tmdb_id,
												credit_id = pa.credit_id,
												name = p.name,
												character = pa.character,
												popularity = p.popularity,
												profile_path = p.profile_path,
												order_default = pa.order_default,
												episode_count_character = pa.episode_count_character,
												episode_count_total = pa.episode_count_total
										} AS obj,
										pa.order_default
								FROM appeared_in_data pa
								JOIN people_data p ON pa.person_tmdb_id = p.tmdb_id
								GROUP BY obj, pa.order_default
								ORDER BY pa.order_default ASC
						) as sub
				),
						    
				crew AS (
						SELECT array_agg(obj) AS val
						FROM (
								SELECT
										{	
												id = p.tmdb_id,
												credit_id = pw.credit_id,
												name = p.name,
												job = pw.job,
												department = pw.department,
												popularity = p.popularity,
												episode_count_job = pw.episode_count_job,
												episode_count_total = pw.episode_count_total
										} AS obj,
						    		p.popularity
								FROM worked_on_data pw
								JOIN people_data p ON pw.person_tmdb_id = p.tmdb_id
								GROUP BY obj, p.popularity
								ORDER BY p.popularity DESC
						) as sub
				),
						    
				-- images & videos
				logos AS (
						SELECT array_agg(obj) as val
						FROM (
								SELECT {
										width = width,
										height = height,
										file_path = url_path,
										iso_639_1 = language_code,
										vote_count = tmdb_vote_count,
										aspect_ratio = aspect_ratio,
										vote_average = tmdb_vote_average
								} AS obj
								FROM media_image
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND image_type = 'logos'
								GROUP BY 1
						) as sub
				),
				posters AS (
						SELECT array_agg(obj) as val
						FROM (
								SELECT {
										width = width,
										height = height,
										file_path = url_path,
										iso_639_1 = language_code,
										vote_count = tmdb_vote_count,
										aspect_ratio = aspect_ratio,
										vote_average = tmdb_vote_average
								} AS obj
								FROM media_image
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND image_type = 'posters'
								GROUP BY 1
						) as sub
				),
				backdrops AS (
						SELECT array_agg(obj) as val
						FROM (
								SELECT {
										width = width,
										height = height,
										file_path = url_path,
										vote_count = tmdb_vote_count,
										aspect_ratio = aspect_ratio,
										vote_average = tmdb_vote_average
								} AS obj
								FROM media_image
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND image_type = 'backdrops'
								GROUP BY 1
						) as sub
				),
				images AS (
						SELECT {
								logos = (SELECT val FROM logos),
								posters = (SELECT val FROM posters),
								backdrops = (SELECT val FROM backdrops)
						} as val
				),
		
				clips AS (
						SELECT array_agg(obj) as val
						FROM (
								SELECT {
										id = tmdb_id,
										key = site_key,
										name = name,
										site = site,
										size = size,
										type = video_type,
										official = official,
										iso_639_1 = language_code,
										iso_3166_1 = country_code,
										published_at = published_at
								} AS obj
								FROM media_video
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND video_type = 'Clip'
								GROUP BY 1
						) as sub
				),
				trailers AS (
						SELECT array_agg(obj) as val
						FROM (
								SELECT {
										id = tmdb_id,
										key = site_key,
										name = name,
										site = site,
										size = size,
										type = video_type,
										official = official,
										iso_639_1 = language_code,
										iso_3166_1 = country_code,
										published_at = published_at
								} AS obj
								FROM media_video
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND video_type = 'Trailer'
								GROUP BY 1
						) as sub
				),
				featurettes AS (
						SELECT array_agg(obj) as val
						FROM (
								SELECT {
										id = tmdb_id,
										key = site_key,
										name = name,
										site = site,
										size = size,
										type = video_type,
										official = official,
										iso_639_1 = language_code,
										iso_3166_1 = country_code,
										published_at = published_at
								} AS obj
								FROM media_video
								WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
									AND media_type = (SELECT val FROM params_media_type)
									AND video_type = 'Featurette'
								GROUP BY 1
						) as sub
				),
				videos AS (
						SELECT {
								clips = (SELECT val FROM clips),
								trailers = (SELECT val FROM trailers),
								featurettes = (SELECT val FROM featurettes)
						} as val
				)
		
		-- final result
		SELECT {
				details = {
						${mediaFieldAssignments}
				},
				${mediaType === "movie" ? "movie_series = (SELECT val FROM movie_series)," : ""}
				${mediaType === "show" ? "seasons = ARRAY(SELECT val FROM seasons)," : ""}
				alternative_titles = (SELECT val FROM alternative_titles),
				translations = (SELECT val FROM translations),
				releases = (SELECT val FROM releases),
				age_certifications = (SELECT val FROM age_certifications),
				streaming_availabilities = (SELECT val FROM streaming_availabilities),
				streaming_services = (SELECT val FROM streaming_services),
		    actors = (SELECT val FROM actors),
				crew = (SELECT val FROM crew),
				images = (SELECT val FROM images),
				videos = (SELECT val FROM videos)
		} AS media
		FROM media_data m;
	`)) as { media: QueryResult }[]

	return result[0].media
}

// Internal function to process fingerprint data
function _processFingerprint(result: QueryResult): FingerprintResult | null {
	const {
		content_advisories,
		context_is_background_friendly,
		context_is_binge_friendly,
		context_is_comfort_watch,
		context_is_drop_in_friendly,
		context_is_pure_escapism,
		context_is_thought_provoking,
		essence_tags,
		essence_text,
		fingerprint_scores,
		fingerprint_highlight_keys,
		suitability_adults,
		suitability_date_night,
		suitability_family,
		suitability_friends,
		suitability_group_party,
		suitability_intergenerational,
		suitability_kids,
		suitability_partner,
		suitability_public_viewing_safe,
		suitability_solo_watch,
		suitability_teens,
		...rawMedia
	} = result.details as RawMediaResult

	if (!fingerprint_scores) {
		return null
	}

	const dnaAnalysis: DNAAnalysis = {
		genres: rawMedia.genres,
		essenceTags: essence_tags,
		essenceText: essence_text,
		scores: fingerprint_scores,
		content_advisories,
		context_is_background_friendly,
		context_is_binge_friendly,
		context_is_comfort_watch,
		context_is_drop_in_friendly,
		context_is_pure_escapism,
		context_is_thought_provoking,
		suitability_adults,
		suitability_date_night,
		suitability_family,
		suitability_friends,
		suitability_group_party,
		suitability_intergenerational,
		suitability_kids,
		suitability_partner,
		suitability_public_viewing_safe,
		suitability_solo_watch,
		suitability_teens,
	}

	return buildFingerprint(dnaAnalysis)
}

import { CREW_ROLES } from "~/ui/details/crew-roles"
import { query } from "~/utils/crate"
import { CAST_DOCUMENT_SIZE } from "~/utils/title-cast"
import { castRowsCTEs, selectedCastRows } from "./title-cast-sql"
import { createTitleDetailsGetters } from "./title-details-cache"
import {
	generateMediaFieldAssignments,
	getFieldsByMediaType,
} from "./title-details-fields"
import type { RawTitleDetails } from "./title-details-shape"
export {
	DETAILS_MISSING_CACHE_NAME,
	DETAILS_MISSING_TTL_SECONDS,
	DETAILS_MOVIE_CACHE_NAME,
	DETAILS_SHOW_CACHE_NAME,
	DETAILS_TTL_MINUTES,
	DETAILS_STALE_MINUTES,
} from "./title-details-cache"

const creditedCrew = (job: string, limit: number) =>
	`ARRAY(SELECT {id = id, name = name} FROM crew_rows WHERE job = '${job}' ORDER BY popularity DESC LIMIT ${limit})`

const _fetchFromDB = async (
	mediaType: "movie" | "show",
	mediaId: string,
	country: string,
	_language: string,
): Promise<RawTitleDetails | null> => {
	// mediaId and country are interpolated into the SQL below, so only safe shapes may pass.
	if (!/^\d+$/.test(mediaId)) return null
	const safeCountry = /^[A-Za-z]{2}$/.test(country) ? country : ""

	const mediaTable = mediaType === "movie" ? "movie" : "show"
	const fields = getFieldsByMediaType(mediaType).join(", ")
	const mediaFieldAssignments = generateMediaFieldAssignments(mediaType)

	const result = (await query(`
		WITH
				params_media_tmdb_id AS (SELECT ${mediaId} AS val),
				params_media_type AS (SELECT '${mediaType}' AS val),
				params_country_code AS (SELECT '${safeCountry}' AS val),

				-- main movie/show entity
				media_data AS (
						SELECT ${fields} FROM ${mediaTable} WHERE tmdb_id = (SELECT val FROM params_media_tmdb_id) LIMIT 1
				),

				${
					mediaType === "movie"
						? `movie_series AS (
								SELECT {
										id = ms.tmdb_id,
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
										season_number = s.season_number,
										episode_count = s.episode_count
								} AS val
								FROM season s
								WHERE s.show_id = (SELECT tmdb_id FROM media_data) 
								ORDER BY s.air_date ASC
						),`
						: ""
				}

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
						SELECT person_tmdb_id, character, order_default
						FROM person_appeared_in
						WHERE media_tmdb_id = (SELECT val FROM params_media_tmdb_id)
							AND media_type = (SELECT val FROM params_media_type)
				),
				worked_on_data AS (
						SELECT person_tmdb_id, credit_id, job, department, episode_count_total
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

                ${castRowsCTEs},
                top_cast AS (SELECT array_agg(id) AS ids FROM (SELECT id FROM cast_people ORDER BY ord ASC, id ASC LIMIT ${CAST_DOCUMENT_SIZE}) AS t),
                crew_rows AS (
                  SELECT p.tmdb_id AS id, pw.credit_id AS credit_id, p.name AS name, pw.job AS job, pw.department AS department, p.popularity AS popularity, pw.episode_count_total AS episode_count_total
                  FROM worked_on_data pw JOIN people_data p ON pw.person_tmdb_id = p.tmdb_id
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
				streaming_availabilities = (SELECT val FROM streaming_availabilities),
				streaming_services = (SELECT val FROM streaming_services),
				cast_total = (SELECT count(*) FROM cast_people),
                cast_lead_rows = ARRAY(SELECT {id = id, name = name} FROM cast_rows ORDER BY order_default ASC, id ASC LIMIT 5),
                cast_rows = ${selectedCastRows("top_cast")},
                crew = {${Object.entries(CREW_ROLES)
									.map(
										([key, role]) =>
											`${key} = ARRAY(SELECT {id = id, credit_id = credit_id, name = name} FROM crew_rows WHERE job = '${role.job}' OR department = '${role.department}' ORDER BY episode_count_total DESC NULLS LAST, popularity DESC NULLS LAST, credit_id ASC LIMIT 3)`,
									)
									.join(",")}},
                credits = {
                  directors = ${creditedCrew("Director", 5)},
                  composers = ${creditedCrew("Original Music Composer", 5)},
                  executive_producers = ${creditedCrew("Executive Producer", 3)}
                },
                images = (SELECT val FROM images),
				videos = (SELECT val FROM videos)
		} AS media
		FROM media_data m;
	`)) as { media: RawTitleDetails }[]

	if (!result[0]) return null
	const { media } = result[0]
	if (!media.details.title) {
		media.details.title = media.details.original_title || ""
	}
	if (!media.details.genres) {
		media.details.genres = []
	}
	return media
}

export const { getDetailsForMovie, getDetailsForShow } =
	createTitleDetailsGetters(_fetchFromDB)

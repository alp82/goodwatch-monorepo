import type { FilterMediaType } from "~/server/search.server"
import { getRatingKeys } from "~/utils/ratings"
import { ignoredProviders } from "~/utils/streaming-links"

export const getSelectField = (type: FilterMediaType, column: string) =>
	type === "all"
		? `COALESCE(m.${column}, t.${column}) AS ${column}`
		: `${type === "movies" ? `m.${column}` : `t.${column}`} AS ${column}`

export const getSelectFieldsForType = (
	type: FilterMediaType,
	columns: string[],
) => columns.map((column) => getSelectField(type, column)).join(",\n")

export const getMediaType = (type: FilterMediaType) =>
	type === "all"
		? `
        CASE
          WHEN m.tmdb_id IS NOT NULL THEN 'movie'
          WHEN t.tmdb_id IS NOT NULL THEN 'tv'
          ELSE NULL
        END
      `
		: `'${type === "movies" ? "movie" : "tv"}'`

export const getStreamingLinksForType = (
	type: FilterMediaType,
	streamingProviderIds?: number[],
) =>
	`(
    SELECT json_agg(json_build_object(
      'provider_id', spl.provider_id,
      'provider_name', sp.name,
      'provider_logo_path', sp.logo_path,
      'media_type', spl.media_type,
      'country_code', spl.country_code,
      'stream_type', spl.stream_type
    )) as streams
    FROM streaming_provider_links spl
    INNER JOIN streaming_providers sp ON sp.id = spl.provider_id
    WHERE spl.tmdb_id = ${type === "all" ? "COALESCE(m.tmdb_id, t.tmdb_id)" : `${type === "movies" ? "m.tmdb_id" : "t.tmdb_id"}`}
      AND spl.media_type = ${getMediaType(type)}
      AND spl.country_code = $1
      AND (spl.stream_type = 'flatrate' OR spl.stream_type = 'free')
      ${streamingProviderIds ? `AND spl.provider_id IN (${streamingProviderIds.join(",")})` : ""}
      AND spl.provider_id NOT IN (${ignoredProviders.join(",")})
  ) AS streaming_links`

export const getRatingFieldsForType = (type: FilterMediaType) =>
	getRatingKeys()
		.map((key) =>
			type === "all"
				? `COALESCE(m.${key}, t.${key}) AS ${key}`
				: `${type === "movies" ? `m.${key}` : `t.${key}`} AS ${key}`,
		)
		.join(", ")

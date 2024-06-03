import { Score } from '~/server/scores.server'
import { executeQuery } from '~/utils/postgres'
import { cached, resetCache } from '~/utils/cache'
import { StreamingLink } from '~/server/details.server'

interface UserDataRow {
  media_type: string
  tmdb_id: number
  on_wishlist: boolean
  on_watch_history: boolean
  on_favorites: boolean
  score: Score | null
  review: string | null
  updated_at_wishlist: Date | null
  updated_at_watch_history: Date | null
  updated_at_favorites: Date | null
  updated_at_scores: Date | null
  title: string
  poster_path: string
  aggregated_overall_score_normalized_percent: number | null
  streaming_links: StreamingLink[]
}

type GetUserDataParams = {
  user_id?: string
}

export type GetUserDataResult = {
  [media_type: string]: {
    [tmdb_id: string]: {
      onWishList: boolean
      onWatchHistory: boolean
      onFavorites: boolean
      score: Score | null
      review: string | null
      onWishListSince: Date | null
      onWatchHistorySince: Date | null
      onFavoritesSince: Date | null
      onScoresSince: Date | null
      title: string
      poster_path: string
      aggregated_overall_score_normalized_percent: number | null
      streaming_links: StreamingLink[]
    }
  }
}

export const getUserData = async (params: GetUserDataParams) => {
  return await cached<GetUserDataParams, GetUserDataResult>({
    name: 'user-data',
    target: _getUserData,
    params,
    ttlMinutes: 10,
    // ttlMinutes: 0,
  })
}

async function _getUserData({ user_id }: GetUserDataParams): Promise<GetUserDataResult> {
  if (!user_id) {
    return {} as GetUserDataResult
  }

  const query = `
WITH combined AS (
    SELECT 
        scores.media_type,
        scores.tmdb_id,
        scores.score,
        scores.review,
        FALSE AS on_wishlist,
        FALSE AS on_watch_history,
        FALSE AS on_favorites,
        scores.updated_at AS updated_at_scores,
        NULL::timestamp with time zone AS updated_at_wishlist,
        NULL::timestamp with time zone AS updated_at_watch_history,
        NULL::timestamp with time zone AS updated_at_favorites
    FROM user_scores AS scores
    WHERE scores.user_id = $1
    
    UNION ALL
    
    SELECT 
        wishlist.media_type,
        wishlist.tmdb_id,
        NULL AS score,
        NULL AS review,
        TRUE AS on_wishlist,
        FALSE AS on_watch_history,
        FALSE AS on_favorites,
        NULL::timestamp with time zone AS updated_at_scores,
        wishlist.updated_at AS updated_at_wishlist,
        NULL::timestamp with time zone AS updated_at_watch_history,
        NULL::timestamp with time zone AS updated_at_favorites
    FROM user_wishlist AS wishlist
    WHERE wishlist.user_id = $1
    
    UNION ALL
    
    SELECT 
        watchhistory.media_type,
        watchhistory.tmdb_id,
        NULL AS score,
        NULL AS review,
        FALSE AS on_wishlist,
        TRUE AS on_watch_history,
        FALSE AS on_favorites,
        NULL::timestamp with time zone AS updated_at_scores,
        NULL::timestamp with time zone AS updated_at_wishlist,
        watchhistory.updated_at AS updated_at_watch_history,
        NULL::timestamp with time zone AS updated_at_favorites
    FROM user_watch_history AS watchhistory
    WHERE watchhistory.user_id = $1
    
    UNION ALL
    
    SELECT 
        favorites.media_type,
        favorites.tmdb_id,
        NULL AS score,
        NULL AS review,
        FALSE AS on_wishlist,
        FALSE AS on_watch_history,
        TRUE AS on_favorites,
        NULL::timestamp with time zone AS updated_at_scores,
        NULL::timestamp with time zone AS updated_at_wishlist,
        NULL::timestamp with time zone AS updated_at_watch_history,
        favorites.updated_at AS updated_at_favorites
    FROM user_favorites AS favorites
    WHERE favorites.user_id = $1
)
SELECT 
    combined.media_type,
    combined.tmdb_id,
    MAX(combined.score) AS score,
    MAX(combined.review) AS review,
    MAX(combined.on_wishlist::int)::boolean AS on_wishlist,
    MAX(combined.on_watch_history::int)::boolean AS on_watch_history,
    MAX(combined.on_favorites::int)::boolean AS on_favorites,
    MAX(combined.updated_at_scores) AS updated_at_scores,
    MAX(combined.updated_at_wishlist) AS updated_at_wishlist,
    MAX(combined.updated_at_watch_history) AS updated_at_watch_history,
    MAX(combined.updated_at_favorites) AS updated_at_favorites,
    COALESCE(
        CASE WHEN combined.media_type = 'movie'
          THEN movies.title
          ELSE tv.title
        END, '') AS title,
    COALESCE(
        CASE WHEN combined.media_type = 'movie'
          THEN movies.poster_path
          ELSE tv.poster_path
        END, '') AS poster_path,
    COALESCE(
        CASE WHEN combined.media_type = 'movie'
          THEN movies.aggregated_overall_score_normalized_percent
          ELSE tv.aggregated_overall_score_normalized_percent
        END, NULL) AS aggregated_overall_score_normalized_percent,
    COALESCE(
        json_agg(
          CASE
            WHEN spl.provider_id IS NOT NULL THEN
              json_build_object(
                'provider_id', spl.provider_id,
                'provider_name', sp.name,
                'provider_logo_path', sp.logo_path,
                'stream_type', spl.stream_type
              )
          END
        ) FILTER (WHERE spl.provider_id IS NOT NULL), '[]'
    ) AS streaming_links
FROM combined
LEFT JOIN movies ON combined.media_type = 'movie' AND combined.tmdb_id = movies.tmdb_id
LEFT JOIN tv ON combined.media_type = 'tv' AND combined.tmdb_id = tv.tmdb_id
LEFT JOIN streaming_provider_links spl ON
  spl.tmdb_id = combined.tmdb_id
  AND spl.media_type = combined.media_type
  AND spl.country_code = $2
LEFT JOIN streaming_providers sp ON
  spl.provider_id = sp.id
GROUP BY
  combined.media_type,
  combined.tmdb_id,
  movies.title,
  tv.title,
  movies.poster_path,
  tv.poster_path,
  movies.aggregated_overall_score_normalized_percent,
  tv.aggregated_overall_score_normalized_percent
ORDER BY combined.tmdb_id DESC;
  `

  // TODO country param
  const params = [user_id, 'DE']
  const result = await executeQuery<UserDataRow>(query, params)

  const userData = {} as GetUserDataResult

  result.rows.forEach((row) => {
    const {
      media_type,
      tmdb_id,
      on_wishlist,
      on_watch_history,
      on_favorites,
      score,
      review,
      updated_at_wishlist,
      updated_at_watch_history,
      updated_at_favorites,
      updated_at_scores,
    } = row

    if (!userData[media_type]) {
      userData[media_type] = {}
    }

    const providerTypeKeys = row.streaming_links.map(
      (link) => `${link.provider_id}-${link.streaming_type}`
    )
    const streaming_links = row.streaming_links.filter(
      (link, index) => index === providerTypeKeys.indexOf(`${link.provider_id}-${link.streaming_type}`)
    )

    userData[media_type][tmdb_id] = {
      onWishList: on_wishlist,
      onWatchHistory: on_watch_history,
      onFavorites: on_favorites,
      score,
      review,
      onWishListSince: updated_at_wishlist ? new Date(updated_at_wishlist) : null,
      onWatchHistorySince: updated_at_watch_history ? new Date(updated_at_watch_history) : null,
      onFavoritesSince: updated_at_favorites ? new Date(updated_at_favorites) : null,
      onScoresSince: updated_at_scores ? new Date(updated_at_scores) : null,
      title: row.title,
      poster_path: row.poster_path,
      aggregated_overall_score_normalized_percent: row.aggregated_overall_score_normalized_percent,
      streaming_links,
    }
  })

  return userData
}

type ResetUserDataCacheParams = {
  user_id?: string
}

export const resetUserDataCache = async (params: ResetUserDataCacheParams) => {
  if (!params.user_id) {
    return 0
  }

  return await resetCache({
    name: 'user-data',
    params,
  })
}
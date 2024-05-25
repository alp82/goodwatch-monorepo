import { Score } from '~/server/scores.server'
import { executeQuery } from '~/utils/postgres'
import { cached, resetCache } from '~/utils/cache'

interface UserDataRow {
  media_type: string
  tmdb_id: number
  on_wishlist: boolean
  on_watch_history: boolean
  on_favorites: boolean
  score: Score | null
  review: string | null
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
    }
  }
}

export const getUserData = async (params: GetUserDataParams) => {
  return await cached<GetUserDataParams, GetUserDataResult>({
    name: 'user-data',
    target: _getUserData,
    params,
    ttlMinutes: 10,
  })
}

async function _getUserData({ user_id }: GetUserDataParams): Promise<GetUserDataResult> {
  if (!user_id) {
    return {} as GetUserDataResult
  }

  const query = `
    SELECT 
      COALESCE(scores.media_type, wishlist.media_type, watchhistory.media_type, favorites.media_type) AS media_type,
      COALESCE(scores.tmdb_id, wishlist.tmdb_id, watchhistory.tmdb_id, favorites.tmdb_id) AS tmdb_id,
      scores.score,
      scores.review,
      CASE WHEN wishlist.tmdb_id IS NOT NULL THEN TRUE ELSE FALSE END AS on_wishlist,
      CASE WHEN watchhistory.tmdb_id IS NOT NULL THEN TRUE ELSE FALSE END AS on_watch_history,
      CASE WHEN favorites.tmdb_id IS NOT NULL THEN TRUE ELSE FALSE END AS on_favorites
    FROM user_scores AS scores
    FULL OUTER JOIN user_wishlist AS wishlist ON
      wishlist.user_id = scores.user_id
      AND wishlist.media_type = scores.media_type
      AND wishlist.tmdb_id = scores.tmdb_id
    FULL OUTER JOIN user_watch_history AS watchhistory ON
      watchhistory.user_id = scores.user_id
      AND watchhistory.media_type = scores.media_type
      AND watchhistory.tmdb_id = scores.tmdb_id
    FULL OUTER JOIN user_favorites AS favorites ON
      favorites.user_id = scores.user_id
      AND favorites.media_type = scores.media_type
      AND favorites.tmdb_id = scores.tmdb_id
    WHERE
      COALESCE(scores.user_id, wishlist.user_id, watchhistory.user_id, favorites.user_id) = $1
  `
  const params = [user_id]
  const result = await executeQuery<UserDataRow>(query, params)

  const userData = {} as GetUserDataResult

  result.rows.forEach((row) => {
    const { media_type, tmdb_id, on_wishlist, on_watch_history, on_favorites, score, review } = row

    if (!userData[media_type]) {
      userData[media_type] = {}
    }

    userData[media_type][tmdb_id] = {
      onWishList: on_wishlist,
      onWatchHistory: on_watch_history,
      onFavorites: on_favorites,
      score,
      review,
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
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
        media_type,
        tmdb_id,
        MAX(score) AS score,
        MAX(review) AS review,
        MAX(on_wishlist::int)::boolean AS on_wishlist,
        MAX(on_watch_history::int)::boolean AS on_watch_history,
        MAX(on_favorites::int)::boolean AS on_favorites
    FROM (
        SELECT 
            scores.media_type,
            scores.tmdb_id,
            scores.score,
            scores.review,
            FALSE AS on_wishlist,
            FALSE AS on_watch_history,
            FALSE AS on_favorites
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
            FALSE AS on_favorites
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
            FALSE AS on_favorites
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
            TRUE AS on_favorites
        FROM user_favorites AS favorites
        WHERE favorites.user_id = $1
    ) AS combined
    GROUP BY media_type, tmdb_id
    ORDER BY tmdb_id;
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
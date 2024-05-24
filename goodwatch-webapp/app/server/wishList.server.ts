import { executeQuery } from '~/utils/postgres'

interface UpdateWishListParams {
  user_id?: string
  tmdb_id: number | null
  media_type: "movie" | "tv"
  action: "add" | "remove"
}

export interface UpdateWishListPayload {
  tmdb_id: number
  media_type: "movie" | "tv"
  action: "add" | "remove"
}

export interface UpdateWishListResult {
  status: "success" | "failed"
}

export const updateWishList = async ({
  user_id,
  tmdb_id,
  media_type,
  action,
}: UpdateWishListParams): Promise<UpdateWishListResult> => {
  if (!user_id || !tmdb_id) {
    return {
      status: "failed"
    }
  }

  const query = action == "add" ? `
    INSERT INTO user_wishlist (user_id, tmdb_id, media_type, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, tmdb_id, media_type)
    DO UPDATE SET
      updated_at = EXCLUDED.updated_at;
  ` : `
    DELETE FROM user_wishlist
    WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3;
  `
  const params = [user_id, tmdb_id, media_type];
  const result = await executeQuery(query, params)

  return {
    status: result.rowCount === 1 ? "success" : "failed"
  }
}


interface GetWishListParams {
  user_id?: string
}

export interface WishListItem {
  user_id: string
  tmdb_id: string
  media_type: "movie" | "tv"
  updated_at: Date
}

export type GetWishListResult = {
  [key in 'movie' | 'tv']: {
    [key: string]: {
      onWishList: true;
    }
  }
}

export const getWishList = async ({
  user_id,
}: GetWishListParams): Promise<GetWishListResult> => {
  if (!user_id) {
    return {} as GetWishListResult
  }

  const query = `
    SELECT * FROM user_wishlist
    WHERE user_id = $1;
  `
  const params = [user_id];
  const result = await executeQuery<WishListItem>(query, params)

  return result.rows.reduce((resultMap, row) => {
    return {
      ...resultMap,
      [row.media_type]: {
        ...(resultMap[row.media_type] || {}),
        [row.tmdb_id]: {
          onWishList: true,
        }
      }
    }
  }, {} as GetWishListResult)
}
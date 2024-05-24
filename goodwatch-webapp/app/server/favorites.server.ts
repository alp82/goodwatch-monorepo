import { executeQuery } from '~/utils/postgres'

interface UpdateFavoritesParams {
  user_id?: string
  tmdb_id: number | null
  media_type: "movie" | "tv"
  action: "add" | "remove"
}

export interface UpdateFavoritesPayload {
  tmdb_id: number
  media_type: "movie" | "tv"
  action: "add" | "remove"
}

export interface UpdateFavoritesResult {
  status: "success" | "failed"
}

export const updateFavorites = async ({
  user_id,
  tmdb_id,
  media_type,
  action,
}: UpdateFavoritesParams): Promise<UpdateFavoritesResult> => {
  if (!user_id || !tmdb_id) {
    return {
      status: "failed"
    }
  }

  const query = action == "add" ? `
    INSERT INTO user_favorites (user_id, tmdb_id, media_type, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, tmdb_id, media_type)
    DO UPDATE SET
      updated_at = EXCLUDED.updated_at;
  ` : `
    DELETE FROM user_favorites
    WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3;
  `
  const params = [user_id, tmdb_id, media_type];
  const result = await executeQuery(query, params)

  return {
    status: result.rowCount === 1 ? "success" : "failed"
  }
}


interface GetFavoritesParams {
  user_id?: string
}

export interface FavoritesItem {
  user_id: string
  tmdb_id: string
  media_type: "movie" | "tv"
  updated_at: Date
}

export type GetFavoritesResult = {
  [key in 'movie' | 'tv']: {
    [key: string]: {
      onFavorites: true;
    }
  }
}

export const getFavorites = async ({
  user_id,
}: GetFavoritesParams): Promise<GetFavoritesResult> => {
  if (!user_id) {
    return {} as GetFavoritesResult
  }

  const query = `
    SELECT * FROM user_favorites
    WHERE user_id = $1;
  `
  const params = [user_id];
  const result = await executeQuery<FavoritesItem>(query, params)

  return result.rows.reduce((resultMap, row) => {
    return {
      ...resultMap,
      [row.media_type]: {
        ...(resultMap[row.media_type] || {}),
        [row.tmdb_id]: {
          onFavorites: true,
        }
      }
    }
  }, {} as GetFavoritesResult)
}
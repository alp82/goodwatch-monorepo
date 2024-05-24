import { executeQuery } from '~/utils/postgres'

interface UpdateWatchHistoryParams {
  user_id?: string
  tmdb_id: number | null
  media_type: "movie" | "tv"
  action: "add" | "remove"
}

export interface UpdateWatchHistoryPayload {
  tmdb_id: number
  media_type: "movie" | "tv"
  action: "add" | "remove"
}

export interface UpdateWatchHistoryResult {
  status: "success" | "failed"
}

export const updateWatchHistory = async ({
  user_id,
  tmdb_id,
  media_type,
  action,
}: UpdateWatchHistoryParams): Promise<UpdateWatchHistoryResult> => {
  if (!user_id || !tmdb_id) {
    return {
      status: "failed"
    }
  }

  const query = action == "add" ? `
    INSERT INTO user_watch_history (user_id, tmdb_id, media_type, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, tmdb_id, media_type)
    DO UPDATE SET
      updated_at = EXCLUDED.updated_at;
  ` : `
    DELETE FROM user_watch_history
    WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3;
  `
  const params = [user_id, tmdb_id, media_type];
  const result = await executeQuery(query, params)

  return {
    status: result.rowCount === 1 ? "success" : "failed"
  }
}


interface GetWatchHistoryParams {
  user_id?: string
}

export interface WatchHistoryItem {
  user_id: string
  tmdb_id: string
  media_type: "movie" | "tv"
  updated_at: Date
}

export type GetWatchHistoryResult = {
  [key in 'movie' | 'tv']: {
    [key: string]: {
      onWatchHistory: true;
    }
  }
}

export const getWatchHistory = async ({
  user_id,
}: GetWatchHistoryParams): Promise<GetWatchHistoryResult> => {
  if (!user_id) {
    return {} as GetWatchHistoryResult
  }

  const query = `
    SELECT * FROM user_watch_history
    WHERE user_id = $1;
  `
  const params = [user_id];
  const result = await executeQuery<WatchHistoryItem>(query, params)

  return result.rows.reduce((resultMap, row) => {
    return {
      ...resultMap,
      [row.media_type]: {
        ...(resultMap[row.media_type] || {}),
        [row.tmdb_id]: {
          onWatchHistory: true,
        }
      }
    }
  }, {} as GetWatchHistoryResult)
}
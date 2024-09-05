import { resetUserDataCache } from "~/server/userData.server"
import { executeQuery } from "~/utils/postgres"

interface UpdateSkippedParams {
	user_id?: string
	tmdb_id: number | null
	media_type: "movie" | "tv"
	action: "add" | "remove"
}

export interface UpdateSkippedPayload {
	tmdb_id: number
	media_type: "movie" | "tv"
	action: "add" | "remove"
}

export interface UpdateSkippedResult {
	status: "success" | "failed"
}

export const updateSkipped = async ({
	user_id,
	tmdb_id,
	media_type,
	action,
}: UpdateSkippedParams): Promise<UpdateSkippedResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		}
	}

	// TODO return if media is already scored, wishlisted or favorited

	const query =
		action === "add"
			? `
    INSERT INTO user_skipped (user_id, tmdb_id, media_type, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, tmdb_id, media_type)
    DO UPDATE SET
      updated_at = EXCLUDED.updated_at;
  `
			: `
    DELETE FROM user_skipped
    WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3;
  `
	const params = [user_id, tmdb_id, media_type]
	const result = await executeQuery(query, params)
	await resetUserDataCache({ user_id })

	return {
		status: result.rowCount === 1 ? "success" : "failed",
	}
}

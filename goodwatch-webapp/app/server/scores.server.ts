import { resetUserDataCache } from "~/server/userData.server"
import { execute, upsert } from "~/utils/crate"

export type Score = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

interface UpdateScoresParams {
	user_id?: string
	tmdb_id: number | null
	media_type: "movie" | "show"
	score?: Score
	review?: string
}

export interface UpdateScoresPayload {
	tmdb_id: number
	media_type: "movie" | "show"
	score: Score | null
	review?: string
}

export interface UpdateScoresResult {
	status: "success" | "failed"
}

export const updateScores = async ({
	user_id,
	tmdb_id,
	media_type,
	score,
	review,
}: UpdateScoresParams): Promise<UpdateScoresResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		}
	}

	let result: { rowcount?: number }

	if (score) {
		// Use upsert for adding/updating scores
		result = await upsert({
			table: "user_score",
			data: [{
				user_id,
				tmdb_id,
				media_type: media_type,
				score,
				review: review || null,
			}],
			conflictColumns: ["user_id", "tmdb_id", "media_type"],
			ignoreUpdate: false, // Update score and review on conflict
		})
	} else {
		// Use execute for deleting scores
		const sql = `
			DELETE FROM user_score
			WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
		`
		const params = [user_id, tmdb_id, media_type]
		result = await execute(sql, params)
	}

	await resetUserDataCache({ user_id })

	return {
		status: (result.rowcount || 0) >= 1 ? "success" : "failed",
	}
}

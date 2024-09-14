import { resetUserDataCache } from "~/server/userData.server"
import { executeQuery } from "~/utils/postgres"

export type Score = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

interface UpdateScoresParams {
	user_id?: string
	tmdb_id: number | null
	media_type: "movie" | "tv"
	score?: Score
	review?: string
}

export interface UpdateScoresPayload {
	tmdb_id: number
	media_type: "movie" | "tv"
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

	const query = score
		? `
			INSERT INTO user_scores (user_id, tmdb_id, media_type, score, review, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (user_id, tmdb_id, media_type)
			DO UPDATE SET
				score = EXCLUDED.score,
				review = EXCLUDED.review,
				updated_at = EXCLUDED.updated_at;
		`
		: `
			DELETE FROM user_scores
			WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3;
		`
	let params: (string | number | undefined)[] = [user_id, tmdb_id, media_type]
	if (score) {
		params = [...params, score, review]
	}
	const result = await executeQuery(query, params)
	await resetUserDataCache({ user_id })

	return {
		status: result.rowCount === 1 ? "success" : "failed",
	}
}

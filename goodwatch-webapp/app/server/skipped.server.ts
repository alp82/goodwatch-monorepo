import { resetOnboardingMediaCache } from "~/server/onboarding-media.server"
import { resetUserDataCache } from "~/server/userData.server"
import { execute, upsert } from "~/utils/crate"

interface UpdateSkippedParams {
	user_id?: string
	tmdb_id: number | null
	media_type: "movie" | "show"
	action: "add" | "remove"
}

export interface UpdateSkippedPayload {
	tmdb_id: number
	media_type: "movie" | "show"
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

	let result: { rowcount?: number }

	if (action === "add") {
		// Use upsert for adding skipped items
		result = await upsert({
			table: "user_skipped",
			data: [{
				user_id,
				tmdb_id,
				media_type: media_type,
			}],
			conflictColumns: ["user_id", "tmdb_id", "media_type"],
			ignoreUpdate: true, // Just ignore if already exists
		})
	} else {
		// Use execute for deleting skipped items
		const sql = `
			DELETE FROM user_skipped
			WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
		`
		const params = [user_id, tmdb_id, media_type]
		result = await execute(sql, params)
	}

	await resetUserDataCache({ user_id })
	await resetOnboardingMediaCache({ userId: user_id, searchTerm: "" })

	return {
		status: (result.rowcount || 0) >= 1 ? "success" : "failed",
	}
}

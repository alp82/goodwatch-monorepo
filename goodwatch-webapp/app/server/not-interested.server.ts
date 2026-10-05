import { markTasteChanged } from "~/server/taste/index.server"
import { canonicalTitleId } from "~/utils/title-identity"
import { resetOnboardingMediaCache } from "~/server/onboarding-media.server"
import { resetUserDataCache } from "~/server/userData.server"
import { execute, upsert } from "~/utils/crate"

interface UpdateNotInterestedParams {
	user_id?: string
	tmdb_id: number | null
	media_type: "movie" | "show"
	action: "add" | "remove"
}

export interface UpdateNotInterestedPayload {
	tmdb_id: number
	media_type: "movie" | "show"
	action: "add" | "remove"
}

export interface UpdateNotInterestedResult {
	status: "success" | "failed"
}

export const updateNotInterested = async ({
	user_id,
	tmdb_id,
	media_type,
	action,
}: UpdateNotInterestedParams): Promise<UpdateNotInterestedResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		}
	}

	tmdb_id = canonicalTitleId(media_type, tmdb_id)

	try {
		if (action === "add") {
			// Use upsert for adding Not interested titles
			await upsert({
				table: "user_not_interested",
				data: [{
					user_id,
					tmdb_id,
					media_type: media_type,
				}],
				conflictColumns: ["user_id", "tmdb_id", "media_type"],
				ignoreUpdate: true, // Just ignore if already exists
			})
		} else {
			// Use execute for deleting Not interested titles
			const sql = `
				DELETE FROM user_not_interested
				WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
			`
			const params = [user_id, tmdb_id, media_type]
			await execute(sql, params)
		}

		if (action === "add") {
			const removed = await execute(
				"DELETE FROM user_wishlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
				[user_id, tmdb_id, media_type],
			)
			// Removing Want to See changes taste; the hide itself is never a taste signal.
			if (removed.rowcount) await markTasteChanged(user_id)
		}
		await resetUserDataCache({ user_id })
		await resetOnboardingMediaCache({ userId: user_id, searchTerm: "" })

		return {
			status: "success",
		}
	} catch (error) {
		console.error("Updating Not interested failed:", error)
		await resetUserDataCache({ user_id })
		await resetOnboardingMediaCache({ userId: user_id, searchTerm: "" })
		return { status: "failed" }
	}
}

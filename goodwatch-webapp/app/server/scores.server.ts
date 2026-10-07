import { clearNotInterested } from "~/server/not-interested-store.server"
import { canonicalTitleId } from "~/utils/title-identity"
import { resetOnboardingMediaCache } from "~/server/onboarding-media.server"
import { markTasteChanged } from "~/server/taste/index.server"
import { applyTrackingEvent } from "~/server/tracking.server"
import { resetUserDataCache } from "~/server/userData.server"
import { execute, upsert } from "~/utils/crate"

export type Score = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

interface UpdateScoresParams {
	user_id?: string
	tmdb_id: number | null
	media_type: "movie" | "show"
	score?: Score | null
	review?: string
	/**
	 * False for a score the taste quiz wrote. A score given by hand on a show that is Not started opens "Have you
	 * seen all of it?"; the quiz's scores never do.
	 */
	by_hand?: boolean
}

export interface UpdateScoresPayload {
	tmdb_id: number
	media_type: "movie" | "show"
	score: Score | null
	review?: string
	by_hand?: boolean
}

export interface UpdateScoresResult {
	status: "success" | "failed"
}

/**
 * Sets, changes or clears a score, and tells tracking about it in the same request
 * (docs/implementation/tracking/data-model.md, C2). For a movie that makes the score's watch exist exactly while the
 * movie has a score and no other watch, so a rated movie is Seen, and a movie that is Seen through its score alone
 * leaves the Wishlist. For a show a score records no watch and changes no state.
 */
export const updateScores = async ({
	user_id,
	tmdb_id,
	media_type,
	score,
	review,
	by_hand,
}: UpdateScoresParams): Promise<UpdateScoresResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		}
	}

	tmdb_id = canonicalTitleId(media_type, tmdb_id)

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

	if (score != null) await clearNotInterested(user_id, tmdb_id, media_type)

	let wasReset = false
	try {
		// After the score is stored: the writer reads it by its key. It resets the member data when it applied.
		const tracked = await applyTrackingEvent(
			user_id,
			{ mediaType: media_type, tmdbId: tmdb_id },
			{ type: "rate", score: score || null, byHand: by_hand !== false },
		)
		wasReset = tracked.status === "applied"
	} finally {
		// Also when tracking refused or failed: the score itself is stored.
		if (!wasReset) await resetUserDataCache({ user_id })
		await markTasteChanged(user_id)
		await resetOnboardingMediaCache({ userId: user_id, searchTerm: "" })
	}

	return {
		status: (result.rowcount || 0) >= 1 ? "success" : "failed",
	}
}

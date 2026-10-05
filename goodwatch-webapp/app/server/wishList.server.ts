import { clearNotInterested } from "~/server/not-interested-store.server"
import { canonicalTitleId } from "~/utils/title-identity"
import { resetOnboardingMediaCache } from "~/server/onboarding-media.server";
import { markTasteChanged } from "~/server/taste/index.server";
import { resetUserDataCache } from "~/server/userData.server";
import { execute, upsert } from "~/utils/crate";

interface UpdateWishListParams {
	user_id?: string;
	tmdb_id: number | null;
	media_type: "movie" | "show";
	action: "add" | "remove";
	// Adding back a title with its original added-at time (Undo after "I watched it" in Watch next), so it keeps its
	// place in Waiting longest. Server callers only; the update-wishlist route never passes it.
	addedAt?: Date;
}

export interface UpdateWishListPayload {
	tmdb_id: number;
	media_type: "movie" | "show";
	action: "add" | "remove";
}

export interface UpdateWishListResult {
	status: "success" | "failed";
}

export const updateWishList = async ({
	user_id,
	tmdb_id,
	media_type,
	action,
	addedAt,
}: UpdateWishListParams): Promise<UpdateWishListResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		};
	}

	tmdb_id = canonicalTitleId(media_type, tmdb_id)

	let result: { rowcount?: number };

	if (action === "add") {
		// Use upsert for adding wishlist items
		result = await upsert({
			table: "user_wishlist",
			data: [{
				user_id,
				tmdb_id,
				media_type: media_type,
				...(addedAt ? { created_at: addedAt } : {}),
			}],
			conflictColumns: ["user_id", "tmdb_id", "media_type"],
			ignoreUpdate: true, // Just ignore if already exists
		});
	} else {
		// Use execute for deleting wishlist items
		const sql = `
			DELETE FROM user_wishlist
			WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
		`;
		const params = [user_id, tmdb_id, media_type];
		result = await execute(sql, params);
	}

	if (action === "add") await clearNotInterested(user_id, tmdb_id, media_type)

	await resetUserDataCache({ user_id });
	await markTasteChanged(user_id);
	await resetOnboardingMediaCache({ userId: user_id, searchTerm: "" });

	return {
		status: (result.rowcount || 0) >= 1 ? "success" : "failed",
	};
};

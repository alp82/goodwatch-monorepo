import { resetUserDataCache } from "~/server/userData.server";
import { execute, upsert } from "~/utils/crate";

interface UpdateWishListParams {
	user_id?: string;
	tmdb_id: number | null;
	media_type: "movie" | "show";
	action: "add" | "remove";
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
}: UpdateWishListParams): Promise<UpdateWishListResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		};
	}

	let result: { rowcount?: number };

	if (action === "add") {
		// Use upsert for adding wishlist items
		result = await upsert({
			table: "user_wishlist",
			data: [{
				user_id,
				tmdb_id,
				media_type: media_type,
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

	await resetUserDataCache({ user_id });

	return {
		status: (result.rowcount || 0) >= 1 ? "success" : "failed",
	};
};

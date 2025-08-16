import { resetUserDataCache } from "~/server/userData.server";
import { execute, upsert } from "~/utils/crate";

interface UpdateFavoritesParams {
	user_id?: string;
	tmdb_id: number | null;
	media_type: "movie" | "tv";
	action: "add" | "remove";
}

export interface UpdateFavoritesPayload {
	tmdb_id: number;
	media_type: "movie" | "tv";
	action: "add" | "remove";
}

export interface UpdateFavoritesResult {
	status: "success" | "failed";
}

export const updateFavorites = async ({
	user_id,
	tmdb_id,
	media_type,
	action,
}: UpdateFavoritesParams): Promise<UpdateFavoritesResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		};
	}

	let result: { rowcount?: number };

	if (action === "add") {
		// Use upsert for adding favorite items
		result = await upsert({
			table: "user_favorite",
			data: [{
				user_id,
				tmdb_id,
				media_type: media_type === "tv" ? "show" : media_type,
			}],
			conflictColumns: ["user_id", "tmdb_id", "media_type"],
			ignoreUpdate: true, // Just ignore if already exists
		});
	} else {
		// Use execute for deleting favorite items
		const sql = `
			DELETE FROM user_favorite
			WHERE user_id = ? AND tmdb_id = ? AND media_type = ?
		`;
		const params = [user_id, tmdb_id, media_type === "tv" ? "show" : media_type];
		result = await execute(sql, params);
	}

	await resetUserDataCache({ user_id });

	return {
		status: (result.rowcount || 0) >= 1 ? "success" : "failed",
	};
};

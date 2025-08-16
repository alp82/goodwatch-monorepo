import { resetUserDataCache } from "~/server/userData.server";
import { execute, upsert } from "~/utils/crate";

interface UpdateWatchHistoryParams {
	user_id?: string;
	tmdb_id: number | null;
	media_type: "movie" | "tv";
	action: "add" | "remove";
}

export interface UpdateWatchHistoryPayload {
	tmdb_id: number;
	media_type: "movie" | "tv";
	action: "add" | "remove";
}

export interface UpdateWatchHistoryResult {
	status: "success" | "failed";
}

export const updateWatchHistory = async ({
	user_id,
	tmdb_id,
	media_type,
	action,
}: UpdateWatchHistoryParams): Promise<UpdateWatchHistoryResult> => {
	if (!user_id || !tmdb_id) {
		return {
			status: "failed",
		};
	}

	let result: { rowcount?: number };

	if (action === "add") {
		// Use upsert for adding watch history items
		// Initialize with basic data - enhanced fields can be updated later
		const now = new Date();
		result = await upsert({
			table: "user_watch_history",
			data: [{
				user_id,
				tmdb_id,
				media_type: media_type === "tv" ? "show" : media_type,
				watched_at_list: [now],
				progress_percent: null,
				progress_seconds: null,
				season_number: null,
				episode_number: null,
				ingest_source: "webapp",
				first_watched_at: now,
				last_watched_at: now,
				watch_count: 1,
			}],
			conflictColumns: ["user_id", "tmdb_id", "media_type"],
			ignoreUpdate: false, // Update timestamps and count on conflict
		});
	} else {
		// Use execute for deleting watch history items
		const sql = `
			DELETE FROM user_watch_history
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

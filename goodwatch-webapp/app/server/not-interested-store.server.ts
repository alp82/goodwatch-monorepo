import type { MediaType } from "~/types/user-data"
import { execute, query } from "~/utils/crate"
import { canonicalTitleId } from "~/utils/title-identity"

export function isMissingNotInterestedTable(error: unknown): boolean {
	const message = String((error as { message?: unknown } | null)?.message ?? error)
	return /RelationUnknown|SchemaUnknown/.test(message) && message.includes("user_not_interested")
}

export async function readNotInterested(userId?: string) {
	if (!userId) return []
	try {
		return await query<{ tmdb_id: number; media_type: MediaType; updated_at: Date }>(
			"SELECT tmdb_id, media_type, updated_at FROM user_not_interested WHERE user_id = ? ORDER BY updated_at DESC",
			[userId],
		)
	} catch (error) {
		if (isMissingNotInterestedTable(error)) return []
		throw error
	}
}

/** Best effort: a positive interaction must still work before the new table is deployed. */
export async function clearNotInterested(userId: string, tmdbId: number, mediaType: MediaType) {
	try {
		await execute(
			"DELETE FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
			[userId, canonicalTitleId(mediaType, tmdbId), mediaType],
		)
	} catch (error) {
		if (!isMissingNotInterestedTable(error)) console.error("Clearing Not interested failed:", error)
	}
}

export async function refreshNotInterested() {
	try {
		await execute("REFRESH TABLE user_not_interested")
	} catch (error) {
		if (!isMissingNotInterestedTable(error)) throw error
	}
}

export async function excludeNotInterested<T extends { tmdb_id: number; media_type: string }>(userId: string, titles: T[]): Promise<T[]> {
	const hidden = new Set((await readNotInterested(userId)).map((item) => `${item.media_type}-${item.tmdb_id}`))
	return titles.filter((item) => !hidden.has(`${item.media_type}-${item.tmdb_id}`))
}

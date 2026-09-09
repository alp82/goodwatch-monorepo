import { execute } from "~/utils/crate"

export interface PriorityImpression {
	media_type: "movie" | "show"
	tmdb_id: number
}

export async function increasePriority(items: PriorityImpression[], amount = 1) {
	if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid priority increment")
	const unique = [...new Map(items.map(item => [`${item.media_type}:${item.tmdb_id}`, item])).values()]
	if (!unique.length) return
	if (unique.some(item => !["movie", "show"].includes(item.media_type) || !Number.isSafeInteger(item.tmdb_id) || item.tmdb_id <= 0 || item.tmdb_id > 2_147_483_647)) {
		throw new Error("Invalid priority item")
	}
	await execute(`
		INSERT INTO crawl_priority
		(media_type, tmdb_id, demand, acknowledged_demand, claimed_demand, created_at, updated_at)
		VALUES ${unique.map(() => "(?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").join(", ")}
		ON CONFLICT (media_type, tmdb_id) DO UPDATE SET
			demand = demand + excluded.demand,
			updated_at = CURRENT_TIMESTAMP
	`, unique.flatMap(item => [item.media_type, item.tmdb_id, amount]))
}

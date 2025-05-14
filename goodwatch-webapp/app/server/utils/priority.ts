import { executeQuery } from "~/utils/postgres"

export async function increasePriorityForMovies(
	tmdb_ids: number[] | string[],
	amount = 1,
) {
	await increasePriority(tmdb_ids, "movie", amount)
}

export async function increasePriorityForTVs(
	tmdb_ids: number[] | string[],
	amount = 1,
) {
	await increasePriority(tmdb_ids, "tv", amount)
}

async function increasePriority(
	tmdb_ids: number[] | string[],
	type: "movie" | "tv",
	amount: number,
) {
	const potentiallyDuplicateIds = tmdb_ids
		.map((id) => Number(id))
		.filter((id) => !Number.isNaN(id))
	const uniqueIds = [...new Set(potentiallyDuplicateIds)]

	if (uniqueIds.length === 0) {
		throw new Error("No valid TMDb IDs provided.")
	}

	const valuePlaceholders = uniqueIds
		.map((_, index) => `($${index + 1}, 1, NOW(), NOW())`)
		.join(", ")

	const query = `
    INSERT INTO priority_queue_${type} (tmdb_id, priority, created_at, updated_at)
    VALUES ${valuePlaceholders}
    ON CONFLICT (tmdb_id)
    DO UPDATE SET
        priority = priority_queue_${type}.priority + $${uniqueIds.length + 1},
        updated_at = NOW()
  `

	const params = [...uniqueIds, amount]
	await executeQuery(query, params)
}

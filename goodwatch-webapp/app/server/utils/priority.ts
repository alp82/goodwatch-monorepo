import { query } from "~/utils/crate"

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
	await increasePriority(tmdb_ids, "show", amount)
}

async function increasePriority(
	tmdb_ids: number[] | string[],
	type: "movie" | "show",
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
		.map(() => `(?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
		.join(", ")

	const crateQuery = `
    INSERT INTO priority_queue_${type} (tmdb_id, priority, created_at, updated_at)
    VALUES ${valuePlaceholders}
    ON CONFLICT (tmdb_id)
    DO UPDATE SET
        priority = priority_queue_${type}.priority + ?,
        updated_at = CURRENT_TIMESTAMP
  `

	const params = [...uniqueIds, amount]
	await query(crateQuery, params)
}

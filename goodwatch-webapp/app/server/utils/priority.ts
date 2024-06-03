import { executeQuery } from '~/utils/postgres'

export async function increasePriorityForMovies(tmdb_ids: number[] | string[], amount = 1) {
  await increasePriority(tmdb_ids, "movie", amount)
}

export async function increasePriorityForTVs(tmdb_ids: number[] | string[], amount = 1) {
  await increasePriority(tmdb_ids, "tv", amount)
}

async function increasePriority(tmdb_ids: number[] | string[], type: "movie" | "tv", amount: number) {
  const values = tmdb_ids.map(id => `(${id}, 1, NOW(), NOW())`).join(', ')
  const query = `
    INSERT INTO priority_queue_${type} (tmdb_id, priority, created_at, updated_at)
    VALUES ${values}
    ON CONFLICT (tmdb_id)
    DO UPDATE SET
        priority = priority_queue_${type}.priority + ${amount},
        updated_at = NOW()
  `
  await executeQuery(query)
}

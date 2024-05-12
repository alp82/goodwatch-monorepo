import { executeQuery } from '~/utils/postgres'

export async function increasePriorityForMovies(tmdb_ids: number[]) {
  await increasePriority(tmdb_ids, "movie");
}

export async function increasePriorityForTVs(tmdb_ids: number[]) {
  await increasePriority(tmdb_ids, "tv");
}

async function increasePriority(tmdb_ids: number[], type: "movie" | "tv") {
  const values = tmdb_ids.map(id => `(${id}, 1, NOW(), NOW())`).join(', ');
  const query = `
    INSERT INTO priority_queue_${type} (tmdb_id, priority, created_at, updated_at)
    VALUES ${values}
    ON CONFLICT (tmdb_id)
    DO UPDATE SET
        priority = priority_queue_${type}.priority + 1,
        updated_at = NOW();
  `;
  await executeQuery(query);
}

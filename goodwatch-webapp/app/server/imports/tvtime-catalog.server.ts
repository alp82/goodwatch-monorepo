import type { ImportObservation } from "../../domain/imports.ts"
import { chunks, marks, run, select } from "./store.server.ts"
import {
	type TvdbLookup,
	type TvdbLookupResult,
	createTvdbLookup,
} from "./tvdb-lookup.server.ts"

/** Read both identity namespaces together, before starting the remote lookup budget. */
export async function createTvtimeCatalogLookup(
	rows: ImportObservation[],
): Promise<TvdbLookup> {
	const eligible = rows.filter(
		(row) => !row.problem && row.mediaType === "show",
	)
	const episodeIds = [
		...new Set(
			eligible.flatMap((row) =>
				row.episodeTvdbId == null ? [] : [row.episodeTvdbId],
			),
		),
	]
	const showIds = [
		...new Set(
			eligible.flatMap((row) =>
				row.showTvdbId == null ? [] : [row.showTvdbId],
			),
		),
	]
	const cached = new Map<number, TvdbLookupResult>()
	const identities = [
		...episodeIds.map((id) => ({ kind: "episode" as const, id })),
		...showIds.map((id) => ({ kind: "show" as const, id })),
	]
	let records = 0
	for (const batch of chunks(identities, 800)) {
		const episodes = batch
			.filter((id) => id.kind === "episode")
			.map((id) => id.id)
		const shows = batch.filter((id) => id.kind === "show").map((id) => id.id)
		const matches = await select<{
			kind: "show" | "episode"
			tvdb_id: number
			tmdb_id: number
			show_id: number
		}>(
			`SELECT 'episode' AS kind, tvdb_id, tmdb_id, show_id FROM episode WHERE tvdb_id IN (${marks(episodes.length) || "NULL"}) AND removed_at IS NULL UNION ALL SELECT 'show' AS kind, tvdb_id, tmdb_id, tmdb_id AS show_id FROM show WHERE tvdb_id IN (${marks(shows.length) || "NULL"}) LIMIT 100001`,
			[...episodes, ...shows],
		)
		records += matches.length
		// Keep the original global bound, including a truncated individual batch.
		// Discard earlier batches too rather than inferring uniqueness from a partial read.
		if (records >= 100001) {
			cached.clear()
			break
		}
		for (const row of matches) {
			let result = cached.get(Number(row.tvdb_id))
			if (!result) {
				result = { tv_results: [], tv_episode_results: [] }
				cached.set(Number(row.tvdb_id), result)
			}
			if (row.kind === "show")
				result.tv_results.push({ id: Number(row.tmdb_id) })
			else
				result.tv_episode_results.push({
					id: Number(row.tmdb_id),
					show_id: Number(row.show_id),
				})
		}
	}
	const remote = createTvdbLookup()
	const publishedShows = new Set<number>()
	return async (id, kind = "episode") => {
		const stored = cached.get(id)
		if (
			stored &&
			(kind === "show"
				? stored.tv_results.length
				: stored.tv_episode_results.length)
		)
			return stored
		const result = await remote(id)
		// A positive cache entry in one namespace says nothing about the other.
		const evidence = {
			tv_results: stored?.tv_results.length
				? stored.tv_results
				: result.tv_results,
			tv_episode_results: stored?.tv_episode_results.length
				? stored.tv_episode_results
				: result.tv_episode_results,
		}
		cached.set(id, evidence)
		if (result.tv_results.length === 1 && !publishedShows.has(id)) {
			publishedShows.add(id)
			try {
				await run(
					"UPDATE show SET tvdb_id = ? WHERE tmdb_id = ? AND tvdb_id IS NULL",
					[id, result.tv_results[0].id],
				)
			} catch (error) {
				console.error("Could not cache import show TVDB identity", { error })
			}
		}
		return evidence
	}
}

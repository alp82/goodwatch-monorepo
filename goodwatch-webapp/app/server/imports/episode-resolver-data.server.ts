import { z } from "zod"
import {
	TMDB_TIMEOUT_DEFAULT_MS,
	timeoutSetting,
	withBackendTimeout,
} from "../../utils/backend-timeout.ts"
import type { AnimeMappings } from "./anime-mapping-data.server.ts"
import {
	type CatalogEpisode,
	EPISODE_CATALOG_LIMIT,
	createEpisodeResolver,
} from "./episode-resolver.server.ts"
import { run, select } from "./store.server.ts"

const id = z.number().int().positive()
const summary = z.object({
	id: z.string(),
	name: z.string(),
	type: z.number(),
	network: z.object({ name: z.string() }).nullable(),
	group_count: z.number().int().nonnegative(),
})
const group = z.object({
	id: z.string(),
	episode_count: z.number().int().positive(),
	group_count: z.number().int().positive(),
	groups: z.array(
		z.object({
			name: z.string(),
			order: z.number().int().nonnegative(),
			episodes: z.array(
				z.object({ id, order: z.number().int().nonnegative() }),
			),
		}),
	),
})
async function tmdb<T>(
	path: string,
	schema: z.ZodType<T>,
	params: Record<string, string> = {},
): Promise<T> {
	const query = new URLSearchParams({
		api_key: process.env.TMDB_API_KEY ?? "",
		language: "en-US",
		...params,
	})
	return withBackendTimeout(
		"TMDB",
		timeoutSetting("TMDB_TIMEOUT_MS", TMDB_TIMEOUT_DEFAULT_MS),
		async (signal) => {
			const response = await fetch(
				`https://api.themoviedb.org/3/${path}?${query}`,
				{ signal },
			)
			if (!response.ok)
				throw new Error(`TMDB episode lookup returned HTTP ${response.status}`)
			return schema.parse(await response.json())
		},
	)
}

/** Memoize per preview, including failed requests, without retaining a global cache. */
function memoize<K, V>(load: (key: K) => Promise<V>) {
	const pending = new Map<K, Promise<V>>()
	return (key: K): Promise<V> => {
		let result = pending.get(key)
		if (!result) {
			result = load(key)
			pending.set(key, result)
		}
		return result
	}
}

/** One resolver per preview: no process-wide data or credentials retained. */
export function createCatalogEpisodeResolver(animeMappings: AnimeMappings) {
	return createEpisodeResolver({
		animeMappings,
		episodes: memoize((showId: number) =>
			select<CatalogEpisode>(
				`SELECT tmdb_id, show_id, season_number, episode_number, name, tvdb_id FROM episode WHERE show_id = ? AND removed_at IS NULL LIMIT ${EPISODE_CATALOG_LIMIT + 1}`,
				[showId],
			),
		),
		findTvdb: memoize((tvdbId: number) =>
			tmdb(
				`find/${tvdbId}`,
				z.object({
					tv_episode_results: z.array(z.object({ id, show_id: id })),
				}),
				{ external_source: "tvdb_id" },
			),
		),
		groups: memoize(
			async (showId: number) =>
				(
					await tmdb(
						`tv/${showId}/episode_groups`,
						z.object({ results: z.array(summary) }),
					)
				).results,
		),
		group: memoize((groupId: string) =>
			tmdb(`tv/episode_group/${encodeURIComponent(groupId)}`, group),
		),
		cacheTvdb: async (showId, episodeId, tvdbId, expectedTvdbId) => {
			// Fresh TMDB evidence may correct an old mapping, but never overwrite a value
			// that changed since the catalog read or resurrect a removed episode.
			const result = await run(
				`UPDATE episode SET tvdb_id = ? WHERE show_id = ? AND tmdb_id = ? AND removed_at IS NULL AND ${expectedTvdbId == null ? "tvdb_id IS NULL" : "tvdb_id = ?"}`,
				[
					tvdbId,
					showId,
					episodeId,
					...(expectedTvdbId == null ? [] : [expectedTvdbId]),
				],
			)
			if (result.rowcount !== 1) return false
			await run(
				"UPDATE episode SET tvdb_id = NULL WHERE show_id = ? AND tmdb_id <> ? AND tvdb_id = ?",
				[showId, episodeId, tvdbId],
			)
			return true
		},
	})
}

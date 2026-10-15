import { z } from "zod"
import {
	TMDB_TIMEOUT_DEFAULT_MS,
	timeoutSetting,
	withBackendTimeout,
} from "../../utils/backend-timeout.ts"
import {
	type CatalogEpisode,
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

/** One resolver per preview: no process-wide data or credentials retained. */
export function createCatalogEpisodeResolver() {
	const episodes = new Map<number, Promise<CatalogEpisode[]>>()
	const finds = new Map<number, ReturnType<typeof find>>()
	const lists = new Map<number, ReturnType<typeof list>>()
	const groups = new Map<string, ReturnType<typeof details>>()
	const find = (tvdbId: number) =>
		tmdb(
			`find/${tvdbId}`,
			z.object({
				tv_episode_results: z.array(z.object({ id, show_id: id })),
			}),
			{ external_source: "tvdb_id" },
		)
	const list = (showId: number) =>
		tmdb(`tv/${showId}/episode_groups`, z.object({ results: z.array(summary) }))
	const details = (groupId: string) =>
		tmdb(`tv/episode_group/${encodeURIComponent(groupId)}`, group)
	return createEpisodeResolver({
		episodes: (showId) => {
			let result = episodes.get(showId)
			if (!result) {
				result = select<CatalogEpisode>(
					"SELECT tmdb_id, show_id, season_number, episode_number, name, tvdb_id FROM episode WHERE show_id = ? AND removed_at IS NULL LIMIT 50001",
					[showId],
				)
				episodes.set(showId, result)
			}
			return result
		},
		findTvdb: (tvdbId) => {
			let result = finds.get(tvdbId)
			if (!result) {
				result = find(tvdbId)
				finds.set(tvdbId, result)
			}
			return result
		},
		cacheTvdb: async (showId, episodeId, tvdbId) => {
			// Never overwrite another identity or resurrect a removed episode. Existing DB
			// helpers provide the timeout/error handling; no direct database client here.
			await run(
				"UPDATE episode SET tvdb_id = ? WHERE show_id = ? AND tmdb_id = ? AND removed_at IS NULL AND tvdb_id IS NULL",
				[tvdbId, showId, episodeId],
			)
		},
		groups: async (showId) => {
			let result = lists.get(showId)
			if (!result) {
				result = list(showId)
				lists.set(showId, result)
			}
			return (await result).results
		},
		group: (groupId) => {
			let result = groups.get(groupId)
			if (!result) {
				result = details(groupId)
				groups.set(groupId, result)
			}
			return result
		},
	})
}

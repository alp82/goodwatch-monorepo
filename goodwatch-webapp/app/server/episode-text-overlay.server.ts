import { createLocaleSourceCache } from "./locale-source-cache.server.ts"
import { presentationLanguage } from "../utils/media-presentation.ts"
import type {
	EpisodeTextReader,
	EpisodeTextTranslation,
} from "../utils/episode-text-overlay.ts"
import { cached, getRedisCluster } from "../utils/cache.ts"
import { query } from "../utils/crate.ts"
import {
	overlayEpisodeText as overlayCore,
	overlayAlignedGrid as overlayGridCore,
	overlayEpisodeTextGroups as overlayGroupsCore,
	type StableEpisodeText,
} from "../utils/episode-text-overlay.ts"
export type {
	EpisodeTextPresentation,
	StableEpisodeText,
	EpisodeTextTranslation,
	EpisodeTextReader,
} from "../utils/episode-text-overlay.ts"
export { createEpisodeTextReader } from "../utils/episode-text-overlay.ts"
const availableTables = async () =>
	(
		await cached({
			name: "episode-text-source-tables-v1",
			params: {},
			ttlMinutes: 5,
			staleMinutes: 0,
			target: async () => ({
				tables: (
					await query<{ table_name: string }>(
						"SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc' AND table_name IN ('season_translation', 'episode_translation')",
					)
				).map((row) => row.table_name),
			}),
		})
	).tables
const textCache = createLocaleSourceCache<EpisodeTextTranslation[]>(
	getRedisCluster,
	{
		namespace: "episode-text-title-v2",
		validate: (value): value is EpisodeTextTranslation[] =>
			Array.isArray(value),
	},
)
async function readTexts(
	kind: "season" | "episode",
	refs: { showId: number; id: number }[],
	language: string,
) {
	if (presentationLanguage(language) === "en" || !refs.length) return []
	const table = `${kind}_translation`
	if (!(await availableTables()).includes(table)) return []
	const keyOf = (ref: { showId: number; id: number }) =>
		`${kind}:${ref.showId}:${ref.id}`
	const hits = await textCache.read(refs.map(keyOf), language)
	const missing = refs.filter((ref) => !hits.has(keyOf(ref)))
	if (missing.length) {
		const rows = await query<EpisodeTextTranslation>(
			`SELECT show_id, tmdb_id, language_code, country_code, name, overview FROM ${table} WHERE show_id = ANY(?) AND tmdb_id = ANY(?) AND language_code = ?`,
			[
				[...new Set(missing.map((r) => r.showId))] as never,
				[...new Set(missing.map((r) => r.id))] as never,
				language.split("-")[0],
			],
		)
		const entries = new Map(
			missing.map((ref) => [keyOf(ref), [] as EpisodeTextTranslation[]]),
		)
		for (const row of rows)
			entries.get(`${kind}:${row.show_id}:${row.tmdb_id}`)?.push(row)
		await textCache.write(entries, language)
		for (const [key, value] of entries) hits.set(key, value)
	}
	return [...hits.values()].flat()
}
const readEpisodeText: EpisodeTextReader = (kind, showId, ids, language) =>
	readTexts(
		kind,
		ids.map((id) => ({ showId, id })),
		language,
	)

export function overlayEpisodeText<T extends StableEpisodeText>(
	kind: "season" | "episode",
	showId: number,
	rows: readonly T[],
	language: string,
) {
	return overlayCore(kind, showId, rows, language, readEpisodeText)
}
export function overlayAlignedGrid(
	grid: import("./episode-grid.server").EpisodeGrid,
	language: string,
) {
	return overlayGridCore(grid, language, readEpisodeText)
}

export async function overlayEpisodeTextGroups<T extends StableEpisodeText>(
	kind: "season" | "episode",
	groups: import("../utils/episode-text-overlay").EpisodeTextGroup<T>[],
	language: string,
) {
	return overlayGroupsCore(kind, groups, language, readTexts)
}

export const resetEpisodeTextCacheForTest = () => textCache.clear()

import { cached } from "../utils/cache.ts"
import { query } from "../utils/crate.ts"
import {
	createEpisodeTextReader,
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
const readEpisodeText = createEpisodeTextReader(query, availableTables)

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
	return overlayGroupsCore(
		kind,
		groups,
		language,
		async (kind, refs, selected) => {
			const table = `${kind}_translation`
			if (!(await availableTables()).includes(table)) return []
			return query<
				import("../utils/episode-text-overlay").EpisodeTextTranslation
			>(
				`SELECT show_id, tmdb_id, language_code, country_code, name, overview FROM ${table} WHERE show_id = ANY(?) AND tmdb_id = ANY(?) AND language_code = ?`,
				[
					[...new Set(refs.map((r) => r.showId))] as never,
					refs.map((r) => r.id) as never,
					selected.split("-")[0],
				],
			)
		},
	)
}

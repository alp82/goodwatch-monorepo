import { applyCorrections } from "./feedback/apply-corrections.server"
import { createLocaleSourceCache } from "./locale-source-cache.server.ts"
import { presentationLanguage } from "../utils/media-presentation.ts"
import type {
	EpisodeTextReader,
	EpisodeTextTranslation,
} from "../utils/episode-text-overlay.ts"
import { cached, getRedisCluster, withRedisDeadline } from "../utils/cache.ts"
import { overlayQuery as query } from "./media-overlay-query.server.ts"
import {
	withMediaReadHealth,
	noteMediaReadFailure,
} from "./media-read-health.server.ts"
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
		namespace: "episode-text-show-v3",
		deadline: withRedisDeadline,
		maxValueBytes: 4 * 1024 * 1024,
		memoryBytes: 16 * 1024 * 1024,
		maxEntries: 128,
		validate: (value): value is EpisodeTextTranslation[] =>
			Array.isArray(value),
	},
)
async function readTextsUnchecked(
	kind: "season" | "episode",
	refs: { showId: number; id: number }[],
	language: string,
) {
	if (presentationLanguage(language) === "en" || !refs.length) return []
	const table = `${kind}_translation`
	if (!(await availableTables()).includes(table)) return []
	const showIds = [...new Set(refs.map((ref) => ref.showId))]
	const hits = await textCache.load(
		showIds.map((id) => `${kind}:${id}`),
		language,
		async (missing) => {
			const ids = missing.map((key) => Number(key.split(":")[1]))
			const rows = await query<EpisodeTextTranslation>(
				`SELECT show_id, tmdb_id, language_code, country_code, name, overview FROM ${table} WHERE show_id = ANY(?) AND language_code = ?`,
				[ids as never, language.split("-")[0]],
			)
			const entries = new Map(
				missing.map((key) => [key, [] as EpisodeTextTranslation[]]),
			)
			for (const row of rows) entries.get(`${kind}:${row.show_id}`)?.push(row)
			return entries
		},
	)
	const wanted = new Set(refs.map((ref) => `${ref.showId}:${ref.id}`))
	return [...hits.values()].flatMap((rows) =>
		rows.filter((row) => wanted.has(`${row.show_id}:${row.tmdb_id}`)),
	)
}
async function readTexts(...args: Parameters<typeof readTextsUnchecked>) {
	try {
		return await readTextsUnchecked(...args)
	} catch (error) {
		// Joined source work rejects in the owner's async scope. Mark every reader
		// before the pure overlay handles that rejection as canonical fallback.
		noteMediaReadFailure()
		throw error
	}
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
	return withMediaReadHealth(
		async () => applyCorrections({ kind: "show", id: showId }, await overlayCore(kind, showId, rows, language, readEpisodeText)),
		{ inheritFailure: true, overlay: true },
	)
}
export function overlayAlignedGrid(
	grid: import("./episode-grid.server").EpisodeGrid,
	language: string,
) {
	return withMediaReadHealth(
		async () => applyCorrections({ kind: "show", id: grid.showId }, await overlayGridCore(grid, language, readEpisodeText)),
		{ inheritFailure: true, overlay: true },
	)
}

export async function overlayEpisodeTextGroups<T extends StableEpisodeText>(
	kind: "season" | "episode",
	groups: import("../utils/episode-text-overlay").EpisodeTextGroup<T>[],
	language: string,
) {
	return withMediaReadHealth(
		() => overlayGroupsCore(kind, groups, language, readTexts),
		{ inheritFailure: true, overlay: true },
	)
}

export const resetEpisodeTextCacheForTest = () => textCache.clear()

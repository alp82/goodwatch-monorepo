import {
	translationCandidates,
	type OverlayQuery,
} from "./media-overlay-core.ts"
import {
	presentationLanguage,
	type FieldPresentation,
} from "./media-presentation.ts"
export interface EpisodeTextPresentation {
	name: FieldPresentation
	overview: FieldPresentation
}
export interface StableEpisodeText {
	tmdb_id?: number
	id?: number
	name?: string | null
	overview?: string | null
	textPresentation?: EpisodeTextPresentation
}
export interface EpisodeTextTranslation {
	show_id: number
	tmdb_id: number
	language_code: string
	country_code: string
	name: string | null
	overview: string | null
}
export type EpisodeTextReader = (
	kind: "season" | "episode",
	showId: number,
	ids: number[],
	language: string,
) => Promise<EpisodeTextTranslation[]>
const canonical = (): FieldPresentation => ({
	language: "en",
	source: "canonical",
	fallback: true,
})

/** Only canonical, already aligned membership is iterated. Translation-only IDs cannot introduce an episode. */
export async function overlayEpisodeText<T extends StableEpisodeText>(
	kind: "season" | "episode",
	showId: number,
	rows: readonly T[],
	language: string,
	read: EpisodeTextReader,
): Promise<(T & { textPresentation: EpisodeTextPresentation })[]> {
	const selected = presentationLanguage(language)
	const ids = [
		...new Set(
			rows
				.map((row) => row.tmdb_id ?? row.id)
				.filter(
					(id): id is number => Number.isSafeInteger(id) && Number(id) > 0,
				),
		),
	].sort((a, b) => a - b)
	const translations: EpisodeTextTranslation[] = []
	for (let start = 0; start < ids.length; start += 200) {
		try {
			translations.push(
				...(await read(kind, showId, ids.slice(start, start + 200), selected)),
			)
		} catch (error) {
			console.error("Episode text translations unavailable", {
				kind,
				showId,
				error,
			})
		}
	}
	return rows.map((row) => {
		const candidates = translationCandidates(
			translations.filter(
				(t) => t.show_id === showId && t.tmdb_id === (row.tmdb_id ?? row.id),
			),
			selected,
		)
		const name = candidates.find((t) => t.name?.trim()),
			overview = candidates.find((t) => t.overview?.trim())
		const provenance = (
			t: EpisodeTextTranslation | undefined,
		): FieldPresentation =>
			t
				? {
						language: `${t.language_code}${t.country_code ? `-${t.country_code}` : ""}`,
						source: "localized",
						fallback: false,
					}
				: canonical()
		return {
			...row,
			...(Object.prototype.hasOwnProperty.call(row, "name")
				? { name: name?.name ?? row.name }
				: {}),
			...(Object.prototype.hasOwnProperty.call(row, "overview")
				? { overview: overview?.overview ?? row.overview }
				: {}),
			textPresentation: {
				name: provenance(name),
				overview: provenance(overview),
			},
		}
	})
}

/** Injection seam also proves at most one translation query per table and batch. No speculative query against missing tables. */
export function createEpisodeTextReader(
	read: OverlayQuery,
	available: () => Promise<readonly string[]>,
): EpisodeTextReader {
	return async (kind, showId, ids, language) => {
		const table = `${kind}_translation`
		if (!(await available()).includes(table)) return []
		return read<EpisodeTextTranslation>(
			`SELECT show_id, tmdb_id, language_code, country_code, name, overview FROM ${table} WHERE show_id = ? AND tmdb_id = ANY(?) AND language_code = ?`,
			[showId, ids as never, language.split("-")[0]],
		)
	}
}
/** Grid names receive TMDB overlays only when the selected, reviewed presentation proved a stable TMDB id. */
export async function overlayAlignedGrid(
	grid: import("../server/episode-grid.server").EpisodeGrid,
	language: string,
	read: EpisodeTextReader,
): Promise<import("../server/episode-grid.server").EpisodeGrid> {
	const rows = [...grid.seasons.flatMap((s) => s.episodes), ...grid.specials]
	const texts = await overlayEpisodeText(
		"episode",
		grid.showId,
		rows.map((e) => ({ id: e.tmdbId, name: e.name })),
		language,
		read,
	)
	let index = 0
	return {
		...grid,
		seasons: grid.seasons.map((s) => ({
			...s,
			episodes: s.episodes.map((e) => {
				const text = texts[index++]
				return {
					...e,
					name: text.name,
					nameLanguage: e.tmdbId ? text.textPresentation.name.language : "und",
				}
			}),
		})),
		specials: grid.specials.map((e) => {
			const text = texts[index++]
			return {
				...e,
				name: text.name,
				nameLanguage: e.tmdbId ? text.textPresentation.name.language : "und",
			}
		}),
	}
}

export interface EpisodeTextGroup<T extends StableEpisodeText> {
	showId: number
	rows: readonly T[]
}
export type EpisodeGroupsReader = (
	kind: "season" | "episode",
	references: { showId: number; id: number }[],
	language: string,
) => Promise<EpisodeTextTranslation[]>
/** Several shows' Next episode rows share bounded table reads; numbers never identify a translation. */
export async function overlayEpisodeTextGroups<T extends StableEpisodeText>(
	kind: "season" | "episode",
	groups: EpisodeTextGroup<T>[],
	language: string,
	read: EpisodeGroupsReader,
) {
	const refs = [
		...new Map(
			groups.flatMap((group) =>
				group.rows.flatMap((row) => {
					const id = row.id ?? row.tmdb_id
					return id
						? [[`${group.showId}:${id}`, { showId: group.showId, id }] as const]
						: []
				}),
			),
		).values(),
	]
	const translations: EpisodeTextTranslation[] = []
	for (let i = 0; i < refs.length; i += 200) {
		try {
			translations.push(
				...(await read(
					kind,
					refs.slice(i, i + 200),
					presentationLanguage(language),
				)),
			)
		} catch (error) {
			console.error("Episode group translations unavailable", { kind, error })
		}
	}
	return Promise.all(
		groups.map(async (group) => ({
			showId: group.showId,
			rows: await overlayEpisodeText(
				kind,
				group.showId,
				group.rows,
				language,
				async () => translations,
			),
		})),
	)
}

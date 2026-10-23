import { MOOD_BY_KEY, moodsOf } from "../../domain/moods"
import { THEMES, themeMaskOf } from "../../domain/themes-styles"
import { getEpisodeGrid } from "../episode-grid.server"
import { searchQuery } from "../combined-search/catalog.server"
import type { MovieResult, ShowResult } from "../types/details-types"
import {
	compactTitleDetails,
	DEFAULT_TITLE_INCLUDE,
	personLink,
	titleSeasons,
} from "./title-details.ts"
import { optionalTitlePart } from "../title-page-budget.ts"
import type { ReadArgs } from "./tools.server.ts"

export async function richerTitleDetails(
	media: MovieResult | ShowResult,
	origin: string,
	args: ReadArgs,
) {
	const include = args.include ?? [...DEFAULT_TITLE_INCLUDE]
	const partBudgetMs = 1000
	const [analysis, creators, grid] = await Promise.all([
		include.includes("analysis")
			? optionalTitlePart(
					"analysis",
					(signal) =>
						searchQuery<{ essence_text: string | null }>(
							`SELECT essence_text FROM ${
								media.mediaType === "movie" ? "movie" : "show"
							} WHERE tmdb_id = ?`,
							[media.details.tmdb_id],
							signal,
						),
					partBudgetMs,
			  )
			: null,
		include.includes("cast") && media.mediaType === "show"
			? optionalTitlePart(
					"creators",
					async (signal) => {
						const credits = await searchQuery<{ id: number }>(
							`SELECT DISTINCT person_tmdb_id AS id FROM person_worked_on
					WHERE media_type = 'show' AND media_tmdb_id = ? AND job = 'Creator'`,
							[media.details.tmdb_id],
							signal,
						)
						const ids = [...new Set(credits.map(({ id }) => id))]
						if (!ids.length) return []
						signal.throwIfAborted()
						// Keep the limit after resolving people: orphan credits must not displace existing creators.
						return searchQuery<{ id: number; name: string }>(
							`SELECT DISTINCT tmdb_id AS id, name FROM person WHERE tmdb_id IN (${ids
								.map(() => "?")
								.join(", ")}) ORDER BY tmdb_id LIMIT 10`,
							ids,
							signal,
						)
					},
					partBudgetMs,
			  )
			: null,
		media.mediaType === "show" &&
		(include.includes("seasons") || include.includes("episodes"))
			? optionalTitlePart(
					"episode grid",
					() => getEpisodeGrid({ showId: String(media.details.tmdb_id) }),
					partBudgetMs,
			  )
			: null,
	])
	const fp = media.fingerprint
	const themeMask = themeMaskOf(fp?.scores, media.details.genres)
	return {
		...compactTitleDetails(media, origin, args),
		...(creators?.complete
			? { creators: creators.value.map((person) => personLink(person, origin)) }
			: {}),
		...(analysis?.complete
			? {
					title_analysis: {
						available: !!fp,
						summary: analysis.value[0]?.essence_text ?? null,
						tags: fp?.essenceTags ?? [],
						moods: moodsOf(fp?.scores, media.details.genres).map(
							(key) => MOOD_BY_KEY[key].name,
						),
						themes: THEMES.filter((_, i) => (themeMask & (1 << i)) !== 0).map(
							(theme) => theme.name,
						),
						tropes: media.details.tropes ?? [],
						trope_count: media.details.tropes_count ?? 0,
					},
			  }
			: {}),
		...(media.mediaType === "show" && grid?.complete
			? titleSeasons(media, grid.value, { ...args, include })
			: {}),
	}
}

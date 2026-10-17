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
import type { ReadArgs } from "./tools.server.ts"

export async function richerTitleDetails(
	media: MovieResult | ShowResult,
	origin: string,
	args: ReadArgs,
) {
	const include = args.include ?? [...DEFAULT_TITLE_INCLUDE]
	const [analysis, creators, grid] = await Promise.all([
		include.includes("analysis")
			? searchQuery<{ essence_text: string | null }>(
					`SELECT essence_text FROM ${media.mediaType === "movie" ? "movie" : "show"} WHERE tmdb_id = ?`,
					[media.details.tmdb_id],
				)
			: [],
		include.includes("cast") && media.mediaType === "show"
			? searchQuery<{ id: number; name: string }>(
					`SELECT DISTINCT p.tmdb_id AS id, p.name FROM person_worked_on c JOIN person p ON c.person_tmdb_id = p.tmdb_id
			WHERE c.media_type = 'show' AND c.media_tmdb_id = ? AND c.job = 'Creator' ORDER BY p.tmdb_id LIMIT 10`,
					[media.details.tmdb_id],
				)
			: [],
		media.mediaType === "show" &&
		(include.includes("seasons") || include.includes("episodes"))
			? getEpisodeGrid({ showId: String(media.details.tmdb_id) })
			: null,
	])
	const fp = media.fingerprint
	const themeMask = themeMaskOf(fp?.scores, media.details.genres)
	return {
		...compactTitleDetails(media, origin, args),
		...(include.includes("cast") && media.mediaType === "show"
			? { creators: creators.map((person) => personLink(person, origin)) }
			: {}),
		...(include.includes("analysis")
			? {
					title_analysis: {
						available: !!fp,
						summary: analysis[0]?.essence_text ?? null,
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
		...(media.mediaType === "show" &&
		(include.includes("seasons") || include.includes("episodes"))
			? titleSeasons(media, grid, { ...args, include })
			: {}),
	}
}

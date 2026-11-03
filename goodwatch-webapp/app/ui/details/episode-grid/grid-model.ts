import type { PageEpisode } from "~/domain/tracking/show-page"
import type { Season } from "~/ui/tracking/store"

/** What the season overview reads of the member's watches; guests supply an empty history. */
export interface GridModel {
	tracked: boolean
	nextId: number | null
	view: { watched: ReadonlySet<number> }
	aired: (episode: PageEpisode) => boolean
	count: (season: Season) => {
		total: number
		aired: number
		watched: number
		done: boolean
	}
	seasonScore: (season: number) => number | null
}

/** A season's chip: its own season score where there is one, else the average of its rated episodes. */
export function seasonAverage(model: GridModel, season: Season): number | null {
	const own = model.seasonScore(season.number)
	if (own !== null) return own
	const rated = season.episodes.filter((e) => e.rating !== null)
	return rated.length
		? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length
		: null
}

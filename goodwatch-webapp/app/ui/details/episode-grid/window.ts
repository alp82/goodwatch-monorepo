// The part of a long episode grid that the show page renders on the server. Search engines read only the first part
// of a page (Googlebot stops at 2 MB of HTML), and the grid sits before the cast, related titles and questions.
//
// A grid within the byte budget renders whole: that is every scripted show, The Simpsons and long anime included.
// Only the extreme ones are cut (daily talk, news, soaps and wrestling with thousands of rated episodes): the part is
// the newest seasons within the budget, or, when the newest season alone is over it, that season's latest episodes.
// Specials are left out of a part. The rest of the grid loads on request (useWholeEpisodeGrid).
import type { EpisodeGrid, GridSeason } from "~/server/episode-grid.server"
import { estimateGridBytes } from "~/ui/details/episode-grid/layout"
import { miniatureScores } from "~/ui/details/episode-grid/scale"

/**
 * The bytes the grid may add to a show page. A show page without its grid is about 450 KB, so the page stays under
 * about 1.5 MB, and the cast, related titles and questions after the grid end before 1.8 MB.
 */
export const EPISODE_GRID_BUDGET = 1_000_000

const ratedIn = (seasons: GridSeason[]) =>
	seasons.reduce((count, season) => count + season.episodes.length, 0)

/** The grid with only `seasons`, its columns starting at `firstEpisodeNumber` when the one season is cut. */
const partOf = (
	grid: EpisodeGrid,
	seasons: GridSeason[],
	firstEpisodeNumber?: number,
): EpisodeGrid => ({
	...grid,
	seasons,
	specials: [],
	maxEpisodeNumber: Math.max(
		0,
		...seasons.map((season) => season.maxEpisodeNumber),
	),
	hasEpisodeZero:
		firstEpisodeNumber === undefined &&
		seasons.some((season) => season.episodes[0]?.number === 0),
	...(firstEpisodeNumber !== undefined && {
		window: {
			seasons: 0,
			episodes: 0,
			hiddenSeasons: 0,
			hiddenEpisodes: 0,
			firstEpisodeNumber,
			miniature: [],
		},
	}),
})

/** The grid as the show page renders it first: the whole grid when it fits the budget, else its newest part. */
export function windowEpisodeGrid(
	grid: EpisodeGrid,
	budget: number = EPISODE_GRID_BUDGET,
): EpisodeGrid {
	if (estimateGridBytes(grid) <= budget) return grid

	// "More" (a negative number) holds episodes outside the shown seasons; it is not the newest season.
	const numbered = grid.seasons.filter((season) => season.number >= 0)
	const candidates = numbered.length ? numbered : grid.seasons
	let kept: GridSeason[] = []
	for (let i = candidates.length - 1; i >= 0; i--) {
		const next = [candidates[i], ...kept]
		if (estimateGridBytes(partOf(grid, next)) > budget) break
		kept = next
	}

	let firstEpisodeNumber: number | undefined
	if (!kept.length) {
		// The newest season alone is over the budget: keep the most of its latest episodes that fit.
		const newest = candidates[candidates.length - 1]
		const latest = (count: number) => [
			{
				...newest,
				episodes: newest.episodes.slice(newest.episodes.length - count),
			},
		]
		const fits = (count: number) => {
			const seasons = latest(count)
			return (
				estimateGridBytes(
					partOf(grid, seasons, seasons[0].episodes[0].number),
				) <= budget
			)
		}
		let low = 1
		let high = newest.episodes.length - 1
		while (low < high) {
			const middle = Math.ceil((low + high) / 2)
			if (fits(middle)) low = middle
			else high = middle - 1
		}
		kept = latest(low)
		firstEpisodeNumber = kept[0].episodes[0].number
	}

	const total = ratedIn(grid.seasons) + grid.specials.length
	return {
		...partOf(grid, kept, firstEpisodeNumber),
		window: {
			seasons: grid.seasons.length,
			episodes: total,
			hiddenSeasons: grid.seasons.length - kept.length,
			hiddenEpisodes: total - ratedIn(kept),
			...(firstEpisodeNumber !== undefined && { firstEpisodeNumber }),
			miniature: miniatureScores(grid),
		},
	}
}

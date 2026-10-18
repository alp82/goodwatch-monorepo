// The first part of a long episode grid, which the show page renders on the server. Search engines read only the
// first part of a page (Googlebot stops at 2 MB of HTML), and the grid renders every cell twice, once per
// orientation. A daily show has thousands of episodes, and some shows put all of them in one IMDb season numbered
// into the thousands, so the whole grid can be several megabytes and push cast, related titles and questions out
// of reach.
//
// The part is the newest seasons that fit both limits. When the newest season alone doesn't fit, it is cut to its
// latest episode numbers. Specials are left out of a part. The rest of the grid loads on request
// (useWholeEpisodeGrid).
import type { EpisodeGrid, GridSeason } from "~/server/episode-grid.server"
import { miniatureScores } from "~/ui/details/episode-grid/scale"

export interface GridLimits {
	/** Rated episodes. Each costs about 1 KB of HTML: a tile in each orientation. */
	episodes: number
	/** Cells: seasons times episode columns. An empty cell costs about 0.6 KB with its number headers. */
	cells: number
}

/** Keeps the grid's part of a show page's HTML to about 500 KB at most, and the page under 1 MB. */
export const EPISODE_GRID_LIMITS: GridLimits = { episodes: 360, cells: 600 }

const ratedIn = (seasons: GridSeason[]) =>
	seasons.reduce((count, season) => count + season.episodes.length, 0)

const firstNumber = (seasons: GridSeason[]) =>
	seasons.some((season) => season.episodes[0]?.number === 0) ? 0 : 1

const cellsOf = (seasons: GridSeason[], first: number) =>
	seasons.length *
	(Math.max(0, ...seasons.map((season) => season.maxEpisodeNumber)) - first + 1)

/** The first episode number the grid's columns start at. */
export const gridFirstEpisode = (grid: EpisodeGrid) =>
	grid.window?.firstEpisodeNumber ?? (grid.hasEpisodeZero ? 0 : 1)

/** The grid's episode columns, from its first episode number to its widest season's last. */
export const gridColumns = (grid: EpisodeGrid) =>
	grid.maxEpisodeNumber - gridFirstEpisode(grid) + 1

/** The grid as the show page renders it first: the whole grid when it fits the limits, else its newest part. */
export function windowEpisodeGrid(
	grid: EpisodeGrid,
	limits: GridLimits = EPISODE_GRID_LIMITS,
): EpisodeGrid {
	const total = ratedIn(grid.seasons) + grid.specials.length
	if (
		total <= limits.episodes &&
		cellsOf(grid.seasons, firstNumber(grid.seasons)) + grid.specials.length <=
			limits.cells
	)
		return grid

	// "More" (a negative number) holds episodes outside the shown seasons; it is not the newest season.
	const numbered = grid.seasons.filter((season) => season.number >= 0)
	const candidates = numbered.length ? numbered : grid.seasons
	let kept: GridSeason[] = []
	for (let i = candidates.length - 1; i >= 0; i--) {
		const next = [candidates[i], ...kept]
		if (
			ratedIn(next) > limits.episodes ||
			cellsOf(next, firstNumber(next)) > limits.cells
		)
			break
		kept = next
	}

	let firstEpisodeNumber: number | undefined
	if (!kept.length) {
		// The newest season alone is too long: keep its latest episode numbers that fit both limits.
		const newest = candidates[candidates.length - 1]
		const { episodes } = newest
		const byCells = newest.maxEpisodeNumber - limits.cells + 1
		const byEpisodes =
			episodes.length > limits.episodes
				? episodes[episodes.length - limits.episodes].number
				: Number.NEGATIVE_INFINITY
		const start = Math.max(byCells, byEpisodes, firstNumber([newest]))
		kept = [
			{
				...newest,
				episodes: episodes.filter((episode) => episode.number >= start),
			},
		]
		if (start > firstNumber([newest])) firstEpisodeNumber = start
	}

	const shown = ratedIn(kept)
	return {
		...grid,
		seasons: kept,
		specials: [],
		maxEpisodeNumber: Math.max(
			0,
			...kept.map((season) => season.maxEpisodeNumber),
		),
		hasEpisodeZero: firstEpisodeNumber === undefined && firstNumber(kept) === 0,
		window: {
			seasons: grid.seasons.length,
			episodes: total,
			hiddenSeasons: grid.seasons.length - kept.length,
			hiddenEpisodes: total - shown,
			...(firstEpisodeNumber !== undefined && { firstEpisodeNumber }),
			miniature: miniatureScores(grid),
		},
	}
}

// Estimated server HTML plus loader data for the shared wrapping grid. There is one
// tile per cataloged episode; missing episode numbers never generate empty cells.
// grid-size.test.ts checks these estimates against real server renders.
import type { EpisodeGrid } from "~/server/episode-grid.server"

export function estimateGridBytes(grid: EpisodeGrid): number {
	let bytes = 2_000 + grid.seasons.length * 2_300
	for (const season of grid.seasons)
		for (const episode of season.episodes)
			bytes += 295 + 3 * (episode.name || "Untitled").length
	// Specials are collapsed initially; their names occur only in loader data.
	for (const special of grid.specials) bytes += 80 + special.name.length
	return bytes
}

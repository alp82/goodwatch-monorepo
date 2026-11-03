// Estimated server HTML plus loader data for the season overview. Each season is one row (its label, an empty canvas
// and its chip) and carries its episodes as a text list for readers and search engines: one line per cataloged
// episode, its code, name and score; missing episode numbers never add lines. grid-size.test.ts checks these
// estimates against real server renders.
import type { EpisodeGrid } from "~/server/episode-grid.server"

export function estimateGridBytes(grid: EpisodeGrid): number {
	// The section's frame, then each season's row; an episode's name occurs in its line and in the loader data.
	let bytes = 1_800 + grid.seasons.length * 790
	for (const season of grid.seasons)
		for (const episode of season.episodes)
			bytes += 69 + 2 * (episode.name || "Untitled").length
	// Specials are collapsed initially; their names occur only in loader data.
	for (const special of grid.specials) bytes += 80 + special.name.length
	return bytes
}

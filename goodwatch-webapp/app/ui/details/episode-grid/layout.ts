// The episode grid's columns (one per episode number, in the rows table) and what they cost in HTML.
//
// A run of episode numbers that no season has an episode at becomes one narrow gap column. Daily soaps number their
// episodes into the thousands with only some of them rated: Coronation Street's one IMDb season runs to 11,599 with
// 162 rated, which was 11,437 empty cells per orientation. A short run (a missing episode 5) keeps its cells, so an
// ordinary show's grid looks as it always did.
import type { EpisodeGrid } from "~/server/episode-grid.server"

export type GridColumn =
	| { kind: "episode"; number: number }
	| { kind: "gap"; from: number; to: number }

/** A run of at least this many episode numbers without an episode in any season becomes one gap column. */
export const GAP_RUN = 3

/** The first episode number the grid's columns start at. */
export const gridFirstEpisode = (grid: EpisodeGrid) =>
	grid.window?.firstEpisodeNumber ?? (grid.hasEpisodeZero ? 0 : 1)

/** The grid's columns, from its first episode number to its widest season's last. */
export function gridLayout(grid: EpisodeGrid): GridColumn[] {
	const used = new Set<number>()
	for (const season of grid.seasons)
		for (const episode of season.episodes) used.add(episode.number)
	const columns: GridColumn[] = []
	let run: number | null = null
	const close = (end: number) => {
		if (run === null) return
		if (end - run >= GAP_RUN)
			columns.push({ kind: "gap", from: run, to: end - 1 })
		else
			for (let n = run; n < end; n++)
				columns.push({ kind: "episode", number: n })
		run = null
	}
	for (let n = gridFirstEpisode(grid); n <= grid.maxEpisodeNumber; n++) {
		if (used.has(n)) {
			close(n)
			columns.push({ kind: "episode", number: n })
		} else run ??= n
	}
	close(grid.maxEpisodeNumber + 1)
	return columns
}

// What the markup costs, in bytes, measured on the server render (grid-size.test.ts keeps the estimate within 10%
// of the render). Each HTML cost counts both orientations.
const COST = {
	/** An episode tile, without its name, which is in each tile's accessible name ("Untitled" without one). */
	tile: 404,
	/** An unrated number inside a season. */
	gap: 234,
	/** A cell past a season's last episode. */
	pad: 42,
	/** A gap column's cell in a season that reaches it. */
	run: 313,
	/** An episode column's header and row label. */
	header: 175,
	/** A gap column's header and row label. */
	runHeader: 329,
	/** A season's two labels with their scores. */
	season: 1030,
	/** The section around the tables, with its style rule. */
	frame: 5400,
	/** An episode in the loader data, without its name. */
	data: 17,
}

/** The bytes an episode adds: its two tiles and its loader data. */
const episodeBytes = (name: string) =>
	COST.tile + COST.data + 2 * (name || "Untitled").length + name.length

/** About how many bytes the grid adds to the show page: its HTML in both orientations and its loader data. */
export function estimateGridBytes(grid: EpisodeGrid): number {
	const columns = gridLayout(grid)
	let bytes = COST.frame + grid.seasons.length * COST.season
	for (const column of columns)
		bytes += column.kind === "gap" ? COST.runHeader : COST.header
	for (const season of grid.seasons) {
		const at = new Map(season.episodes.map((e) => [e.number, e]))
		for (const column of columns) {
			if (column.kind === "gap") {
				bytes += column.from <= season.maxEpisodeNumber ? COST.run : COST.pad
				continue
			}
			const episode = at.get(column.number)
			if (episode) bytes += episodeBytes(episode.name)
			else
				bytes += column.number <= season.maxEpisodeNumber ? COST.gap : COST.pad
		}
	}
	for (const special of grid.specials) bytes += episodeBytes(special.name)
	// Specials beyond the columns add rows to the columns table.
	bytes += Math.max(0, grid.specials.length - columns.length) * COST.header
	return bytes
}

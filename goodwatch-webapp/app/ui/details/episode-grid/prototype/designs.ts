// PROTOTYPE (#153) round 2: four takes on the simplified grid, picked with ?grid=e|f|g|h.
// Every design is the same responsive component: seasons as rows when the grid box is
// wide, seasons as columns when it is narrow. They differ only in the knobs below. Once
// the owner picks one, inline its choices into EpisodeGrid.tsx and delete this file.

/** How an episode cell is painted. */
export type CellStyle =
	/** Solid vibe tile, number printed on it. */
	| "filled"
	/** Neutral slate tile, number printed in the vibe colour. */
	| "ink"
	/** Small solid vibe squares without numbers; a switch prints them. */
	| "mosaic"
	/** Vibe colour washed into the surface, light number on top. */
	| "tint"

/** How the season scores from every site are revealed. */
export type SeasonReveal =
	/** The season label shows the IMDb season score; hover or tap it for every site. */
	| "label-popover"
	/** An IMDb season column; one "Scores by site" switch adds the other sites. */
	| "sites-switch"
	/** Tap a season label to open a row with every site's score under it. */
	| "expand"
	/** A filled IMDb score chip by the season label; hover or tap it for every site. */
	| "chip-popover"

export interface GridDesign {
	key: string
	name: string
	idea: string
	cell: CellStyle
	season: SeasonReveal
}

export const DESIGNS: GridDesign[] = [
	{
		key: "e",
		name: "Tiles",
		idea: "Solid vibe tiles with numbers; the season label carries the IMDb season score and opens every site's score on hover or tap.",
		cell: "filled",
		season: "label-popover",
	},
	{
		key: "f",
		name: "Ink",
		idea: "Quiet slate cells with vibe-coloured numbers, an IMDb season column, and one 'Scores by site' switch for the rest.",
		cell: "ink",
		season: "sites-switch",
	},
	{
		key: "g",
		name: "Mosaic",
		idea: "The shape of the show first: small vibe squares, numbers on hover or with a 'Numbers' switch, and seasons that expand in place.",
		cell: "mosaic",
		season: "expand",
	},
	{
		key: "h",
		name: "Tint",
		idea: "Soft vibe-tinted cells with light numbers; a filled season chip is the one strong accent and opens every site's score.",
		cell: "tint",
		season: "chip-popover",
	},
]

export const isDesignKey = (value: string | null) => DESIGNS.some((d) => d.key === value)

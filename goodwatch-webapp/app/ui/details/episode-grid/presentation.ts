import { TINT_PANEL } from "~/ui/details/tint-surface"

export const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
/** The surface of the open season in the episode grid, which the episode list sits on too: a panel on the title tint. */
export const SURFACE = TINT_PANEL

export const seasonTitle = (season: number) =>
	season === 0 ? "Specials" : season < 0 ? "Additional episodes" : `Season ${season}`
export const seasonShort = (season: number) =>
	season === 0 ? "Sp" : season < 0 ? "More" : `S${season}`

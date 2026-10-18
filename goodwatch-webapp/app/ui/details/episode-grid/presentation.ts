export const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
/** The surface of the episode grid, which the episode list sits on too. */
export const SURFACE = "bg-[#141923]"

export const seasonTitle = (season: number) =>
	season === 0
		? "Specials"
		: season < 0
			? "Additional episodes"
			: `Season ${season}`
export const seasonShort = (season: number) =>
	season === 0 ? "Sp" : season < 0 ? "More" : `S${season}`

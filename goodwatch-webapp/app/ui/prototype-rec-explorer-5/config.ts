// PROTOTYPE - throwaway. The knobs the round-5 variants turn (#180): how an island shows who it is zoomed out, how
// its fractal is arranged, and how the close-up turns the map cinematic.
import type { Arrangement } from "./wire5"

/**
 * crest   an emblem in a medallion at the island's heart, the name under it;
 * ground  the identity is the island's ground: the flag, the logo, the icon or the era's type fills the shape;
 * pin     a floating marker pin over the island, like a map app's place pin;
 * shore   the name runs along the island's shoreline in the era's or grouping's type, the emblem sits inside.
 */
export type IdentityStyle = "crest" | "ground" | "pin" | "shore"
/**
 * flood    the camera pulls back so the island fills the view; the title's backdrop floods the island, the title and
 *          its closest titles stand in the middle, a side panel holds the controls;
 * marquee  the same flood, with the title set huge over the backdrop and the controls along the bottom;
 * lens     a fisheye: the title under the lens is magnified in place, its neighbors around it, the rest of the island
 *          and the neighboring islands squeezed toward the edges.
 */
export type CinemaStyle = "flood" | "marquee" | "lens"

export type Config = {
	arr: Arrangement
	identity: IdentityStyle
	icons: "glyph" | "emoji"
	cinema: CinemaStyle
	/** Thin lines from each poster to its children, so the family reads as one cluster. */
	lines: boolean
}

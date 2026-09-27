// PROTOTYPE - throwaway. Shapes for /prototype/rec-explorer-7 (#180, round 7). Round 7 keeps round 6's `near`
// (proximity cards over a live map of backdrop-collage islands) and varies two things:
//   present  how a poster looks, and how its size, detail, and light fall off with distance from where you look
//            (the pointer, or the middle on touch) and with zoom: a lens, never a jump;
//   combine  a way to see what two islands share: a bridge island rises between them.
import type { W } from "~/ui/prototype-rec-explorer-5/wire5"

export type { W, TreeRes, DoorRes, Arrangement } from "~/ui/prototype-rec-explorer-5/wire5"
export { BRANCH, firstCount } from "~/ui/prototype-rec-explorer-5/wire5"

/**
 * lit     cards in a pool of light that follows the pointer: near it they're bright, tilt toward it and cast soft
 *         shadows away from it; further out they sink into the dark and shrink a little;
 * rise    posters lie flat in the island's surface and stand up as you come near, casting a shadow as they rise;
 * tiles   rounded tiles with a taste-match pill; far from the focus they melt into dots colored by match, so
 *         you can see where your matches cluster;
 * frames  a poster near the focus, the title's 16:9 backdrop with its name a little further, and only the name
 *         (then a line) far out: detail by distance, in three forms.
 */
export type Present = "lit" | "rise" | "tiles" | "frames"

/**
 * tap   tap "Combine" (or shift-click, or long-press on touch) and pick two islands: a bridge rises between them;
 * drag  hold an island and drop it onto another one.
 */
export type Combine = "tap" | "drag" | null

export type Config7 = { present: Present; combine: Combine }

/** The titles two islands share, as a fractal like any island's. */
export type BlendRes = {
	id: string
	/** both: titles on both islands; between: titles of either island that sit closest to both. */
	kind: "both" | "between"
	items: W[]
	par: number[]
	gen: number[]
	count: number
	ms?: number
}

/** Which renderer draws the sea: 2 WebGL2, 1 WebGL1, 0 Canvas 2D. */
export type GlLevel = 0 | 1 | 2

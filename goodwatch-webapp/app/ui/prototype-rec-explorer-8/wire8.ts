// PROTOTYPE - throwaway. Shapes for /prototype/rec-explorer-8 (#180, round 8). Round 8 keeps round 7's `bridge`
// with its `lit` posters, on a page that never scrolls, and makes combining islands part of how the map behaves
// instead of a mode behind a button. The variants differ only in how you combine (Gesture).
import type { W } from "~/ui/prototype-rec-explorer-5/wire5"

export type { W, TreeRes, DoorRes } from "~/ui/prototype-rec-explorer-5/wire5"
export { BRANCH, firstCount } from "~/ui/prototype-rec-explorer-5/wire5"
export type { GlLevel } from "~/ui/prototype-rec-explorer-7/wire7"

/**
 * select     a tap lights an island; a tap on a second lit-up pair forms the bridge; a tap on a lit island lets it go.
 *            "Go in" on the lit island (or a double tap, or zooming) flies into it;
 * stretch    a tap flies in; pulling from an island stretches a band of light that snaps to the island under it and
 *            becomes a bridge when you let go;
 * preview    a tap lights an island and every other island shows how many titles it shares with it; hovering one
 *            draws the bridge faintly with its count before a tap commits it;
 * gather     a tap flies in; islands can be picked up and pushed into each other (one finger or the mouse), or two
 *            fingers can pinch two islands together;
 * neighbors  a tap flies in, as always; inside an island, faint bridges lead off to its most interesting neighbors,
 *            and tapping one raises it;
 * triple     like select, with room for a third island: a tap on another island while a bridge stands adds it.
 */
export type Gesture = "select" | "stretch" | "preview" | "gather" | "neighbors" | "triple"

export type Config8 = { gesture: Gesture }

/** The titles two or three islands share, as a fractal like any island's. */
export type BlendRes = {
	id: string
	/** both: titles on every island; between: titles of the islands that sit closest to all of them. */
	kind: "both" | "between"
	items: W[]
	par: number[]
	gen: number[]
	count: number
	ms?: number
}

/** What every pair of islands in a grouping would share, without laying the titles out. */
export type Pair = {
	/** Titles the bridge would hold. */
	c: number
	kind: "both" | "between"
	/** How much more the two share than their sizes suggest, 0..1; ranks the "most interesting" neighbors. */
	s: number
	/** Average taste match of the shared titles, when they're on both. */
	fit: number | null
}
export type PairsRes = { pairs: Record<string, Pair>; ms?: number }

/** The key of a pair or triple, whatever order its islands were picked in. */
export const pairKey = (ids: string[]) => [...ids].sort().join("+")

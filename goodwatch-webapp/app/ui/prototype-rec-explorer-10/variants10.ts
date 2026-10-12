// PROTOTYPE - throwaway. Round 10 of the Explorer. The way of combining is settled (owner, 2026-10-12): Harbor. The
// top bar is settled too (2026-10-13): the Viewing menu, with the filters in a strip. The variants (?variant=<key>)
// are now of the selection bar, see MIX_FORMS in MixBar10.tsx.
import type { Mode10 } from "./engine10"

export interface Variant10 extends Mode10 {
	/** The grouping control frames the region alone, or the region and the middle side by side. */
	frame: "region" | "pair"
	/** Raising a combination flies the camera to the middle. */
	fly: boolean
	/** After a pick the camera goes back out to the whole world, for the next island from any group. */
	back: boolean
}

/**
 * Harbor: from far out each grouping is its islands, small. An island sails to the middle as soon as it's picked,
 * and the camera goes back out to the whole world, so the next island can come from any group. The earlier rounds'
 * other two ways (islands staying home with bands of light, and one land per grouping) are in the branch's history.
 */
export const HARBOR: Variant10 = {
	meta: "isles",
	join: "dock",
	dockFrom: 1,
	// The region alone: side by side with the middle, a region came out too small to read or pick from.
	frame: "region",
	fly: false,
	back: true,
}

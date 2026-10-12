// PROTOTYPE - throwaway. Round 10 of the Explorer: the variants (?variant=<key>). All three share the world (every
// grouping in a region of its own around a free middle) and the way of picking (tap up to three islands, from any
// regions). They differ in how a grouping looks from far out, how picked islands reach the middle, and what the
// camera does.
import type { Mode10 } from "./engine10"

export interface Variant10 extends Mode10 {
	name: string
	/** The grouping control frames the region alone, or the region and the middle side by side. */
	frame: "region" | "pair"
	/** Raising a combination flies the camera to the middle. */
	fly: boolean
	/** After a pick the camera goes back out to the whole world, for the next island from any group. */
	back: boolean
}

export const VARIANTS10: Record<string, Variant10> = {
	// From far out each grouping is its islands, small. Picked islands stay home and light up; bands of light run from
	// them to the combination in the middle, and the camera flies there.
	causeways: {
		name: "Causeways",
		meta: "isles",
		join: "home",
		dockFrom: 2,
		frame: "region",
		fly: true,
		back: false,
	},
	// From far out each grouping is one land that breaks into its islands as you come closer. Picked islands sail to
	// the middle and sit against the combination (today's bridge, moved to the middle); an outline stays at home.
	gather: {
		name: "Gather",
		meta: "lands",
		join: "dock",
		dockFrom: 2,
		frame: "region",
		fly: true,
		back: false,
	},
	// The grouping control frames the region, and an island
	// sails over as soon as it's picked. After a pick the camera goes back out to the whole world, so the next island
	// can come from any group.
	harbor: {
		name: "Harbor",
		meta: "isles",
		join: "dock",
		dockFrom: 1,
		// The region alone: side by side with the middle, a region came out too small to read or pick from.
		frame: "region",
		fly: false,
		back: true,
	},
}

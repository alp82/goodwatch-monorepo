// The six areas a fingerprint groups its traits into, with their colors and words. The interface calls them
// "areas", never "pillars".

import {
	type CoreScores,
	PILLAR_ATTRIBUTES,
	type PillarTiers,
} from "~/server/utils/fingerprint"
import * as F from "~/ui/fingerprint/fingerprintText"

export type Area = keyof PillarTiers
export type Scores = CoreScores
export type TraitKey = keyof CoreScores

/** In the order the band and the slider groups show them. */
export const AREAS: readonly Area[] = [
	"Energy",
	"Heart",
	"Humor",
	"World",
	"Craft",
	"Style",
]

export const AREA_COLOR: Record<Area, string> = {
	Energy: "#f59e0b",
	Heart: "#f43f5e",
	Humor: "#14b8a6",
	World: "#10b981",
	Craft: "#8b5cf6",
	Style: "#0ea5e9",
}

/**
 * The level word for each area and tier (0 to 4): the word the area's slider shows, and the word the band, the area
 * details, and the FAQ use for the same tier. The one place these words are defined.
 */
const LEVEL_WORD: Record<
	Area,
	readonly [string, string, string, string, string]
> = {
	Energy: ["Calm", "Low-key", "Steady", "High energy", "Relentless"],
	Heart: ["Cool", "Light", "Some heart", "Big heart", "Deeply emotional"],
	Humor: ["Serious", "A touch", "Light", "Funny", "Very funny"],
	World: ["Background", "Simple", "Solid", "Immersive", "Fully immersive"],
	Craft: ["Rough", "Plain", "Solid", "Strong", "Masterful"],
	Style: ["Plain", "Modest", "Clean", "Striking", "Stunning"],
}

/** The five level words of an area, from tier 0 to tier 4. */
export const areaLevelWords = (area: Area) => LEVEL_WORD[area]

export const areaLevelWord = (area: Area, tier: number) =>
	LEVEL_WORD[area][tier]

/**
 * A minimum tier as Discover's area filter names it ("More movies with high energy"). Not a level word: the filter
 * has three steps, and tier 4 reads as high.
 */
const FILTER_WORD: Record<number, string> = { 1: "low", 2: "medium", 3: "high" }

/** The Discover filter's minimum tier for a title at `tier` (capped at high), and its word. */
export function areaFilterTier(tier: number) {
	const minTier = Math.min(3, tier)
	return { minTier, word: FILTER_WORD[minTier] }
}

/** The traits a Humor tier is computed from, as the area's own traits. */
export const HUMOR_TRAITS: readonly TraitKey[] = PILLAR_ATTRIBUTES.Humor

// Thinking traits read as craft, not heart; spectacle reads as energy.
const AREA_OVERRIDE: Partial<Record<TraitKey, Area>> = {
	philosophical: "Craft",
	educational: "Craft",
	spectacle: "Energy",
}

/** The area a trait colors in the headline: its own formula first, then the area it explains. */
export function areaOfTrait(key: TraitKey): Area {
	const override = AREA_OVERRIDE[key]
	if (override) return override
	for (const area of AREAS) if (F.PILLAR_KEYS[area].includes(key)) return area
	for (const area of AREAS) if (F.RELATED_KEYS[area].includes(key)) return area
	return "World"
}

// The six areas a fingerprint groups its traits into, with their colors and words. The interface calls them
// "areas", never "pillars".

import type { CoreScores, PillarTiers } from "~/server/utils/fingerprint"
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

/** One word per area and tier (0 to 4), as the band and the area details name the tier. */
const LEVEL_WORD: Record<Area, readonly string[]> = {
	Energy: ["Calm", "Low-key", "Steady", "High", "Relentless"],
	Heart: ["Cool", "Reserved", "Warm", "Moving", "Profound"],
	Humor: ["None", "Rare", "Light", "Funny", "Hilarious"],
	World: ["Thin", "Simple", "Solid", "Rich", "Immersive"],
	Craft: ["Rough", "Plain", "Solid", "Strong", "Masterful"],
	Style: ["Plain", "Modest", "Clean", "Striking", "Stunning"],
}

export const areaLevelWord = (area: Area, tier: number) =>
	LEVEL_WORD[area][tier]

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

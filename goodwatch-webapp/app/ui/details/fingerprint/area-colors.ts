// The six areas' order and colors, without the words. A module of its own so a screen that only draws the colors
// (the TV's Start) doesn't load the fingerprint's text with them. areas.ts re-exports both.
import type { PillarTiers } from "~/server/utils/fingerprint"

export type Area = keyof PillarTiers

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

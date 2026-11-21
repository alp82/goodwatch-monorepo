// PROTOTYPE - throwaway (prototype/explore-r5, slot "blend-entry"). What a place's head needs to start a blend: the
// pantry (every ingredient, and whether the blend with it has a full page) and three ready partners.
import { FAMILIES, type Family, type Ingredient, same } from "../../../../kit/address"
import { type Kit, MIN_PAGE } from "../../../../kit/data.server"
import type { PlaceRef } from "../../../../kit/types"
import type { PantryGroup, PantryOption } from "../../../blend/loader.server"

const PANTRY_FAMILIES: Family[] = FAMILIES.filter((f) => f !== "trait")

export function pantryOf(kit: Kit, parts: Ingredient[]): PantryGroup[] {
	return PANTRY_FAMILIES.map((family) => ({
		family,
		options: kit
			.members(family)
			.filter((m) => !parts.some((p) => same(p, m)))
			.map((place): PantryOption => {
				const n = kit.count([...parts, place])
				return { place, state: n >= MIN_PAGE ? "full" : n > 0 ? "thin" : "none" }
			}),
	})).filter((g) => g.options.length > 0)
}

/** Near-twins of a place, by name: Romance is no partner for Romantic. */
const TWINS: [string, string][] = [
	["mood:romantic", "genre:romance"],
	["mood:scary", "genre:horror"],
	["mood:funny", "genre:comedy"],
	["mood:crime-mystery", "genre:crime"],
	["mood:crime-mystery", "genre:mystery"],
	["mood:history", "genre:history"],
	["mood:other-worlds", "genre:fantasy"],
	["mood:other-worlds", "genre:science-fiction"],
	["mood:other-worlds", "genre:sci-fi-fantasy"],
	["genre:animation", "style:animated"],
	["genre:documentary", "style:documentary"],
	["genre:family", "theme:family"],
	["genre:music", "style:music"],
	["genre:war", "theme:war"],
]
const id = (p: Ingredient) => `${p.family}:${p.slug}`
const twins = (a: Ingredient, b: Ingredient) =>
	TWINS.some(([x, y]) => (id(a) === x && id(b) === y) || (id(a) === y && id(b) === x))

/** Three partners from three different families: what this place goes well with. */
export async function partnersOf(kit: Kit, parts: Ingredient[], n = 3): Promise<PlaceRef[]> {
	const blend = await kit.blend(parts, { suggestions: 12, titles: 0 })
	const out: PlaceRef[] = []
	for (const s of blend.suggestions) {
		if (out.length >= n) break
		if (s.place.family === "genre" && s.place.slug === "tv-movie") continue
		if (s.place.family === "theme" || s.place.family === "style") continue
		if (parts.some((p) => twins(p, s.place))) continue
		if (out.some((o) => o.family === s.place.family)) continue
		out.push(s.place)
	}
	return out
}

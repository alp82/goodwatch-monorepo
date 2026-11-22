// What a single place's head needs to start a blend: the pantry (every ingredient, and whether the blend with it has a
// full page).
import { type Address, FAMILIES, type Family, type Ingredient, same } from "~/domain/browse/address"
import { type Places, MIN_PAGE } from "~/server/browse/places.server"
import type { PlaceRef } from "~/domain/browse/types"
import type { PantryGroup, PantryOption } from "~/server/browse/blend.server"
import { mapBreathing } from "./breathe"

const PANTRY_FAMILIES: Family[] = FAMILIES.filter((f) => f !== "trait")

export async function pantryOf(atlas: Places, parts: Ingredient[]): Promise<PantryGroup[]> {
	const groups: PantryGroup[] = []
	for (const family of PANTRY_FAMILIES) {
		const options = await mapBreathing(
			atlas.members(family).filter((m) => !parts.some((p) => same(p, m))),
			(place): PantryOption => {
				const n = atlas.count([...parts, place])
				return { place, state: n >= MIN_PAGE ? "full" : n > 0 ? "thin" : "none" }
			},
		)
		if (options.length) groups.push({ family, options })
	}
	return groups
}

/** What "+ Add" next to a single place's title needs: the place, and the pantry of what blends with it. */
export interface EntryData {
	parts: PlaceRef[]
	pantry: PantryGroup[]
	partners: PlaceRef[]
}

/** A blend starts from one place: a mood, a genre, a decade, a country, a service, a theme, a style, or a trope. */
export const startsBlend = (address: Address) =>
	address.view === "place" && address.parts.length === 1 && address.parts[0].family !== "trait"

export async function loadAddEntry(atlas: Places, address: Address): Promise<EntryData | null> {
	return startsBlend(address)
		? {
				parts: address.parts.map((p) => atlas.ref(p)),
				pantry: await pantryOf(atlas, address.parts),
				partners: [],
			}
		: null
}

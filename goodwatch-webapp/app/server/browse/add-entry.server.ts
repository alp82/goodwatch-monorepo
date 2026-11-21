// What a single place's head needs to start a blend: the pantry (every ingredient, and whether the blend with it has a
// full page).
import { type Address, FAMILIES, type Family, type Ingredient, same } from "~/domain/browse/address"
import { type Places, MIN_PAGE } from "~/server/browse/places.server"
import type { PlaceRef } from "~/domain/browse/types"
import type { PantryGroup, PantryOption } from "~/server/browse/blend.server"

const PANTRY_FAMILIES: Family[] = FAMILIES.filter((f) => f !== "trait")

export function pantryOf(atlas: Places, parts: Ingredient[]): PantryGroup[] {
	return PANTRY_FAMILIES.map((family) => ({
		family,
		options: atlas
			.members(family)
			.filter((m) => !parts.some((p) => same(p, m)))
			.map((place): PantryOption => {
				const n = atlas.count([...parts, place])
				return { place, state: n >= MIN_PAGE ? "full" : n > 0 ? "thin" : "none" }
			}),
	})).filter((g) => g.options.length > 0)
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

export function loadAddEntry(atlas: Places, address: Address): EntryData | null {
	return startsBlend(address)
		? {
				parts: address.parts.map((p) => atlas.ref(p)),
				pantry: pantryOf(atlas, address.parts),
				partners: [],
			}
		: null
}

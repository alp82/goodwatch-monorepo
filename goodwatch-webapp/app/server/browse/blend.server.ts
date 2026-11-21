// What a blend needs beyond its place page: the pantry (every ingredient, and whether the blend with it still has a
// full page), each part's short line, and the pantry's poster preview (`?peek=1` on a place address). Read-only.
import { FAMILIES, type Family, type Ingredient, same } from "~/domain/browse/address"
import { copyFor } from "~/domain/browse/copy-lookup"
import type { PlaceRef, ShowTitle } from "~/domain/browse/types"
import { MIN_PAGE, type Places } from "~/server/browse/places.server"

/** The families an ingredient can come from (fingerprint traits are dial internals, not ingredients). */
export const PANTRY_FAMILIES: Family[] = FAMILIES.filter((f) => f !== "trait")

export interface PantryOption {
	place: PlaceRef
	/** "full": a whole page; "thin": a handful; "none": nothing is all of it at once. */
	state: "full" | "thin" | "none"
}
export interface PantryGroup {
	family: Family
	options: PantryOption[]
}

/** The pantry's preview of one more ingredient: a few posters of what the blend with it holds. */
export interface PeekData {
	view: "peek"
	titles: ShowTitle[]
}

const id = (p: Ingredient) => `${p.family}:${p.slug}`

export function pantry(atlas: Places, parts: Ingredient[]): PantryGroup[] {
	return PANTRY_FAMILIES.map((family) => ({
		family,
		options: atlas
			.members(family)
			.filter((m) => !parts.some((p) => same(p, m)))
			.map((place): PantryOption => {
				if (!parts.length) return { place, state: "full" }
				const n = atlas.count([...parts, place])
				return {
					place,
					state: n >= MIN_PAGE ? "full" : n > 0 ? "thin" : "none",
				}
			}),
	})).filter((g) => g.options.length > 0)
}

/** Each part's short line from the copy deck, by `family:slug`. */
export function shortsOf(atlas: Places, parts: Ingredient[]) {
	const out: Record<string, string> = {}
	for (const p of parts) {
		const short = copyFor(atlas.kind, p.family, p.slug)?.short
		if (short) out[id(p)] = short
	}
	return out
}

/** Four posters of a blend, for the pantry's preview. */
export async function peekOf(atlas: Places, parts: Ingredient[]): Promise<PeekData> {
	return { view: "peek", titles: await atlas.showcase(parts, 4, { used: new Set() }) }
}

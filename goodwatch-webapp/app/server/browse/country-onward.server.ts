// What a country page shows onward: what a country goes
// well with (several pairings across families, never two that mean the same) and who lies next door on the real map.
import { type Family, type Ingredient, ing } from "~/domain/browse/address"
import type { Places } from "~/server/browse/places.server"
import type { PlaceRef, ShowTitle, TraitWord } from "~/domain/browse/types"
import { comparative } from "~/domain/browse/words"
import { SHAPE_BY_CODE } from "~/ui/browse/world-map/geometry"

export interface Pairing {
	place: PlaceRef
	/** The blend's page name: "Japanese animated movies". */
	name: string
	count: number
	titles: ShowTitle[]
}

/** How many of each family a country's pairings take, in the order they show. */
const QUOTA: [Family, number][] = [
	["genre", 2],
	["mood", 2],
	["decade", 1],
	["theme", 1],
	["style", 1],
]

/**
 * Up to `n` pairings: per family the strongest few by lift (atlas.blend), then any two that are nearly the same set of
 * titles are one (Animation and Animated, Comedy and Funny): the second is skipped.
 */
export async function pairingsOf(atlas: Places, lead: Ingredient, n = 6): Promise<Pairing[]> {
	const found = await Promise.all(
		QUOTA.map(async ([family, take]) => {
			const b = await atlas.blend([lead], { suggestions: take + 1, titles: 3, families: [family] })
			return b.suggestions.filter((s) => s.place.slug !== "tv-movie").slice(0, take)
		}),
	)
	const out: Pairing[] = []
	const parts: Ingredient[] = []
	for (const s of found.flat()) {
		if (out.length >= n) break
		const mine: Ingredient = { family: s.place.family, slug: s.place.slug }
		// Nearly the same set of titles (Jaccard): Animation and Animated are one; Action and Animation are two, even
		// where most of the action is animated.
		const twin = parts.some((other) => {
			const both = atlas.count([lead, mine, other])
			const either = atlas.count([lead, mine]) + atlas.count([lead, other]) - both
			return either > 0 && both / either > 0.55
		})
		if (twin) continue
		parts.push(mine)
		out.push({ place: s.place, name: atlas.name([lead, mine]), count: s.count, titles: s.titles })
	}
	return out
}

export interface Door {
	place: PlaceRef
	/** How its titles differ from this country's: "more crime-focused". */
	differs: string
	trait: TraitWord | null
	/** How large to draw the outline: a wide country gets more room, a territory of a few points less. */
	size: number
}

type Box = readonly [number, number, number, number]
const gap = (a: Box, b: Box) =>
	Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]))

/** The countries that lie closest on the real map, each with a word of its own for how it differs. */
export function doorsOf(
	atlas: Places,
	lead: Ingredient,
	n = 4,
): { doors: Door[]; adjacent: boolean } {
	const me = atlas.ref(lead)
	const mine = me.code ? SHAPE_BY_CODE.get(me.code.toUpperCase()) : undefined
	const doors: { place: PlaceRef; traits: TraitWord[]; size: number; far: number; gap: number }[] =
		[]
	if (mine)
		for (const other of atlas.members("country")) {
			if (other.slug === lead.slug || !other.code) continue
			const shape = SHAPE_BY_CODE.get(other.code.toUpperCase())
			if (!shape) continue
			// The sea between their outlines, and a little of the way between their middles (so a country as wide as
			// Russia is not everyone's first neighbor).
			const between = gap(mine.box, shape.box)
			const middles = Math.hypot(mine.at[0] - shape.at[0], mine.at[1] - shape.at[1])
			const w = shape.box[2] - shape.box[0]
			const h = shape.box[3] - shape.box[1]
			doors.push({
				place: other,
				traits: atlas.traits([ing("country", other.slug)], { n: 4, against: [lead] }).more,
				size: w > h * 2.5 ? 64 : 54,
				gap: between,
				far: between + middles * 0.25,
			})
		}
	doors.sort((a, b) => a.far - b.far)
	const near = doors.slice(0, n)
	const said = new Set<string>()
	return {
		doors: near.map(({ place, traits, size }) => {
			const trait = traits.find((t) => !said.has(t.key)) ?? traits[0] ?? null
			if (trait) said.add(trait.key)
			return { place, differs: trait ? comparative(trait.key, trait.word) : "", trait, size }
		}),
		adjacent: (near[0]?.gap ?? 999) < 30,
	}
}

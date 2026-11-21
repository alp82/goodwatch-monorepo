// A country's page, plus who lies next
// door on the real map, six pairings to narrow it, and the countries alike in feel that aren't next door.
import type { PlaceData } from "~/server/browse/place-data.server"
import { loadPage } from "~/server/browse/place-data.server"
import type { BrowseLoader } from "~/ui/browse/view"
import { type Door, type Pairing, doorsOf, pairingsOf } from "~/server/browse/country-onward.server"

export type { Door }

export interface NextDoorData {
	page: PlaceData
	doors: Door[]
	/** True when the nearest of them really is a neighbor; false for a country far from every other one (Australia). */
	adjacent: boolean
	pairings: Pairing[]
	/** Alike in feel, without the countries next door. */
	alike: PlaceData["neighbors"]
}

export const loadCountryPage: BrowseLoader<NextDoorData> = async (args) => {
	const { atlas, address } = args
	const lead = address.parts[0]
	const [page, pairings] = await Promise.all([
		loadPage(args) as Promise<PlaceData>,
		pairingsOf(atlas, lead, 6),
	])
	const { doors, adjacent } = doorsOf(atlas, lead, 4)
	const near = new Set(doors.map((d) => d.place.slug))
	// Alike in feel, asked wide enough that four remain once the countries next door are taken out.
	const wide = await atlas.neighbors(lead, { n: 10, titles: 0 })
	const alike = wide.filter((n) => !near.has(n.place.slug)).slice(0, 4)
	return {
		// The head's "Close to it" names the closest in feel that isn't already next door.
		page: { ...page, neighbors: alike },
		doors,
		adjacent,
		pairings,
		alike,
	}
}

// PROTOTYPE - throwaway (prototype/explore-r5, slot "country"; round 7). The round 4 country page, plus who lies next
// door on the real map, six pairings to narrow it, and the countries alike in feel that aren't next door.
import type { PlaceData } from "../../../rooms/loader.server"
import { roomsLoad } from "../../baselines.server"
import type { SlotLoader } from "../../contract"
import { type Door, type Pairing, doorsOf, pairingsOf } from "./shared.server"

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

export const load: SlotLoader<NextDoorData> = async (args) => {
	const { kit, address } = args
	const lead = address.parts[0]
	const [page, pairings] = await Promise.all([
		roomsLoad(args) as Promise<PlaceData>,
		pairingsOf(kit, lead, 6),
	])
	const { doors, adjacent } = doorsOf(kit, lead, 4)
	const near = new Set(doors.map((d) => d.place.slug))
	// Alike in feel, asked wide enough that four remain once the countries next door are taken out.
	const wide = await kit.neighbors(lead, { n: 10, titles: 0 })
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

// Where the map moves in: the part of the world that
// holds a set of countries.
import { type Box, SHAPE_BY_CODE } from "~/ui/browse/world-map/geometry"
import { WORLD } from "~/ui/browse/places/AtlasMap"

const width = (b: Box) => b[2] - b[0]
const MIN = 150

/** The part of the map that holds these countries, or the whole world when they lie too far apart to come closer. */
export function boxAround(codes: readonly string[]): Box {
	let box: Box | null = null
	for (const code of codes) {
		const b = SHAPE_BY_CODE.get(code.toUpperCase())?.box
		if (!b || width(b) > 300) continue
		box = box
			? [
					Math.min(box[0], b[0]),
					Math.min(box[1], b[1]),
					Math.max(box[2], b[2]),
					Math.max(box[3], b[3]),
				]
			: b
	}
	if (!box || width(box) > width(WORLD) * 0.5 || box[3] - box[1] > (WORLD[3] - WORLD[1]) * 0.6)
		return WORLD
	const room = Math.max(width(box), box[3] - box[1]) * 0.12 + 6
	const short = Math.max(0, MIN - width(box) - room * 2) / 2
	return [box[0] - short - room, box[1] - room, box[2] + short + room, box[3] + room]
}

// ---------------------------------------------------------------------------------------------------------
// where in the world a country is, as a person groups them (not the map file's four regions).

export const REGIONS = [
	{ id: "europe", label: "Europe" },
	{ id: "asia", label: "Asia" },
	{ id: "middle-east", label: "Middle East" },
	{ id: "africa", label: "Africa" },
	{ id: "north-america", label: "North America" },
	{ id: "caribbean", label: "Central America & Caribbean" },
	{ id: "south-america", label: "South America" },
	{ id: "oceania", label: "Oceania" },
] as const
export type RegionId = (typeof REGIONS)[number]["id"]

const BY_HAND: Record<string, RegionId> = {}
const put = (region: RegionId, codes: string) => {
	for (const code of codes.split(" ")) BY_HAND[code] = region
}
put("south-america", "AR BO BR CL CO EC GY PY PE SR UY VE FK")
put("caribbean", "BZ CR SV GT HN NI PA CU DO HT JM TT BS BB PR")
put("north-america", "US CA MX GL")
put("oceania", "AU NZ PG FJ NC SB VU WS")
put("middle-east", "IL PS LB SY JO IQ IR SA AE QA KW BH OM YE")
put("europe", "TR CY GE AM AZ RU IS MT")
put("asia", "HK TW SG MO")

/** A country's region, by ISO code: by hand where people disagree with the map file, else the map file's region. */
export function regionOf(code: string): RegionId {
	const c = code.toUpperCase()
	const hand = BY_HAND[c]
	if (hand) return hand
	const region = SHAPE_BY_CODE.get(c)?.region
	if (region === "europe" || region === "africa" || region === "asia") return region
	if (region === "americas") return "north-america"
	return "asia"
}

/** The part of the map that holds a set of countries, however far apart (a region's view). */
export function regionBox(codes: readonly string[]): Box {
	let box: Box | null = null
	for (const code of codes) {
		const b = SHAPE_BY_CODE.get(code.toUpperCase())?.box
		// Russia's or the United States' whole width would stretch a region's view; they still show inside it.
		if (!b || width(b) > 260) continue
		box = box
			? [
					Math.min(box[0], b[0]),
					Math.min(box[1], b[1]),
					Math.max(box[2], b[2]),
					Math.max(box[3], b[3]),
				]
			: b
	}
	if (!box) return WORLD
	const room = Math.max(width(box), box[3] - box[1]) * 0.08 + 4
	return [box[0] - room, box[1] - room, box[2] + room, box[3] + room]
}

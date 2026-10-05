// PROTOTYPE - throwaway. Shapes shared by the server and browser for /prototype/rec-explorer-4 (#180, round 4).
// Titles travel in round 2's compact shape (W).
import type { W, Who } from "~/ui/prototype-rec-explorer-2/wire"
import type { Service } from "~/ui/prototype-rec-taste/model"

export type { W, Who }

export type GroupId = "genre" | "mood" | "service" | "decade" | "country" | "taste"

export const GROUPINGS: { id: GroupId; name: string }[] = [
	{ id: "genre", name: "Genre" },
	{ id: "mood", name: "Mood" },
	{ id: "service", name: "Streaming" },
	{ id: "decade", name: "Decade" },
	{ id: "country", name: "Country" },
	{ id: "taste", name: "Taste distance" },
]

/** Taste bands by match (50-99), used by the rings. Inner ring first. */
export const BANDS = [
	{ name: "Near you", min: 85 },
	{ name: "A step out", min: 68 },
	{ name: "Unexplored", min: 0 },
]
export const bandOf = (m: number) => (m >= BANDS[0].min ? 0 : m >= BANDS[1].min ? 1 : 2)

/** One region of the map: every title that passes the filters and falls into this group. */
export type Region = {
	id: string
	name: string
	color: string
	count: number
	/** Median taste match of its titles, 50-99. */
	fit: number
	/** How many titles in each taste band (near, a step out, unexplored). */
	bands: [number, number, number]
	/** Where the group sits in the title analysis, -1..1 (similar groups close together). */
	x: number
	y: number
	/** What sets it apart, in words. */
	line: string
	/** Its best picks for the person, best first; includes the best of each taste band. */
	items: W[]
}

export type MapRes = {
	group: GroupId
	regions: Region[]
	total: number
	ms?: number
}

/** Where each door from a title leads: the closest title in the neighboring region. */
export type StepRes = { steps: { to: string; item: W | null }[]; ms?: number }

export type Loaded4 = {
	who: Who
	services: Service[]
	map: MapRes
}

export type PeekInfo4 = { why: string; people: string[]; role: string }

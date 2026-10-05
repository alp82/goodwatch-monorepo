// PROTOTYPE - throwaway. Shapes and constants shared by the server and browser for /prototype/rec-explorer-2.
import type { Service } from "~/ui/prototype-rec-taste/model"

/** One title on the wire. Positions only for the map layouts. */
export type W = {
	k: string // "movie-603"
	t: string
	yr: number
	p: string // poster path
	b: string // backdrop path
	g: string[]
	s: number // GoodWatch score 0-100
	m: number // taste match 50-99
	a: number[] // services in the person's country
	f: number // 1 on my services, 2 seen or rated, 4 Want to See
	r?: number // the person's rating
	x?: number
	y?: number
	l?: number // pyramid level: the zoom level where it first shows
	d?: number // first director or creator id
}

export type Who = {
	mode: "me" | "demo"
	country: string
	demoServices: boolean
	signedIn: boolean
	rated: number
	pool: number
}
export type LayoutId = "zoom" | "rings" | "eras" | "moods" | "people"
export type Hub = {
	id: number
	name: string
	profile: string
	x: number
	y: number
	r: number
	count: number
}

export type LayoutMeta = {
	kind: LayoutId
	nodes?: {
		id: number
		parent: number
		depth: number
		name: string
		x: number
		y: number
		r: number
		count: number
	}[]
	bands?: { id: string; name: string; r0: number; r1: number }[]
	sectors?: { name: string; color: string; a0: number; a1: number }[]
	lanes?: { name: string; color: string; y0: number; y1: number }[]
	decades?: { label: string; x: number; x1: number }[]
	rooms?: {
		id: string
		name: string
		color: string
		x0: number
		y0: number
		x1: number
		y1: number
		count: number
		subs: { name: string; x0: number; y0: number; x1: number; y1: number }[]
	}[]
}

export type Loaded = {
	who: Who
	services: Service[]
	meta: LayoutMeta | null
	you: { x: number; y: number }
	variant: string
}

// Zoom pyramid. A poster is 10 world units wide. Level L shows from scale S0 * 2^L; each level keeps at most one
// title per CELL_PX screen cell, so the screen never holds more than a few hundred titles at once.
export const S0 = 0.5
export const CELL_PX = 54
export const LMAX = 5
export const TILE_PX = 1024
export const tileSize = (L: number) => TILE_PX / (S0 * 2 ** L)
export const POSTER = 10

export const MOODS = [
	{
		id: "warm",
		name: "Warm",
		keys: ["wholesome", "hopefulness", "nostalgia"],
		color: "#e8a33d",
	},
	{
		id: "funny",
		name: "Funny",
		keys: [
			"situational_comedy",
			"wit_wordplay",
			"absurdist_humor",
			"physical_comedy",
			"satire_parody",
		],
		color: "#e2cf55",
	},
	{
		id: "romantic",
		name: "Romantic",
		keys: ["romance", "eroticism"],
		color: "#e0607e",
	},
	{
		id: "wonder",
		name: "Wondrous",
		keys: ["wonder", "fantasy", "spectacle", "world_immersion"],
		color: "#9b7bea",
	},
	{
		id: "moving",
		name: "Moving",
		keys: ["pathos", "melancholy", "catharsis"],
		color: "#5b8def",
	},
	{
		id: "mind",
		name: "Mind-bending",
		keys: ["complexity", "philosophical", "surrealism", "non_linear_narrative"],
		color: "#3fc1b0",
	},
	{
		id: "tense",
		name: "Tense",
		keys: ["tension", "intrigue", "adrenaline", "mystery"],
		color: "#7aa7c7",
	},
	{
		id: "dark",
		name: "Dark",
		keys: ["bleakness", "violence", "grotesque", "dark_humor"],
		color: "#c2413a",
	},
	{ id: "scary", name: "Scary", keys: ["scare", "uncanny"], color: "#8fbf3a" },
]

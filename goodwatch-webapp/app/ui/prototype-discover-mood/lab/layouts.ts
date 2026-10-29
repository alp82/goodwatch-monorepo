// PROTOTYPE (Discover lab, round 15): the main tabs as a lab choice (`v-layout`). Round 20 locked c: four tabs, You as
// a narrow end cap after Search, Mood and Watch. Each panel renders the chosen section variants.
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { type Choice, DEFAULTS } from "./choice"
import type { SectionId, Viewer } from "./types"

export type SegKey = "search" | "you" | "mood" | "watch"

/** A filter card, the search text, Not seen yet, or a "more" choice. */
export type Slot = CardKey | "q" | "notSeenYet" | MoreSlot
/** Round 16: the lab-only popularity, money and show choices (sections/more/store.ts). */
type MoreSlot = "reach" | "money" | "shows"

export type SubId = SectionId | MoreSlot

export interface Sub {
	id: SubId
	label: string
	slots: Slot[]
	/** Which of You's lab-only choices count here (youChips groups). */
	you?: ("minMatch" | "notSeenYet")[]
	/** Round 16: renders the "more" section at this part. */
	part?: MoreSlot
	/** Shown while the list holds this kind (or its choices are set). */
	kind?: "movie" | "show"
}

export interface Layout {
	key: string
	name: string
	order: (viewer: Viewer) => SegKey[]
	tabs: Record<SegKey, Sub[]>
	/** Desktop bar: each segment's flex share. */
	flex: Record<SegKey, string>
	/** Phone bar: the row under Search. */
	phoneCols: (viewer: Viewer) => string
	/** You as a narrow personal end cap: fingerprint or lock, a short summary. */
	youCap?: boolean
}

const TITLES: Sub = {
	id: "titles",
	label: "Titles",
	slots: ["q", "similarTo", "type"],
}
const PEOPLE: Sub = { id: "people", label: "Cast and crew", slots: ["people"] }
const MOOD: Sub[] = [
	{ id: "mood", label: "Mood", slots: ["moods", "themes", "styles", "genres"] },
]
const WATCH: Sub[] = [
	{ id: "services", label: "Services", slots: ["services"] },
	{
		id: "scores",
		label: "Scores",
		slots: ["minScore", "sourceScores", "scoreGap"],
	},
	{ id: "origin", label: "Made in", slots: ["productionCountries"] },
	{ id: "released", label: "Released", slots: ["released"] },
	{ id: "length", label: "Length", slots: ["runtime"] },
	{ id: "age", label: "Age and content", slots: ["ageLimit"] },
]
const BOTH = ["minMatch", "notSeenYet"] as const

/** Four tabs: Search keeps Titles and Cast and crew, the thumbs (loved, disliked) count with Titles. */
const SEARCH4: Sub[] = [
	{ ...TITLES, slots: ["q", "similarTo", "loved", "disliked", "type"] },
	PEOPLE,
]
const YOU1: Sub[] = [
	{
		id: "taste",
		label: "You",
		slots: ["minMatch", "notSeenYet"],
		you: [...BOTH],
	},
]

const LAYOUT_LIST: Layout[] = [
	{
		key: "c",
		name: "You at the end",
		order: () => ["search", "mood", "watch", "you"],
		tabs: { search: SEARCH4, you: YOU1, mood: MOOD, watch: WATCH },
		flex: {
			search: "flex-[2.5]",
			you: "flex-[0.85]",
			mood: "flex-[1.2]",
			watch: "flex-[1.2]",
		},
		phoneCols: () => "grid-cols-[1fr_1fr_0.8fr]",
		youCap: true,
	},
]

const LAYOUTS: Record<string, Layout> = Object.fromEntries(
	LAYOUT_LIST.map((l) => [l.key, l]),
)
/** The locked layout (c), also the fallback for an unknown `v-layout`. */
export const LAYOUT_C = LAYOUTS.c
export const LAYOUT_KEYS = LAYOUT_LIST.map((l) => ({
	key: l.key,
	name: l.name,
}))
const layoutOf = (key: string | undefined): Layout =>
	(key && LAYOUTS[key]) || LAYOUT_C

// Round 16: the "more" section's sub-tabs in Watch. Popularity and Shows after Scores (round 17), Budget after
// Length. Round 17 dropped c's one More sub-tab; every variant has these.
const REACH: Sub = { id: "reach", label: "Popularity", slots: ["reach"], part: "reach" }
const MONEY: Sub = { id: "money", label: "Budget", slots: ["money"], part: "money", kind: "movie" }
const SHOWS: Sub = { id: "shows", label: "Shows", slots: ["shows"], part: "shows", kind: "show" }

export function withMore(L: Layout): Layout {
	const watch = L.tabs.watch.flatMap((s): Sub[] => {
		if (s.id === "scores") return [s, REACH, SHOWS]
		if (s.id === "length") return [s, MONEY]
		return [s]
	})
	return { ...L, tabs: { ...L.tabs, watch } }
}

/** The lab's layout: the main tabs choice (the URL's, else the pick in DEFAULTS) with the "more" section's sub-tabs. */
export const layoutFor = (choice: Choice): Layout => withMore(layoutOf(choice.layout ?? DEFAULTS.layout))

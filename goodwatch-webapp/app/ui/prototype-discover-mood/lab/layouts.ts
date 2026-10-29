// PROTOTYPE (Discover lab, round 15): the main tabs as a lab choice (`v-layout`). a is today's three tabs (Search with
// You as a sub-tab, Mood, Watch); b-e move You out into a fourth tab. Only the tab structure changes; each panel
// still renders the chosen section variants.
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import type { SectionId, Viewer } from "./types"

export type SegKey = "search" | "you" | "mood" | "watch"

/** A filter card, the search text, Not seen yet, or (layout d) On my services. */
export type Slot = CardKey | "q" | "notSeenYet" | "myServices"

/** "lists" is layout d's You > Lists page (no lab section of its own). */
export type SubId = SectionId | "lists"

export interface Sub {
	id: SubId
	label: string
	slots: Slot[]
	/** Which of You's lab-only choices count here (youChips groups). */
	you?: ("minMatch" | "notSeenYet")[]
	/** Renders this page instead of the section's chosen variant (layout d splits taste f in two). */
	view?: "you-taste" | "you-lists"
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
	/** You as a narrow personal end cap (c, e): fingerprint or lock, a short summary. */
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
		key: "a",
		name: "Three tabs, You in Search",
		order: () => ["search", "mood", "watch"],
		tabs: {
			search: [
				// Movies or shows sits on the Search row (round 10); it counts with Titles.
				TITLES,
				PEOPLE,
				// Round 12: "You", with Not seen yet back from Services.
				{
					id: "taste",
					label: "You",
					slots: ["loved", "disliked", "minMatch", "notSeenYet"],
					you: [...BOTH],
				},
			],
			you: [],
			mood: MOOD,
			watch: WATCH,
		},
		flex: {
			search: "flex-[2.6]",
			you: "flex-1",
			mood: "flex-[1.25]",
			watch: "flex-[1.25]",
		},
		phoneCols: () => "grid-cols-2",
	},
	{
		key: "b",
		name: "You beside Search",
		order: () => ["search", "you", "mood", "watch"],
		tabs: { search: SEARCH4, you: YOU1, mood: MOOD, watch: WATCH },
		flex: {
			search: "flex-[2.3]",
			you: "flex-[1.05]",
			mood: "flex-[1.1]",
			watch: "flex-[1.1]",
		},
		phoneCols: () => "grid-cols-3",
	},
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
	{
		key: "d",
		name: "You hub, Taste and Lists",
		order: () => ["search", "you", "mood", "watch"],
		tabs: {
			search: SEARCH4,
			you: [
				{
					id: "taste",
					label: "Taste",
					slots: ["minMatch"],
					you: ["minMatch"],
					view: "you-taste",
				},
				{
					id: "lists",
					label: "Lists",
					slots: ["notSeenYet", "myServices"],
					you: ["notSeenYet"],
					view: "you-lists",
				},
			],
			mood: MOOD,
			watch: WATCH,
		},
		flex: {
			search: "flex-[2.3]",
			you: "flex-[1.1]",
			mood: "flex-[1.1]",
			watch: "flex-[1.1]",
		},
		phoneCols: () => "grid-cols-3",
	},
	{
		key: "e",
		name: "You first for members",
		order: (v) =>
			v === "member"
				? ["you", "search", "mood", "watch"]
				: ["search", "mood", "watch", "you"],
		tabs: { search: SEARCH4, you: YOU1, mood: MOOD, watch: WATCH },
		flex: {
			search: "flex-[2.5]",
			you: "flex-[0.85]",
			mood: "flex-[1.2]",
			watch: "flex-[1.2]",
		},
		phoneCols: (v) =>
			v === "member"
				? "grid-cols-[0.8fr_1fr_1fr]"
				: "grid-cols-[1fr_1fr_0.8fr]",
		youCap: true,
	},
]

export const LAYOUTS: Record<string, Layout> = Object.fromEntries(
	LAYOUT_LIST.map((l) => [l.key, l]),
)
export const LAYOUT_A = LAYOUTS.a
export const LAYOUT_KEYS = LAYOUT_LIST.map((l) => ({
	key: l.key,
	name: l.name,
}))
export const layoutOf = (key: string | undefined): Layout =>
	(key && LAYOUTS[key]) || LAYOUT_A

/** Every tab in this layout, in bar order. */
export const segsOf = (L: Layout, viewer: Viewer) => L.order(viewer)
/** Layout d counts On my services under You, so Watch > Services doesn't count it again. */
export const splitsMine = (L: Layout) =>
	L.tabs.you.some((s) => s.slots.includes("myServices"))

// PROTOTYPE - throwaway (#658). The sides-on-Discover prototype's view model. Types only, so browser code can import it.
import type { FilterDefaults } from "~/domain/filter-state"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import type { TitleCard } from "~/server/title-cards.server"
import type { FilterBarCounts } from "~/ui/filter-bar/types"

export const VARIANTS = {
	today: { name: "Today's Discover", style: "reference" },
	filter: { name: "Side filter", style: "existing" },
	rows: { name: "A row per side", style: "existing" },
	labels: { name: "Side marks on cards", style: "existing" },
	lanes: { name: "Side lanes", style: "bolder" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey => typeof v === "string" && v in VARIANTS

export interface SDSide {
	index: number
	/** Contrasted name ("Bleak stories about inner struggles"): words, shown only behind the names toggle. */
	name: string
	/** Attribute line ("Bleak · Psychological · Melancholy"): words too. */
	line: string
	/** Share of the loved titles. */
	share: number
	count: number
	lift: number
	/** Loved titles that stand for the side, most typical first. */
	here: number[]
	/** Edge sentences (words, behind the toggle). */
	edges: string[]
}

export interface SDView {
	member: { slot: string; label: string; ratings: number; rated: number; loved: number }
	members: { slot: string; label: string; ratings: number }[]
	sides: SDSide[]
	/** Loved titles in no side. */
	loose: number
	posters: Record<string, PortraitTitle>
	/**
	 * Loaded cards in the list's order (personal order under Best match): the list's first `list` titles plus each
	 * side's own first titles, wherever they are in the list.
	 */
	cards: TitleCard[]
	/** Each loaded title's side index, or null when it fits no side. */
	sideOf: Record<string, number | null>
	closeness: Record<string, number>
	/** Each loaded title's place in the whole list (0-based). */
	place: Record<string, number>
	/** How many of the list's first titles Today and the marks show. */
	list: number
	/** Titles of each side in the whole list, and those that fit no side. */
	totals: number[]
	noSide: number
	listTotal: number
	counts: FilterBarCounts
	defaults: FilterDefaults
	/** The member's services carry nothing where they watch, so On my services starts off. */
	servicesDropped: boolean
	sortUsed: string
	forYou: boolean
	movedUp: number
	order: "personal" | "best-match" | "sort"
	personalOrderNote: string | null
	fit: number
	computedMs: number
}

/** Side hues: a side is told apart by its posters and number first, the hue only helps. */
export const HUES = ["#f59e0b", "#38bdf8", "#e879f9", "#4ade80", "#fb7185"]

// PROTOTYPE - throwaway (#659, map #652). The view model of /prototype/sides-watch-next: one member's real Watch next
// (My movies, or the whole Wishlist), ordered by their personal order, with every title's Side of you. Types only, so
// browser code can import it.
import type { MoodKey } from "~/domain/moods"
import type { WatchNextTierSize } from "~/domain/watch-next"
import type { WatchNext, WatchNextTitle } from "~/server/watch-next.server"
import type { TitleKey } from "~/utils/title-key"

export const VARIANTS = {
	today: { name: "Today (production)", style: "reference" },
	marked: { name: "Each pick shows its side", style: "existing" },
	grouped: { name: "Grouped by side", style: "existing" },
	picker: { name: "Pick a side for tonight", style: "existing" },
	lanes: { name: "One from each side", style: "bolder" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey => typeof v === "string" && v in VARIANTS

export interface SwnSide {
	id: string
	/** The side's color: the only way to tell sides apart with the names off. */
	color: string
	/** Contrasted words ("Bleak psychological stories"): shown only with the names on (words gate, #656). */
	name: string
	/** Share of the loved titles. */
	share: number
	/** The side's most typical loved titles: its face with the names off. */
	faces: TitleKey[]
	/** The moods its loved titles have far more often than the rest: what "open Watch next" picks. */
	moods: MoodKey[]
	/** Titles on the list in this side, and how many of them fit tonight. */
	listed: number
	fitting: number
}

export type SwnTierKey = WatchNext["tiers"][number]["key"] | "otherSides"

export interface SwnTier {
	key: SwnTierKey
	label: string
	note: string | null
	size: WatchNextTierSize
	keys: TitleKey[]
}

export interface SwnMember {
	slot: string
	label: string
	ratings: number
}

export interface SwnView {
	variant: VariantKey
	/** My movies (with How long?) or the whole Wishlist (Watch next). */
	list: "movies" | "all"
	member: SwnMember & { listed: number }
	members: SwnMember[]
	/** The words behind the toggle. */
	names: boolean
	/** Hero, Then, strip, and mood counts, as production computes them for this order. */
	data: WatchNext
	tiers: SwnTier[]
	/** Every title that fits tonight, in order, the hero first. */
	fitting: TitleKey[]
	titles: Record<string, WatchNextTitle>
	/** Posters of the sides' faces (loved titles). */
	faces: Record<string, { title: string; poster: string | null }>
	sides: SwnSide[]
	/** Each listed title's side; null when it fits no side well. */
	sideOf: Record<string, string | null>
	/** The picker's side for tonight. */
	side: string | null
	passed: TitleKey[]
	personalOrder: { on: boolean; note: string | null }
	notes: string[]
	computedMs: number
}

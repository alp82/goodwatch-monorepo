// PROTOTYPE - throwaway (#659, map #652). The view model of /prototype/sides-watch-next: one member's real Watch next
// (My movies, or the whole Wishlist), ordered by their personal order, with where each title stands to the member's
// groups of loved titles (production's Sides of you and side rule, #666): in one, close to one, or neither. Types
// only, so browser code can import it.
import type { MoodKey } from "~/domain/moods"
import type { WatchNextTierSize } from "~/domain/watch-next"
import type { WatchNext, WatchNextTitle } from "~/server/watch-next.server"
import type { TitleKey } from "~/utils/title-key"

export const VARIANTS = {
	today: { name: "Today (production)", style: "reference" },
	moods: { name: "Round 2: after the moods", style: "reference" },
	beside: { name: "Beside its moods", style: "merged" },
	inside: { name: "Inside the moods", style: "merged" },
	first: { name: "Yours first", style: "merged" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey =>
	typeof v === "string" && v in VARIANTS

/**
 * How picked groups narrow. "any": a group is one more choice among the moods (up to three in all), and a title fits
 * when it is in any of them. "inside": there are no group picks; a mood that carries groups is picked as that mood in
 * your taste (its titles in those groups), and can be widened to the whole mood.
 */
export type GroupRule = "any" | "inside"
export const RULE: Record<VariantKey, GroupRule | null> = {
	today: null,
	moods: "any",
	beside: "any",
	inside: "inside",
	first: "any",
}

export interface SwnGroup {
	id: string
	/** Its trait name ("Bleak, tense stories"): only with the names on (words gate, #656). */
	name: string
	/** Its most typical loved titles: how it is told apart with the names off. */
	posters: { key: TitleKey; title: string; poster: string | null }[]
	/** A backdrop for its tile, from one of its loved titles. */
	backdrop: string | null
	/** Its titles on the list, counted as the moods are (on your services when that is on). */
	count: number
	/** Titles close to it, counted the same way. */
	close: number
	/** Production's moods of the group (most of its loved titles are in them), most first. */
	moods: MoodKey[]
	/** The mood it sits beside, or inside: its first mood no group before it took, else its first. */
	at: MoodKey | null
}

/** "Inside the moods": a mood that carries groups, and how many of its titles are in them. */
export interface TasteMood {
	groups: string[]
	count: number
}

export type Place = { id: string; how: "in" | "close" } | null

export type SwnTierKey = WatchNext["tiers"][number]["key"] | "closeTaste"

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
	rule: GroupRule | null
	/** My movies (with How long?) or the whole Wishlist (Watch next). */
	list: "movies" | "all"
	member: SwnMember & { listed: number }
	members: SwnMember[]
	/** Hero, Then, strip, and mood counts, as production computes them for this order. */
	data: WatchNext
	tiers: SwnTier[]
	/** Every title that fits tonight, in order, the hero first. */
	fitting: TitleKey[]
	titles: Record<string, WatchNextTitle>
	/** With a group picked: what each movie misses tonight, in words (production's captions know no groups). */
	misfits: Record<string, string>
	/** The groups' trait names, behind the toggle. */
	names: boolean
	groups: SwnGroup[]
	/** Where each listed title stands: in a group, close to one, or neither (null). */
	placeOf: Record<string, Place>
	/** The picked groups. */
	picked: string[]
	/** "Inside the moods": the moods that carry groups. */
	tasteMoods: Partial<Record<MoodKey, TasteMood>>
	/** "Inside the moods": picked moods widened to the whole mood (the rest of the picked moods that carry groups narrow). */
	wide: MoodKey[]
	passed: TitleKey[]
	personalOrder: { on: boolean; note: string | null }
	notes: string[]
	computedMs: number
}

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
	inside: { name: "Round 3: inside the moods", style: "reference" },
	beside: { name: "Round 3: beside its moods", style: "reference" },
	tabs: { name: "Tabs by kind", style: "round 5" },
	steps: { name: "Kind, then choice", style: "round 5" },
	shelf: { name: "Your row, then the rest", style: "round 5" },
	row: { name: "One row in the strip", style: "round 5" },
	search: { name: "Search with suggestions", style: "round 5" },
	shades: { name: "Moods, then shades", style: "round 5" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey =>
	typeof v === "string" && v in VARIANTS

/**
 * How picked groups narrow. "any": a group is one more choice among the moods (up to three in all), and a title fits
 * when it is in any of them. "inside": there are no group picks; a mood that carries groups is picked as that mood in
 * your taste (its titles in those groups), and can be widened to the whole mood. "words": round 5's pickers, where
 * groups, moods, themes, and styles are picked together by Discover's rule (any within a kind, every kind picked).
 */
export type GroupRule = "any" | "inside" | "words"
export const RULE: Record<VariantKey, GroupRule | null> = {
	today: null,
	beside: "any",
	inside: "inside",
	tabs: "words",
	steps: "words",
	shelf: "words",
	row: "words",
	search: "words",
	shades: "words",
}

/** A word of the filters (words.ts) as the member's list holds it. */
export interface SwnWord {
	id: string
	/** Titles with the word, counted as the moods are. */
	count: number
	/** The titles left with the picks so far and this word (the count itself when picked). */
	leaves: number
	/** A backdrop from a title on the list with the word. */
	backdrop: string | null
	/** The taste groups the word carries: at least 40% of the group's loved titles have it, more than the rest. */
	groups: string[]
	/** Its titles in those groups, counted the same way. */
	inTaste: number
}

/** Where a title stands to the taste picked (or the whole taste): "Fits your taste" or "Close to your taste". */
export type Badge = "fits" | "close"

export interface SwnWords {
	/** The picks: groups (g1) and words (m:funny), in the order picked. */
	picks: string[]
	words: SwnWord[]
	/** Per group: the words it carries, the one that most sets it apart first. */
	carries: Record<string, string[]>
	/** Per group: its two colors, from the mood and the theme or style that most set it apart. */
	blend: Record<string, string[]>
	/** Groups as picks: the titles each would leave. */
	groupLeaves: Record<string, number>
	/** The titles the picks leave, counted as the words are. */
	fitting: number
	badges: Record<string, Badge>
}

export interface SwnGroup {
	id: string
	/** Its trait name ("Dark, tense crime"; round 4 always shows it, round 3 only with the names on). */
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
	/** Round 5. */
	words: SwnWords | null
	passed: TitleKey[]
	personalOrder: { on: boolean; note: string | null }
	notes: string[]
	computedMs: number
}

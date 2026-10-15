// PROTOTYPE - throwaway (#662). The rating-moment prototype's view model, shared by the server and the variants.
// Types only, so browser code can import it.
import type { MoodKey } from "~/domain/moods"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import type { TitleKey } from "~/utils/title-key"

export const VARIANTS = {
	toast: { name: "One line after rating", style: "existing" },
	sheet: { name: "The score sheet answers", style: "existing" },
	hero: { name: "Sides stay on the title", style: "existing" },
	shape: { name: "Only when the shape changes", style: "bolder" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey => typeof v === "string" && v in VARIANTS

export interface MomentSide {
	id: string
	/** Contrasted words; shown only with the side-names toggle on (words gate, #656). */
	name: string
	share: number
	count: number
	/** Most typical loved titles, for posters. */
	here: TitleKey[]
	members: TitleKey[]
	/** For the Watch next link. */
	moods: MoodKey[]
	/** Grouping color, carried over from the matching side before the rating. */
	hue: string
	/** The matching side before the rating; null for a new side (and for every side before). */
	was: string | null
}

export type Outcome =
	| { kind: "none" }
	| { kind: "low"; inside: string | null }
	| { kind: "middle" }
	| { kind: "loose" }
	| { kind: "forming"; with: TitleKey[]; size: number; needs: number }
	| { kind: "new"; side: string; sidesBefore: number; sidesAfter: number }
	| {
			kind: "joins"
			side: string
			was: string
			shareBefore: number
			shareAfter: number
			countBefore: number
			countAfter: number
			/** By size, 0 is the biggest. */
			rankBefore: number
			rankAfter: number
			/** The number of sides changed. */
			reshaped: boolean
	  }

export interface Demo {
	key: TitleKey
	label: string
	mine: number | null
}

export interface MomentView {
	member: { slot: string; label: string }
	members: { slot: string; label: string; ratings: number }[]
	key: TitleKey
	/** The member's real score for the title, if any (the prototype rates it as if for the first time). */
	mine: number | null
	score: number | null
	/** The lowest score that counts as loved for this member. */
	lovedFrom: number
	/** nearest: the sides stay and the title joins the nearest; rebuild: the sides are built again with the score. */
	placement: "nearest" | "rebuild"
	before: { sides: MomentSide[]; loose: number; loved: number }
	after: { sides: MomentSide[]; loose: number; loved: number } | null
	outcome: Outcome
	/** Unseen titles from the side it joined, in personal order. */
	more: TitleKey[]
	demos: Demo[]
	titles: Record<string, PortraitTitle>
	personalOrder: boolean
	computedMs: number
}

/** #526: one optional tap for why, after a score of 5 or less. */
export const WHY = ["Not my kind", "Boring", "Expected more", "Too long", "Bad ending", "Wrong mood", "Something else"] as const

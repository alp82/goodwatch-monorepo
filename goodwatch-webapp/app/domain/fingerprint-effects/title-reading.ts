// Pure text reading shared by the website and candidate enrichment.
import { type EffectReading, leading, notFor, readEffects } from "./effects.ts"
import { familyOf } from "../fingerprint-families.ts"
import { FAMILY_COLOR } from "./palette.ts"
import type { CoreScores } from "../../server/utils/fingerprint.ts"

/** An effect's color: the print family of its lead ingredient. */
export const effectColor = (r: EffectReading) =>
	FAMILY_COLOR[familyOf(r.parts[0].members[0].key)]

/** The smallest row sits at 6.5 (an effect counts from there), the largest at 10. */
export const sizeOf = (strength: number) =>
	Math.max(0, Math.min(1, (strength - 6.5) / 3.5))

export interface Phrase {
	r: EffectReading
	color: string
	/** 0 (smallest type) to 1 (largest). */
	k: number
}

/** A row for any effect (the compact row a selected effect outside the five gets). */
export const phraseOf = (r: EffectReading): Phrase => ({
	r,
	color: effectColor(r),
	k: sizeOf(r.strength),
})

const list = (xs: string[]) =>
	xs.length < 2
		? (xs[0] ?? "")
		: `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`

/** "Not for warmth, laughs or comfort.", or "" when it is for everything. */
export const notForLine = (not: string[]) =>
	not.length ? `Not for ${list(not).replace(/ and ([^,]*)$/, " or $1")}.` : ""

/** The title page's ordered effect rows and weak expected effects. */
export function readTitle(scores: CoreScores) {
	const all = readEffects(scores)
	const counted = all.filter((r) => r.counts)
	const { lead } = leading(counted.length ? counted : all.slice(0, 3), 5)
	return { all, rows: lead.map(phraseOf), not: notFor(all) }
}

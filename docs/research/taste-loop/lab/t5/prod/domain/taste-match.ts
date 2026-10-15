// The taste match a person sees, from where a title falls in their own range. Pure and shared by the server and the
// browser (the dev page /dev/for-you tunes it), so both show the same number.
//
// - The input is the title's percentile: the share of the reference pool (well-known titles, see
//   server/taste/pool.server.ts) whose fit with the person's taste is below the title's, 0 to 100. Its tail share is
//   the rest: the share of the pool that fits at least as well.
// - The match is piecewise linear in log10 of the tail share through MATCH_ANCHORS: every step up the scale needs a
//   much smaller share, so 90 is the top 1 percent and 99 the top 0.01 percent.
// - The fewer liked titles the taste is built from, the lower the scale ends (MATCH_CEILINGS). The part above 50 is
//   scaled down to the ceiling rather than cut off at it, so titles stay apart and keep their order: with 5 liked
//   titles the top 1 percent shows 79, not 85 like everything above it would with a cut.
// - The percentile, not the match, is what code orders and decides by (For you, Best match): the match of a title
//   moves with the person's ceiling and many titles share a number.
// A change to the anchors or the ceilings changes what people see, and nothing that is stored.

/** The tail share (0 to 1) from which a title shows a match. Between two anchors the match is linear in log10(share). */
export interface MatchAnchor {
	share: number
	match: number
}

/** The scale: the whole pool is 50, the top half 65, the top 10 percent 80, the top 1 percent 90. */
export const MATCH_ANCHORS: readonly MatchAnchor[] = [
	{ share: 1, match: 50 },
	{ share: 0.5, match: 65 },
	{ share: 0.1, match: 80 },
	{ share: 0.01, match: 90 },
	{ share: 0.001, match: 95 },
	{ share: 0.0001, match: 99 },
]

/** The highest match a taste built from this many liked titles shows. Between two steps it is linear in the count. */
export interface MatchCeiling {
	liked: number
	ceiling: number
}

export const MATCH_CEILINGS: readonly MatchCeiling[] = [
	{ liked: 5, ceiling: 85 },
	{ liked: 20, ceiling: 92 },
	{ liked: 50, ceiling: 96 },
	{ liked: 100, ceiling: 99 },
]

/** No match is shown below or above these, whatever the anchors. */
export const MATCH_MIN = 50
export const MATCH_MAX = 99

/** The scale, for tuning it (the dev page /dev/for-you). Everything defaults to the constants above. */
export interface MatchScaleOptions {
	anchors?: readonly MatchAnchor[]
	ceilings?: readonly MatchCeiling[]
}

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value))

/** The match for a tail share (0 to 1) at the full ceiling, not rounded. Anchors go from the largest share down. */
export function matchOfShare(
	share: number,
	anchors: readonly MatchAnchor[] = MATCH_ANCHORS,
): number {
	const last = anchors.length - 1
	if (!(share < anchors[0].share)) return anchors[0].match
	if (share <= anchors[last].share) return anchors[last].match
	let i = 1
	while (share < anchors[i].share) i++
	const from = anchors[i - 1]
	const to = anchors[i]
	const span = Math.log10(to.share) - Math.log10(from.share)
	const t = span ? (Math.log10(share) - Math.log10(from.share)) / span : 1
	return from.match + (to.match - from.match) * t
}

/** The highest match shown for a taste built from this many liked titles, not rounded. */
export function matchCeiling(
	liked: number,
	ceilings: readonly MatchCeiling[] = MATCH_CEILINGS,
): number {
	const last = ceilings.length - 1
	if (!(liked > ceilings[0].liked)) return ceilings[0].ceiling
	if (liked >= ceilings[last].liked) return ceilings[last].ceiling
	let i = 1
	while (liked > ceilings[i].liked) i++
	const from = ceilings[i - 1]
	const to = ceilings[i]
	const span = to.liked - from.liked
	const t = span ? (liked - from.liked) / span : 1
	return from.ceiling + (to.ceiling - from.ceiling) * t
}

/**
 * The taste match shown (50 to 99) for a title at this percentile (0 to 100) of the person's range, for a taste built
 * from `liked` liked titles. Never falls as the percentile or the liked count rises.
 */
export function shownMatch(
	percentile: number,
	liked: number,
	options: MatchScaleOptions = {},
): number {
	const anchors = options.anchors ?? MATCH_ANCHORS
	const bottom = anchors[0].match
	const top = anchors[anchors.length - 1].match
	const full = matchOfShare(1 - clamp(percentile, 0, 100) / 100, anchors)
	const ceiling = matchCeiling(liked, options.ceilings)
	const scale = top > bottom ? (ceiling - bottom) / (top - bottom) : 1
	return clamp(
		Math.round(bottom + (full - bottom) * Math.min(1, scale)),
		MATCH_MIN,
		MATCH_MAX,
	)
}

/**
 * The percentile (0 to 100) in 50 even steps, 50 to 99. It is the match as it was shown before the scale above:
 * For you and the other orders that went by that number go by this one, so they order titles as they did.
 */
export const rankStep = (percentile: number) =>
	Math.round(50 + 0.49 * clamp(percentile, 0, 100))

/** The lowest percentile of a rank step. */
export const percentileOfStep = (step: number) =>
	clamp((step - 0.5 - 50) / 0.49, 0, 100)

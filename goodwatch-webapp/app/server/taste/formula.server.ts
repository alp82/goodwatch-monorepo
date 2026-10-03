// The taste formula and its calibration, decided in #174 and measured in
// docs/research/recommendation-experience/taste-match (on the research/taste-match branch).
//
// - Every title's fingerprint counts as a unit-length vector.
// - P is the weighted mean of the liked titles (rated 6 or more, weight score - 5, so 6 counts 1 and 10 counts 5) and
//   the Want to See titles (weight 0.5). N is the weighted mean of the disliked titles (rated 5 or less, weight
//   6 - score). The taste is 2P - N, or P without dislikes, normalized to unit length. It's the arithmetic of Qdrant's
//   average_vector recommend strategy, over all ratings instead of the newest 50 of each.
// - The person's quantile table holds the taste's cosine over the reference pool (see pool.server.ts) at
//   QUANTILE_LEVELS: every whole percent, and the top 1 percent in finer steps down to the top 0.01 percent. A
//   title's percentile interpolates its cosine in that table.
// - The match shown runs from 50 to 99 and is logarithmic in the share of the pool that fits at least as well: 80 is
//   the top 10 percent, 90 the top 1 percent, 99 the top 0.01 percent. A taste built from few liked titles ends
//   lower: at 85 with 5, at 99 from 100. The scale is in ~/domain/taste-match.ts. It replaced
//   round(50 + 0.49 * percentile), under which 90 was the top 18 percent: too sure for a signal whose holdout AUC
//   the research measured at about 0.635.
// A change to the vector or the quantile table changes stored values: bump TASTE_KEY_VERSION in member.server.ts. The
// scale is applied on every read, so tuning it needs no bump.
import { shownMatch } from "~/domain/taste-match"
import type {
	TitleKey,
	TitleSnapshot,
} from "~/server/title-snapshot/index.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"

export const TASTE_LENGTH = VALID_FINGERPRINT_KEYS.length
/** Taste match shows from this many liked titles (owner, #193). Want to See doesn't count. */
export const MIN_LIKED = 5
/** Ratings of this and more are liked; below are disliked. */
export const LIKED_FROM = 6
export const WANT_TO_SEE_WEIGHT = 0.5
/**
 * The percentiles the quantile table holds: 0 to 99 in whole percents, then 99.1 to 99.9 in tenths, 99.91 to 99.99 in
 * hundredths, and 100. The fine steps resolve the top 1 percent down to the top 0.01 percent, where the match shown
 * goes from 90 to 99.
 */
export const QUANTILE_LEVELS: readonly number[] = [
	...Array.from({ length: 100 }, (_, i) => i),
	...Array.from({ length: 9 }, (_, i) => (991 + i) / 10),
	...Array.from({ length: 9 }, (_, i) => (9991 + i) / 100),
	100,
]
export const QUANTILES = QUANTILE_LEVELS.length

const MISSING_SCORE = 255

/** What a taste is built from: the person's ratings (1 to 10) and Want to See, with when each was last written. */
export interface TasteSignals {
	ratings: { key: TitleKey; score: number; at: number }[]
	wantToSee: { key: TitleKey; at: number }[]
}

export interface TasteCounts {
	/** All ratings, with or without a fingerprint. */
	ratings: number
	/** Liked titles that entered the vector (with a fingerprint in the snapshot). */
	liked: number
	/** Want to See titles that entered the vector (with a fingerprint, not rated). */
	wantToSee: number
	/** The newest write time among the signals (ms since 1970), 0 without any. */
	sourceAt: number
}

/** Adds weight x the title's unit fingerprint to acc. False when the title has no usable fingerprint. */
function addUnit(acc: Float64Array, fp: Uint8Array, weight: number): boolean {
	let squares = 0
	for (let k = 0; k < TASTE_LENGTH; k++) {
		const v = fp[k]
		if (v !== MISSING_SCORE) squares += v * v
	}
	if (squares === 0) return false
	const factor = weight / Math.sqrt(squares)
	for (let k = 0; k < TASTE_LENGTH; k++) {
		const v = fp[k]
		if (v !== MISSING_SCORE) acc[k] += factor * v
	}
	return true
}

/**
 * The unit-length taste vector in VALID_FINGERPRINT_KEYS order, or null below MIN_LIKED liked titles. A title that is
 * both rated and in Want to See counts once, as its rating.
 */
export function tasteVector(
	snapshot: TitleSnapshot,
	signals: TasteSignals,
): TasteCounts & { vector: Float32Array | null } {
	const positive = new Float64Array(TASTE_LENGTH)
	const negative = new Float64Array(TASTE_LENGTH)
	let positiveWeight = 0
	let negativeWeight = 0
	let liked = 0
	let wantToSee = 0
	let sourceAt = 0
	const rated = new Set<TitleKey>()
	for (const { key, score, at } of signals.ratings) {
		rated.add(key)
		sourceAt = Math.max(sourceAt, at)
		const fp = snapshot.fingerprint(key)
		if (!fp) continue
		if (score >= LIKED_FROM) {
			const weight = score - 5
			if (addUnit(positive, fp, weight)) {
				positiveWeight += weight
				liked++
			}
		} else {
			const weight = 6 - score
			if (addUnit(negative, fp, weight)) negativeWeight += weight
		}
	}
	for (const { key, at } of signals.wantToSee) {
		sourceAt = Math.max(sourceAt, at)
		if (rated.has(key)) continue
		const fp = snapshot.fingerprint(key)
		if (fp && addUnit(positive, fp, WANT_TO_SEE_WEIGHT)) {
			positiveWeight += WANT_TO_SEE_WEIGHT
			wantToSee++
		}
	}
	const counts = { ratings: signals.ratings.length, liked, wantToSee, sourceAt }
	if (liked < MIN_LIKED) return { ...counts, vector: null }

	const taste = new Float64Array(TASTE_LENGTH)
	let squares = 0
	for (let k = 0; k < TASTE_LENGTH; k++) {
		const p = positive[k] / positiveWeight
		taste[k] = negativeWeight > 0 ? 2 * p - negative[k] / negativeWeight : p
		squares += taste[k] * taste[k]
	}
	if (squares === 0) return { ...counts, vector: null }
	const norm = Math.sqrt(squares)
	return { ...counts, vector: Float32Array.from(taste, (v) => v / norm) }
}

/**
 * The taste's cosines over the reference pool at QUANTILE_LEVELS, interpolated linearly between ranks. Sorts the
 * cosines in place.
 */
export function quantileTable(cosines: Float32Array): Float32Array {
	const sorted = cosines.sort()
	const n = sorted.length
	const table = new Float32Array(QUANTILES)
	if (n === 0) return table
	for (let q = 0; q < QUANTILES; q++) {
		const position = (QUANTILE_LEVELS[q] / 100) * (n - 1)
		const lo = Math.floor(position)
		const hi = Math.min(lo + 1, n - 1)
		table[q] = sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo)
	}
	return table
}

/**
 * Where a cosine falls in the quantile table, 0 to 100, interpolated linearly between the levels: the share of the
 * reference pool below it, in percent. Single precision, so a percentile kept in a Float32Array is the same number.
 */
export function percentileOf(cosine: number, table: Float32Array): number {
	const last = QUANTILES - 1
	if (cosine <= table[0]) return 0
	if (cosine >= table[last]) return 100
	// The last level at or below the cosine.
	let lo = 0
	let hi = last
	while (hi - lo > 1) {
		const mid = (lo + hi) >>> 1
		if (table[mid] <= cosine) lo = mid
		else hi = mid
	}
	const from = QUANTILE_LEVELS[lo]
	const span = table[hi] - table[lo]
	if (span <= 0) return Math.fround(from)
	return Math.fround(
		from + ((QUANTILE_LEVELS[hi] - from) * (cosine - table[lo])) / span,
	)
}

/** The match shown, 50 to 99, for a percentile and the number of liked titles the taste is built from. */
export const displayMatch = (percentile: number, liked: number) =>
	shownMatch(percentile, liked)

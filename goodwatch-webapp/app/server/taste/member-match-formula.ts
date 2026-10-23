// The match between two members, 1 to 99 (owner decision, 2026-10-23; docs/implementation/member-profile/README.md).
// Pure, so tests and scripts can run it without Redis or Crate; member-match.server.ts reads the inputs.
//
// - Likeness of the two stored taste vectors: their cosine, mapped to 0..1 as (cosine + 1) / 2.
// - From SHARED_FROM titles both rated on: 70 % that likeness and 30 % score agreement, 1 - mean |difference| / 9
//   (1 when every shared score is equal, 0 when every one sits 9 apart). A mean gap is used, not a correlation: a
//   correlation is undefined when one of them gives every shared title the same score, and says nothing about two
//   people who agree on 8s and 9s.
// - The blend is then ranked against a sample of member pairs computed the same way, one table for vector-only pairs
//   and one for blended pairs, so each is compared with its own kind: percent = 1 + round(98 * share of sampled pairs
//   below it). 50 is a typical pair.

/** From this many titles both rated, score agreement joins the blend. */
export const SHARED_FROM = 10
export const VECTOR_WEIGHT = 0.7
/** A ranking table holds the sample's values at these many evenly spaced levels (0 to 100 percent). */
export const RANK_LEVELS = 101

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
	let dot = 0
	let aa = 0
	let bb = 0
	const n = Math.min(a.length, b.length)
	for (let i = 0; i < n; i++) {
		dot += a[i] * b[i]
		aa += a[i] * a[i]
		bb += b[i] * b[i]
	}
	return aa > 0 && bb > 0 ? dot / Math.sqrt(aa * bb) : 0
}

/** 1 - mean |difference| / 9 over the titles both scored (1 to 10); null when there are none. */
export function agreement(pairs: readonly (readonly [number, number])[]): number | null {
	if (!pairs.length) return null
	let gap = 0
	for (const [a, b] of pairs) gap += Math.abs(a - b)
	return Math.max(0, 1 - gap / pairs.length / 9)
}

export interface Blend {
	value: number
	/** Which ranking table it belongs to. */
	kind: "vector" | "blended"
}

/** The blend of two members: vector likeness, with score agreement from SHARED_FROM shared titles on. */
export function blend(vectorA: ArrayLike<number>, vectorB: ArrayLike<number>, shared: readonly (readonly [number, number])[]): Blend {
	const likeness = (cosine(vectorA, vectorB) + 1) / 2
	const agree = shared.length >= SHARED_FROM ? agreement(shared) : null
	return agree === null
		? { value: likeness, kind: "vector" }
		: { value: VECTOR_WEIGHT * likeness + (1 - VECTOR_WEIGHT) * agree, kind: "blended" }
}

/** The sample's values at RANK_LEVELS even levels, ascending; null below `min` values. */
export function rankTable(values: readonly number[], min = 50): number[] | null {
	if (values.length < min) return null
	const sorted = [...values].sort((a, b) => a - b)
	const last = sorted.length - 1
	return Array.from({ length: RANK_LEVELS }, (_, q) => {
		const position = (q / (RANK_LEVELS - 1)) * last
		const lo = Math.floor(position)
		const hi = Math.min(lo + 1, last)
		return sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo)
	})
}

/** The share of the sample below a value, 0 to 1, interpolated between the table's levels. */
export function shareBelow(value: number, table: readonly number[]): number {
	const last = table.length - 1
	if (value <= table[0]) return 0
	if (value >= table[last]) return 1
	let lo = 0
	let hi = last
	while (hi - lo > 1) {
		const mid = (lo + hi) >>> 1
		if (table[mid] <= value) lo = mid
		else hi = mid
	}
	const span = table[hi] - table[lo]
	const within = span > 0 ? (value - table[lo]) / span : 0
	return (lo + within) / last
}

export const percentOf = (share: number) => 1 + Math.round(98 * Math.max(0, Math.min(1, share)))

export interface RankTables {
	vector: number[] | null
	blended: number[] | null
}

/**
 * The match, 1 to 99. A blended pair is ranked among blended pairs; without enough of those in the sample it is ranked
 * among vector pairs. Without any table the blend itself is the share (a fallback until the first sample is built).
 */
export function matchPercent(b: Blend, tables: RankTables | null): number {
	const table = (b.kind === "blended" ? tables?.blended : null) ?? tables?.vector ?? null
	return percentOf(table ? shareBelow(b.value, table) : b.value)
}

/** Up to `max` distinct pairs of indices below n, without repeats, from a seeded generator (so tests are stable). */
export function samplePairs(n: number, max: number, random: () => number = Math.random): [number, number][] {
	const all = (n * (n - 1)) / 2
	const pairs: [number, number][] = []
	if (n < 2) return pairs
	if (all <= max) {
		for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j])
		return pairs
	}
	const seen = new Set<number>()
	while (pairs.length < max) {
		const i = Math.floor(random() * n)
		const j = Math.floor(random() * n)
		if (i === j) continue
		const [a, b] = i < j ? [i, j] : [j, i]
		const id = a * n + b
		if (seen.has(id)) continue
		seen.add(id)
		pairs.push([a, b])
	}
	return pairs
}

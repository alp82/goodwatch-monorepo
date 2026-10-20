// Request-local high/low scores, including a negative-only search.
import type { FilterState } from "~/domain/filter-state"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import { TASTE_LENGTH, quantileTable } from "./formula.server"
import { poolCosines, tastePool } from "./pool.server"
import { makeTaste, type Taste } from "./taste.server"

export function inlineTaste(
	base: Taste | null,
	state: FilterState,
	snapshot: TitleSnapshot,
): Taste | null {
	if (!state.loved?.length && !state.disliked?.length) return base
	const positive = new Float64Array(TASTE_LENGTH)
	const negative = new Float64Array(TASTE_LENGTH)
	let positiveCount = 0
	let negativeCount = 0
	if (base?.vector) {
		positive.set(base.vector)
		positiveCount = 1
	}
	let usable = 0
	let loved = 0
	for (const [keys, isPositive] of [
		[state.loved, true],
		[state.disliked, false],
	] as const) {
		for (const key of new Set(keys ?? [])) {
			const fp = snapshot.fingerprint(key)
			if (!fp) continue
			let norm = 0
			for (const v of fp) if (v !== 255) norm += v * v
			if (!norm) continue
			usable++
			if (isPositive) {
				positiveCount++
				loved++
			} else negativeCount++
			const accumulator = isPositive ? positive : negative
			for (let i = 0; i < accumulator.length; i++)
				if (fp[i] !== 255) accumulator[i] += fp[i] / Math.sqrt(norm)
		}
	}
	if (!usable) return base
	// The saved taste formula: 2P - N for group means, P without dislikes.
	// Counts must not let a longer negative list cancel the positive group's shared features.
	const vector = Float64Array.from(positive, (value, i) => {
		const p = positiveCount ? value / positiveCount : 0
		const n = negativeCount ? negative[i] / negativeCount : 0
		return negativeCount ? 2 * p - n : p
	})
	const norm = Math.hypot(...vector)
	if (!norm) return base
	const unit = Float32Array.from(vector, (v) => v / norm)
	return makeTaste(snapshot, {
		vector: unit,
		quantiles: quantileTable(poolCosines(tastePool(snapshot), unit)),
		ratings: (base?.ratings ?? 0) + usable,
		liked: Math.max(5, (base?.liked ?? 0) + loved),
	})
}

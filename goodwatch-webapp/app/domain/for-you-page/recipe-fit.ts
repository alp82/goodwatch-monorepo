import { FP_KEYS } from "./contract"
import type { PoolStats } from "./rank"
import type { Recipe } from "./shape"

/** Shared Float32 recipe fit scores and threshold for the page and palette. */
export function recipeFitScores(
	library: readonly Recipe[],
	n: number,
	stats: PoolStats,
): Record<string, Float32Array> {
	return Object.fromEntries(
		library.map((recipe) => {
			const keys = Object.entries(recipe.attrs).map(
				([key, weight]) =>
					[FP_KEYS.indexOf(key as (typeof FP_KEYS)[number]), weight] as const,
			)
			const total =
				keys.reduce((sum, [, weight]) => sum + Math.abs(weight), 0) || 1
			const scores = new Float32Array(n)
			for (let i = 0; i < n; i++) {
				let sum = 0
				for (const [key, weight] of keys)
					if (key >= 0) sum += weight * stats.z[i * FP_KEYS.length + key]
				scores[i] = sum / total
			}
			return [recipe.id, scores]
		}),
	)
}
export function recipeFitCounts(
	scores: Record<string, Float32Array>,
): Record<string, number> {
	return Object.fromEntries(
		Object.entries(scores).map(([id, values]) => [
			id,
			values.reduce((count, score) => count + Number(score >= 0.7), 0),
		]),
	)
}

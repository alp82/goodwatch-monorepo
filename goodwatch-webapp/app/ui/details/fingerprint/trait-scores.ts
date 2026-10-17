// Small reductions over a title's trait scores, shared by the scales, the contrasts, and the FAQ answers.

import type { Scores, TraitKey } from "./areas"

/** Keeps a position between 0 and 1. */
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The mean of the two largest values; one value counts against a zero. */
export const meanOfTopTwo = (values: number[]) => {
	const sorted = [...values].sort((a, b) => b - a)
	return (sorted[0] + (sorted[1] ?? 0)) / 2
}

/** The keys, strongest score first. */
export const byScore = (s: Scores, keys: readonly TraitKey[]) =>
	[...keys].sort((a, b) => s[b] - s[a])

/** The key with the strongest score. */
export const strongestOf = (s: Scores, keys: readonly TraitKey[]) =>
	byScore(s, keys)[0]

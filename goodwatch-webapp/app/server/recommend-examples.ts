// Qdrant's recommend-by-example for a guest without taste (guest-recommendations.server.ts): the guest's ratings split
// into positive and negative examples by rank, the top half positive and the bottom half negative, so any ratings work,
// not just high ones. A title scored as high as the best one is never a negative: three loved titles sent at one score
// (the TV quiz, the start page) are three positives.

export type ScoredExample = { score: number }

export function splitExamples<T extends ScoredExample>(items: readonly T[]) {
	const sorted = [...items].sort((a, b) => b.score - a.score)
	const best = sorted[0]?.score
	const midpoint = Math.max(
		Math.ceil(sorted.length / 2),
		sorted.filter((item) => item.score === best).length,
	)
	return {
		positive: sorted.slice(0, midpoint),
		negative: sorted.slice(midpoint),
	}
}

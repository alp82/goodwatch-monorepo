import type { Score } from "~/server/scores.server"

export type RatingLevel = {
	name: "Bad" | "Mediocre" | "Good" | "Excellent"
	lo: Score
	hi: Score
	score: Score
}

export const RATING_LEVELS: readonly RatingLevel[] = [
	{ name: "Bad", lo: 1, hi: 4, score: 3 },
	{ name: "Mediocre", lo: 5, hi: 6, score: 5 },
	{ name: "Good", lo: 7, hi: 8, score: 7 },
	{ name: "Excellent", lo: 9, hi: 10, score: 9 },
]

/** The index of the level a score belongs to. */
export function levelOf(score: number): number {
	return RATING_LEVELS.findIndex((level) => score <= level.hi)
}

export const SCORES: readonly Score[] = Array.from(
	{ length: 10 },
	(_, i) => (i + 1) as Score,
)

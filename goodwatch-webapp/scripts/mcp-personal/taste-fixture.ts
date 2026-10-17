import {
	TASTE_LENGTH,
	quantileTable,
} from "../../app/server/taste/formula.server"
// Test-only populated taste: the real display/percentile calculation over deterministic snapshot cosines.
import { makeTaste } from "../../app/server/taste/taste.server"
import type { TitleSnapshot } from "../../app/server/title-snapshot/snapshot.server"
import { parseTitleKey } from "../../app/utils/title-key"

const quantiles = quantileTable(
	Float32Array.from({ length: 10001 }, (_, i) => i / 10000),
)
export function fixtureTaste(userId: string) {
	if (userId === "mcp-taste-failure")
		throw new Error("Isolated taste read failure")
	const snapshot = {
		cosine(key: number) {
			const { tmdbId } = parseTitleKey(key)
			if (tmdbId === 2003) return null
			const value = 0.7 + (tmdbId % 100) / 1000
			return userId === "mcp-taste-B" ? 1 - value : value
		},
	} as unknown as TitleSnapshot
	return {
		...makeTaste(snapshot, {
			ratings: 20,
			liked: 20,
			vector: new Float32Array(TASTE_LENGTH).fill(1 / Math.sqrt(TASTE_LENGTH)),
			quantiles,
		}),
		reasons: () => [],
		leanings: () => [],
	}
}

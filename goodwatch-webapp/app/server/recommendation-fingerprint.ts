// A short description of the title itself, distinct from personalized match reasons.
import { VALID_FINGERPRINT_KEYS } from "./utils/fingerprint"
import { CRAFT_KEYS } from "./taste/taste.server"
export function recommendationFingerprint(scores: Uint8Array | null): string[] {
	if (!scores) return []
	return VALID_FINGERPRINT_KEYS.map((key, index) => ({
		key,
		score: scores[index],
	}))
		.filter(
			({ key, score }) => score !== 255 && score >= 7 && !CRAFT_KEYS.has(key),
		)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.map((item) => item.key)
}

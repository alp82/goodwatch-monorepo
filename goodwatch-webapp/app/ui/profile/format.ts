import type { Score } from "~/server/scores.server"
import { getVibeColorValue } from "~/utils/ratings"

export const count = (n: number) => n.toLocaleString("en-US")
export const vibe = (score: number) =>
	getVibeColorValue(Math.max(1, Math.min(10, Math.round(score))) as Score)

/** "2019-03" → "March 2019". */
export const monthYear = (ym: string) => {
	const [y, m] = ym.split("-").map(Number)
	return new Date(Date.UTC(y, (m || 1) - 1, 1)).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	})
}

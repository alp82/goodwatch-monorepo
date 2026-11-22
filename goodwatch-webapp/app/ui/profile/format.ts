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

// The person-to-person match's colour: 1 to 99 spread over the score colours, red to green.

/** 0 to 1: how strong the match is, for colour and motion. Matches below 40 all read as far apart. */
export const matchStrength = (percent: number) => Math.min(1, Math.max(0, (percent - 40) / 55))
export const matchColor = (percent: number) => vibe(2 + matchStrength(percent) * 8)

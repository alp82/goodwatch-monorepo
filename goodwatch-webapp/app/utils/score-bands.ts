// The GoodWatch score bands that group a person's titles by score, highest first.
import { scoreWord } from "./ratings.ts"

export interface ScoreBand {
	key: string
	min: number
	max: number
	label: string
}

export const SCORE_BANDS: ScoreBand[] = [
	{ key: "90", min: 90, max: 100, label: "90 to 100" },
	{ key: "80", min: 80, max: 89, label: "80 to 89" },
	{ key: "70", min: 70, max: 79, label: "70 to 79" },
	{ key: "60", min: 60, max: 69, label: "60 to 69" },
	{ key: "30", min: 30, max: 59, label: "30 to 59" },
	{ key: "0", min: 0, max: 29, label: "0 to 29" },
]

/** A band's score words from `scoreWord` at its lowest and highest score: "Excellent to masterpiece", or one word. */
export function scoreBandWords(band: Pick<ScoreBand, "min" | "max">): string {
	const low = scoreWord(band.min) ?? ""
	const high = scoreWord(band.max) ?? ""
	return low === high ? low : `${low} to ${high.toLowerCase()}`
}

/** The heading words for a band key, or null for a key that isn't a band (such as "unrated"). */
export function scoreBandWordsFor(key: string): string | null {
	const band = SCORE_BANDS.find((b) => b.key === key)
	return band ? scoreBandWords(band) : null
}

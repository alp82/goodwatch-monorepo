// Moods: named kinds of evening, such as Funny or Crime & mystery. A title belongs to a mood by a fixed rule over its
// fingerprint (and, for Scary, its genres). A title can belong to several moods or to none, and a person picks up to
// three. Pure and shared by the server and the browser.
//
// The keys are stable identifiers: they appear in URLs and in the title snapshot's mood mask (bit i is MOOD_KEYS[i]),
// so they never change or move. Names and copy live with the pages that show them.
import {
	type CoreScores,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"

export const MOOD_KEYS = [
	"funny",
	"feelgood",
	"romance",
	"action",
	"scary",
	"crime",
	"mind",
	"heavy",
	"worlds",
	"history",
	"growing",
] as const

export type MoodKey = (typeof MOOD_KEYS)[number]

export const MAX_MOODS = 3

type FingerprintKey = keyof CoreScores

/**
 * A fingerprint in either of its two shapes: attribute scores by key (as Crate stores them), or the 74 scores in
 * VALID_FINGERPRINT_KEYS order with 255 for a missing score (as the title snapshot stores them).
 */
export type MoodFingerprint =
	| Readonly<Partial<Record<FingerprintKey, number | null>>>
	| ArrayLike<number>

type Score = (key: FingerprintKey) => number

interface MoodRule {
	key: MoodKey
	test: (score: Score, genres: readonly string[]) => boolean
}

const MISSING = 255
// A title without a title analysis has fewer scores than this and belongs to no mood.
const MIN_SCORES = 10

const KEY_INDEX = Object.fromEntries(
	VALID_FINGERPRINT_KEYS.map((key, i) => [key, i]),
) as Record<FingerprintKey, number>

const humor = (score: Score) =>
	Math.max(
		score("situational_comedy"),
		score("wit_wordplay"),
		score("physical_comedy"),
		score("absurdist_humor"),
		score("satire_parody"),
	)

// In MOOD_KEYS order.
const MOOD_RULES: readonly MoodRule[] = [
	{
		key: "funny",
		// The highest humor score is at least 8, and bleakness is at most 5.
		test: (score) => humor(score) >= 8 && score("bleakness") <= 5,
	},
	{
		key: "feelgood",
		test: (score) =>
			score("wholesome") >= 7 &&
			score("hopefulness") >= 7 &&
			score("bleakness") <= 3,
	},
	{
		key: "romance",
		test: (score) => score("romance") >= 7,
	},
	{
		key: "action",
		test: (score) => score("adrenaline") >= 8 && score("spectacle") >= 7,
	},
	{
		key: "scary",
		test: (score, genres) =>
			score("scare") >= 7 || (genres.includes("Horror") && score("scare") >= 5),
	},
	{
		key: "crime",
		test: (score) =>
			score("mystery") >= 8 ||
			(score("crime") >= 8 &&
				score("intrigue") >= 8 &&
				score("spectacle") <= 7),
	},
	{
		key: "mind",
		test: (score) =>
			score("surrealism") >= 6 ||
			(score("complexity") >= 8 &&
				(score("philosophical") >= 7 || score("non_linear_narrative") >= 8)),
	},
	{
		key: "heavy",
		test: (score) => score("pathos") >= 8 || score("melancholy") >= 8,
	},
	{
		key: "worlds",
		test: (score) => score("fantasy") >= 7 || score("futuristic") >= 7,
	},
	{
		key: "history",
		test: (score) => score("biographical") >= 6 || score("historical") >= 8,
	},
	{
		key: "growing",
		test: (score) => score("coming_of_age") >= 8,
	},
]

function isOrdered(
	fingerprint: MoodFingerprint,
): fingerprint is ArrayLike<number> {
	return typeof (fingerprint as ArrayLike<number>).length === "number"
}

/** The moods a title belongs to, as a bit mask: bit i is MOOD_KEYS[i]. */
export function moodMaskOf(
	fingerprint: MoodFingerprint | null | undefined,
	genres: readonly string[] | null | undefined,
): number {
	if (!fingerprint) return 0
	let present = 0
	let score: Score
	if (isOrdered(fingerprint)) {
		for (let i = 0; i < fingerprint.length; i++)
			if (fingerprint[i] !== MISSING) present++
		score = (key) => {
			const value = fingerprint[KEY_INDEX[key]]
			return value === MISSING || value === undefined ? 0 : value
		}
	} else {
		for (const value of Object.values(fingerprint))
			if (typeof value === "number") present++
		score = (key) => fingerprint[key] ?? 0
	}
	if (present < MIN_SCORES) return 0
	let mask = 0
	for (let i = 0; i < MOOD_RULES.length; i++)
		if (MOOD_RULES[i].test(score, genres ?? [])) mask |= 1 << i
	return mask
}

/** The moods in a mask from moodMaskOf, in MOOD_KEYS order. */
export function moodsInMask(mask: number): MoodKey[] {
	return MOOD_KEYS.filter((_, i) => (mask & (1 << i)) !== 0)
}

/** The moods a title belongs to. A missing score counts as 0; a title without a title analysis belongs to none. */
export function moodsOf(
	fingerprint: MoodFingerprint | null | undefined,
	genres: readonly string[] | null | undefined,
): MoodKey[] {
	return moodsInMask(moodMaskOf(fingerprint, genres))
}

// Moods: named kinds of evening, such as Funny or Crime & mystery. A title belongs to a mood by a fixed rule over its
// fingerprint (and, for Scary, its genres). A title can belong to several moods or to none, and a person picks up to
// three. Pure and shared by the server and the browser.
//
// The keys are stable identifiers: they appear in URLs and in the title snapshot's mood mask (bit i is MOOD_KEYS[i]),
// so they never change or move. The names, descriptions, hues, and rules in words may change.
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

export interface Mood {
	key: MoodKey
	name: string
	/** One line saying what the mood is, for the mood picker. */
	description: string
	/** The mood's color, as a hex color. */
	hue: string
	/** The rule in words, for the picker's fine print. */
	rule: string
}

interface MoodRule extends Mood {
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
		name: "Funny",
		description: "Comedy leads: wit, slapstick or the absurd.",
		hue: "#facc15",
		rule: "Any humor score (situational comedy, wit and wordplay, physical comedy, absurdist humor, satire and parody) 8 or more, and bleakness 5 or less",
		test: (score) => humor(score) >= 8 && score("bleakness") <= 5,
	},
	{
		key: "feelgood",
		name: "Feel-good",
		description: "Warm and hopeful, with nothing grim.",
		hue: "#fb923c",
		rule: "Wholesome 7 or more, hopefulness 7 or more, and bleakness 3 or less",
		test: (score) =>
			score("wholesome") >= 7 &&
			score("hopefulness") >= 7 &&
			score("bleakness") <= 3,
	},
	{
		key: "romance",
		name: "Romance",
		description: "A love story at the center.",
		hue: "#f472b6",
		rule: "Romance 7 or more",
		test: (score) => score("romance") >= 7,
	},
	{
		key: "action",
		name: "Action",
		description: "High adrenaline and big set pieces.",
		hue: "#ef4444",
		rule: "Adrenaline 8 or more and spectacle 7 or more",
		test: (score) => score("adrenaline") >= 8 && score("spectacle") >= 7,
	},
	{
		key: "scary",
		name: "Scary",
		description: "Dread, frights and horror.",
		hue: "#a3e635",
		rule: "Scare 7 or more, or the Horror genre with scare 5 or more",
		test: (score, genres) =>
			score("scare") >= 7 || (genres.includes("Horror") && score("scare") >= 5),
	},
	{
		key: "crime",
		name: "Crime & mystery",
		description: "Puzzles, investigations and heists.",
		hue: "#60a5fa",
		rule: "Mystery 8 or more, or crime 8 or more with intrigue 8 or more and spectacle 7 or less",
		test: (score) =>
			score("mystery") >= 8 ||
			(score("crime") >= 8 &&
				score("intrigue") >= 8 &&
				score("spectacle") <= 7),
	},
	{
		key: "mind",
		name: "Mind-bending",
		description: "Surreal or layered; keeps you thinking.",
		hue: "#c084fc",
		rule: "Surrealism 6 or more, or complexity 8 or more with philosophical 7 or more or non-linear narrative 8 or more",
		test: (score) =>
			score("surrealism") >= 6 ||
			(score("complexity") >= 8 &&
				(score("philosophical") >= 7 || score("non_linear_narrative") >= 8)),
	},
	{
		key: "heavy",
		name: "Heavy",
		description: "Grief, melancholy and big emotions.",
		hue: "#94a3b8",
		rule: "Pathos 8 or more, or melancholy 8 or more",
		test: (score) => score("pathos") >= 8 || score("melancholy") >= 8,
	},
	{
		key: "worlds",
		name: "Other worlds",
		description: "Fantasy realms and imagined futures.",
		hue: "#2dd4bf",
		rule: "Fantasy 7 or more, or futuristic 7 or more",
		test: (score) => score("fantasy") >= 7 || score("futuristic") >= 7,
	},
	{
		key: "history",
		name: "History",
		description: "Real lives and past eras.",
		hue: "#d4a373",
		rule: "Biographical 6 or more, or historical 8 or more",
		test: (score) => score("biographical") >= 6 || score("historical") >= 8,
	},
	{
		key: "growing",
		name: "Coming of age",
		description: "Growing up and finding your way.",
		hue: "#f5d0fe",
		rule: "Coming of age 8 or more",
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

/** The 11 moods in MOOD_KEYS order, without their tests. */
export const MOODS: readonly Mood[] = MOOD_RULES.map(
	({ key, name, description, hue, rule }) => ({
		key,
		name,
		description,
		hue,
		rule,
	}),
)

export const MOOD_BY_KEY = Object.fromEntries(
	MOODS.map((mood) => [mood.key, mood]),
) as Record<MoodKey, Mood>

export const isMoodKey = (value: string): value is MoodKey =>
	(MOOD_KEYS as readonly string[]).includes(value)

/** The moods a URL names (`moods=funny,scary`): known keys only, each once, in the given order, at most MAX_MOODS. */
export function parseMoods(value: string | null | undefined): MoodKey[] {
	const moods: MoodKey[] = []
	for (const part of (value ?? "").split(",")) {
		const key = part.trim()
		if (isMoodKey(key) && !moods.includes(key)) moods.push(key)
		if (moods.length === MAX_MOODS) break
	}
	return moods
}

/**
 * Picks or unpicks a mood. A pick beyond MAX_MOODS is refused and leaves the moods as they are; the caller says why
 * ("Three is the most. Remove one to add X.").
 */
export function toggleMood(
	moods: readonly MoodKey[],
	key: MoodKey,
): { moods: MoodKey[]; refused: boolean } {
	if (moods.includes(key))
		return { moods: moods.filter((m) => m !== key), refused: false }
	if (moods.length >= MAX_MOODS) return { moods: [...moods], refused: true }
	return { moods: [...moods, key], refused: false }
}

/** The mask of some moods, with the bits of moodMaskOf. Picked moods combine with OR: a title fits when it shares a bit. */
export function maskOfMoods(moods: readonly MoodKey[]): number {
	let mask = 0
	for (const key of moods) mask |= 1 << MOOD_KEYS.indexOf(key)
	return mask
}

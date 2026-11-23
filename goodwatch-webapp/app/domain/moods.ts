// Moods: named kinds of evening, such as Funny or Mysterious. A title belongs to a mood by a fixed rule over its
// fingerprint (and, for Scary, its genres). A title can belong to several moods or to none, and a person picks up to
// three. Pure and shared by the server and the browser.
//
// The keys are stable identifiers: they appear in URLs and in the title snapshot's mood mask (bit i is MOOD_KEYS[i]),
// so they never change or move. The names, descriptions, hues, and rules in words may change.
import { type CoreScores, VALID_FINGERPRINT_KEYS } from "../server/utils/fingerprint.ts"

export const MOOD_KEYS = [
	"funny",
	"feelgood",
	"romance",
	"action",
	"scary",
	"mysterious",
	"mind",
	"heavy",
	"otherworldly",
	"adventurous",
	"growing",
	"tense",
	"dark",
	"deep",
	"magical",
	"quirky",
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
	/** Previous names accepted when matching mood words. */
	aliases: readonly string[]
	/** False for topic moods; reserved for Discover’s future Feel column. */
	feel: boolean
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

const KEY_INDEX = Object.fromEntries(VALID_FINGERPRINT_KEYS.map((key, i) => [key, i])) as Record<
	FingerprintKey,
	number
>

const has = (genres: readonly string[], ...names: string[]) =>
	names.some((name) => genres.includes(name))

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
		aliases: [],
		feel: true,
		description: "Comedy leads: wit, slapstick or the absurd.",
		hue: "#facc15",
		rule: "Bleakness 5 or less, and either the Comedy genre with any humor score (situational comedy, wit and wordplay, physical comedy, absurdist humor, satire and parody) 7 or more, or situational comedy, physical comedy, absurdist humor or satire and parody 9 or more with violence 5 or less",
		// Wit alone isn't comedy: sharp dialogue lifted Pulp Fiction, The Social Network and Good Will Hunting in.
		test: (score, genres) =>
			score("bleakness") <= 5 &&
			((has(genres, "Comedy") && humor(score) >= 7) ||
				(Math.max(
					score("situational_comedy"),
					score("physical_comedy"),
					score("absurdist_humor"),
					score("satire_parody"),
				) >= 9 &&
					score("violence") <= 5)),
	},
	{
		key: "feelgood",
		name: "Cozy",
		aliases: ["Feel-good"],
		feel: true,
		description: "Warm and hopeful, with nothing grim.",
		hue: "#fb923c",
		rule: "Wholesome 7 or more, hopefulness 7 or more, bleakness 3 or less, adrenaline 6 or less, violence 3 or less, and tension 6 or less",
		// Low stakes too: without the last three, Star Wars and Top Gun: Maverick were Cozy.
		test: (score) =>
			score("wholesome") >= 7 &&
			score("hopefulness") >= 7 &&
			score("bleakness") <= 3 &&
			score("adrenaline") <= 6 &&
			score("violence") <= 3 &&
			score("tension") <= 6,
	},
	{
		key: "romance",
		name: "Romantic",
		aliases: ["Romance"],
		feel: true,
		description: "A love story at the center.",
		hue: "#f472b6",
		rule: "Not Horror, and either the Romance genre with romance 6 or more, or romance 8 or more with adrenaline 6 or less",
		// A subplot isn't a love story: Bride of Chucky, The Empire Strikes Back and Casino Royale were Romantic.
		test: (score, genres) =>
			!has(genres, "Horror") &&
			((has(genres, "Romance") && score("romance") >= 6) ||
				(score("romance") >= 8 && score("adrenaline") <= 6)),
	},
	{
		key: "action",
		name: "Thrilling",
		aliases: ["Action"],
		feel: true,
		description: "High adrenaline and big set pieces.",
		hue: "#ef4444",
		rule: "Adrenaline 8 or more and spectacle 7 or more",
		test: (score) => score("adrenaline") >= 8 && score("spectacle") >= 7,
	},
	{
		key: "scary",
		name: "Scary",
		aliases: [],
		feel: true,
		description: "Dread, frights and horror.",
		hue: "#a3e635",
		rule: "The Horror genre with scare 5 or more, or scare 8 or more with uncanny or grotesque 6 or more",
		// Peril isn't horror: war films and adventures (Saving Private Ryan, The Return of the King) scored scare 7.
		test: (score, genres) =>
			(has(genres, "Horror") && score("scare") >= 5) ||
			(score("scare") >= 8 && (score("uncanny") >= 6 || score("grotesque") >= 6)),
	},
	{
		key: "mysterious",
		name: "Mysterious",
		aliases: ["Crime & mystery"],
		feel: true,
		description: "Clues and unanswered questions draw you in.",
		hue: "#60a5fa",
		rule: "Mystery 8 or more",
		test: (score) => score("mystery") >= 8,
	},
	{
		key: "mind",
		name: "Trippy",
		aliases: ["Mind-bending"],
		feel: true,
		description: "Surreal or layered; keeps you thinking.",
		hue: "#c084fc",
		rule: "Surrealism 7 or more, psychedelic 8 or more, or non-linear narrative 8 or more with complexity 8 or more and meta-narrative 6 or more or ambiguity 7 or more",
		// Complex and philosophical isn't trippy (Schindler's List, The Godfather Part II); Deep covers those.
		test: (score) =>
			score("surrealism") >= 7 ||
			score("psychedelic") >= 8 ||
			(score("non_linear_narrative") >= 8 &&
				score("complexity") >= 8 &&
				(score("meta_narrative") >= 6 || score("ambiguity") >= 7)),
	},
	{
		key: "heavy",
		name: "Sad",
		aliases: ["Heavy"],
		feel: true,
		description: "Grief, melancholy and big emotions.",
		hue: "#94a3b8",
		rule: "Adrenaline 7 or less, and melancholy 8 or more with pathos 7 or more, or pathos 8 or more with melancholy 6 or more",
		// Big emotions, not big battles: Avengers: Endgame and The Dark Knight Rises were Sad.
		test: (score) =>
			score("adrenaline") <= 7 &&
			((score("melancholy") >= 8 && score("pathos") >= 7) ||
				(score("pathos") >= 8 && score("melancholy") >= 6)),
	},
	{
		key: "otherworldly",
		name: "Otherworldly",
		aliases: ["Other worlds"],
		feel: true,
		description: "Fantasy realms and imagined futures.",
		hue: "#2dd4bf",
		rule: "Fantasy 7 or more or futuristic 7 or more, with world immersion 6 or more",
		test: (score) =>
			(score("fantasy") >= 7 || score("futuristic") >= 7) && score("world_immersion") >= 6,
	},
	{
		key: "adventurous",
		name: "Adventurous",
		aliases: [],
		feel: true,
		description: "Quests, expeditions, and the thrill of discovery.",
		hue: "#d4a373",
		rule: "Adventure or Action & Adventure genre, with wonder and world immersion both 6 or more",
		test: (score, genres) =>
			has(genres, "Adventure", "Action & Adventure") &&
			score("wonder") >= 6 &&
			score("world_immersion") >= 6,
	},
	{
		key: "growing",
		name: "Growing up",
		aliases: ["Coming of age"],
		feel: true,
		description: "Growing up and finding your way.",
		hue: "#f5d0fe",
		rule: "Coming of age 8 or more",
		test: (score) => score("coming_of_age") >= 8,
	},
	// Fixed starting thresholds from Explorer’s mood islands; Explorer may adapt its thresholds.
	{
		key: "tense",
		name: "Tense",
		aliases: [],
		feel: true,
		description: "Suspense without action or horror.",
		hue: "#5b7fa8",
		rule: "Tension 8 or more, adrenaline 6 or less, and scare 6 or less",
		test: (score) => score("tension") >= 8 && score("adrenaline") <= 6 && score("scare") <= 6,
	},
	{
		key: "dark",
		name: "Dark",
		aliases: [],
		feel: true,
		description: "Bleak stories with little light.",
		hue: "#6a5aa8",
		rule: "Bleakness 8 or more",
		test: (score) => score("bleakness") >= 8,
	},
	{
		key: "deep",
		name: "Deep",
		aliases: [],
		feel: true,
		description: "Big questions that stay with you.",
		hue: "#3fc1b0",
		rule: "Philosophical 8 or more",
		test: (score) => score("philosophical") >= 8,
	},
	{
		key: "magical",
		name: "Magical",
		aliases: [],
		feel: true,
		description: "A sense of wonder and possibility.",
		hue: "#e9a23b",
		rule: "Wonder 8 or more, fantasy 6 or more, futuristic 5 or less, adrenaline 7 or less, and bleakness 5 or less",
		// Awe isn't magic: Interstellar, Titanic and the Avengers films scored wonder 8.
		test: (score) =>
			score("wonder") >= 8 &&
			score("fantasy") >= 6 &&
			score("futuristic") <= 5 &&
			score("adrenaline") <= 7 &&
			score("bleakness") <= 5,
	},
	{
		key: "quirky",
		name: "Quirky",
		aliases: [],
		feel: true,
		description: "Eccentric people and offbeat stories.",
		hue: "#b98a5a",
		rule: "Eccentricity 8 or more, violence 5 or less, and bleakness 6 or less",
		// Offbeat, not unhinged: Fight Club, Joker and American Psycho were Quirky.
		test: (score) =>
			score("eccentricity") >= 8 && score("violence") <= 5 && score("bleakness") <= 6,
	},
]

function isOrdered(fingerprint: MoodFingerprint): fingerprint is ArrayLike<number> {
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
		for (let i = 0; i < fingerprint.length; i++) if (fingerprint[i] !== MISSING) present++
		score = (key) => {
			const value = fingerprint[KEY_INDEX[key]]
			return value === MISSING || value === undefined ? 0 : value
		}
	} else {
		for (const value of Object.values(fingerprint)) if (typeof value === "number") present++
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

/** The moods in MOOD_KEYS order, without their tests. */
export const MOODS: readonly Mood[] = MOOD_RULES.map(
	({ key, name, aliases, feel, description, hue, rule }) => ({
		key,
		name,
		aliases,
		feel,
		description,
		hue,
		rule,
	}),
)

export const MOOD_BY_KEY = Object.fromEntries(MOODS.map((mood) => [mood.key, mood])) as Record<
	MoodKey,
	Mood
>

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
	if (moods.includes(key)) return { moods: moods.filter((m) => m !== key), refused: false }
	if (moods.length >= MAX_MOODS) return { moods: [...moods], refused: true }
	return { moods: [...moods, key], refused: false }
}

/** The mask of some moods, with the bits of moodMaskOf. Picked moods combine with OR: a title fits when it shares a bit. */
export function maskOfMoods(moods: readonly MoodKey[]): number {
	let mask = 0
	for (const key of moods) mask |= 1 << MOOD_KEYS.indexOf(key)
	return mask
}

/** Match whole mood names, including previous names, ignoring case and hyphen/space differences. */
const moodWords = (text: string) =>
	text
		.toLowerCase()
		.replace(/[-‐‑–—]/g, " ")
		.replace(/[^\p{L}\p{N}& ]/gu, " ")
		.replace(/\s+/g, " ")
		.trim()
/** Mood words in descriptive search text, with word boundaries ("sad" does not match "saddle"). */
export function moodsInText(text: string): readonly Mood[] {
	const wanted = ` ${moodWords(text)} `
	return MOODS.filter((mood) =>
		[mood.name, ...mood.aliases].some((name) => wanted.includes(` ${moodWords(name)} `)),
	)
}

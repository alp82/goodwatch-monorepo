import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { WORD_BY_ID } from "~/domain/taste-picker"
// The start page's room lighting (docs/implementation/start-page-redesign.md, "Room lighting"): the room takes on the
// color of what the guest asked for, as full-size color layers over the painting that crossfade (RoomGrade.tsx). Only
// the color grade and the resting dim ship; no moving effects.
//
// What lights the room: the picks' lead word (a mix leads with its first part), otherwise the search's reading (its
// "want" chips, the grade with the most of them), otherwise nothing. A typed search grades when its reading arrives,
// not per keystroke. Pure, so the mapping is tested without React (grades.test.ts).
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { leadWord } from "../moods/mixes"
import {
	type StartQuery,
	type StartResults,
	querySignature,
} from "../stage/start-query"

export type Blend =
	| "soft-light"
	| "screen"
	| "multiply"
	| "saturation"
	| "color"
	| "overlay"

/** One full-size layer over the room: a color, how it blends with the room under it, at an opacity. */
export interface Layer {
	bg: string
	blend: Blend
	o: number
}

export const GRADE_KEYS = [
	"feelgood",
	"funny",
	"romance",
	"action",
	"scary",
	"crime",
	"mystery",
	"mind",
	"heavy",
	"worlds",
	"history",
	"growing",
	"tense",
	"dark",
	"deep",
	"magical",
	"quirky",
] as const
export type GradeKey = (typeof GRADE_KEYS)[number]

/** A grade key, a word's own color (`color:#hex`), or null for the resting room. */
export type Grade = GradeKey | `color:${string}` | null

const GRAY = "#808080"
const hue = (mood: MoodKey) => MOOD_BY_KEY[mood].hue

/**
 * The layers per grade, bottom to top. `soft-light` tints and warms without flattening, `screen` lifts the light,
 * `multiply` darkens and cools, `saturation` with a gray drains color, `color` gives a cast, `overlay` tints and adds
 * contrast. The bright moods lift the dimmed resting room gently; crime keeps a drained, cold noir cast without
 * going too dark.
 */
const CRIME: Layer[] = [
	{ bg: GRAY, blend: "saturation", o: 0.72 },
	{ bg: hue("crime"), blend: "color", o: 0.5 },
	{ bg: "rgb(20 30 50)", blend: "multiply", o: 0.37 },
]

export const GRADES: Readonly<Record<GradeKey, readonly Layer[]>> = {
	feelgood: [
		{ bg: hue("feelgood"), blend: "soft-light", o: 0.4 },
		{ bg: "rgb(255 196 130)", blend: "screen", o: 0.09 },
	],
	funny: [
		{ bg: hue("funny"), blend: "soft-light", o: 0.34 },
		{ bg: "rgb(255 236 150)", blend: "screen", o: 0.08 },
	],
	romance: [
		{ bg: hue("romance"), blend: "soft-light", o: 0.4 },
		{ bg: "rgb(255 150 190)", blend: "screen", o: 0.065 },
	],
	action: [
		{ bg: hue("action"), blend: "overlay", o: 0.46 },
		{ bg: "rgb(40 10 10)", blend: "soft-light", o: 0.85 },
	],
	scary: [
		{ bg: GRAY, blend: "saturation", o: 0.75 },
		{ bg: "rgb(30 52 72)", blend: "multiply", o: 0.88 },
		{ bg: hue("scary"), blend: "soft-light", o: 0.32 },
	],
	crime: CRIME,
	mystery: CRIME,
	mind: [
		{ bg: hue("mind"), blend: "color", o: 0.5 },
		{ bg: hue("mind"), blend: "soft-light", o: 0.78 },
	],
	heavy: [
		{ bg: GRAY, blend: "saturation", o: 0.92 },
		{ bg: "rgb(52 58 70)", blend: "multiply", o: 0.72 },
	],
	worlds: [
		{ bg: hue("worlds"), blend: "soft-light", o: 0.36 },
		{ bg: "rgb(20 60 80)", blend: "multiply", o: 0.12 },
	],
	history: [
		{ bg: GRAY, blend: "saturation", o: 0.72 },
		{ bg: hue("history"), blend: "soft-light", o: 1 },
	],
	growing: [
		{ bg: hue("growing"), blend: "soft-light", o: 0.31 },
		{ bg: "rgb(255 220 250)", blend: "screen", o: 0.08 },
	],
	tense: [
		{ bg: GRAY, blend: "saturation", o: 0.5 },
		{ bg: hue("tense"), blend: "soft-light", o: 0.42 },
		{ bg: "rgb(30 36 48)", blend: "multiply", o: 0.3 },
	],
	dark: [
		{ bg: GRAY, blend: "saturation", o: 0.8 },
		{ bg: "rgb(28 30 42)", blend: "multiply", o: 0.78 },
		{ bg: hue("dark"), blend: "soft-light", o: 0.24 },
	],
	deep: [
		{ bg: hue("deep"), blend: "color", o: 0.36 },
		{ bg: hue("deep"), blend: "soft-light", o: 0.5 },
	],
	magical: [
		{ bg: hue("magical"), blend: "soft-light", o: 0.42 },
		{ bg: "rgb(205 185 255)", blend: "screen", o: 0.09 },
	],
	quirky: [
		{ bg: hue("quirky"), blend: "soft-light", o: 0.38 },
		{ bg: "rgb(255 230 170)", blend: "screen", o: 0.07 },
	],
}

/** The resting room: a little dimmer and flatter while no grade is on, so a bright grade visibly lifts it. */
export const REST_DIM: readonly Layer[] = [
	{ bg: "rgb(24 28 40)", blend: "multiply", o: 0.2 },
	{ bg: GRAY, blend: "saturation", o: 0.14 },
]

/** A word without a grade tints the room with its own color, soft-light at this opacity. */
export const COLOR_STRONG = 0.72

/** Themes and styles onto a grade (by taste picker id); null tints with the word's own color. Moods are their own. */
export const GRADE_OF_WORD: Readonly<Record<string, GradeKey | null>> = {
	"t:crime": "crime",
	"t:mystery": "mystery",
	"t:war": "heavy",
	"t:politics": "crime",
	"t:true": "history",
	"t:history": "history",
	"t:family": "feelgood",
	"t:mind": "mind",
	"t:showbiz": "funny",
	"t:sports": "action",
	"t:money": "crime",
	"t:future": "worlds",
	"t:fantasy": "worlds",
	"s:animated": "growing",
	"s:documentary": null,
	"s:spectacle": "action",
	"s:stylized": "mind",
	"s:music": "romance",
	"s:slow": "heavy",
	"s:fast": "action",
	"s:talky": null,
	"s:nonlinear": "mind",
	"s:graphic": "scary",
}

/** A reading's fingerprint keys (its "want" chips) onto a grade. */
export const GRADE_OF_KEY: Readonly<Record<string, GradeKey>> = {
	scare: "scary",
	uncanny: "scary",
	grotesque: "scary",
	tension: "crime",
	crime: "crime",
	mystery: "mystery",
	intrigue: "mystery",
	adrenaline: "action",
	violence: "action",
	fast_pace: "action",
	spectacle: "action",
	romance: "romance",
	eroticism: "romance",
	wholesome: "feelgood",
	hopefulness: "feelgood",
	nostalgia: "feelgood",
	situational_comedy: "funny",
	wit_wordplay: "funny",
	physical_comedy: "funny",
	absurdist_humor: "funny",
	satire_parody: "funny",
	melancholy: "heavy",
	pathos: "heavy",
	bleakness: "heavy",
	catharsis: "heavy",
	warfare: "heavy",
	wonder: "worlds",
	fantasy: "worlds",
	futuristic: "worlds",
	world_immersion: "worlds",
	psychological: "mind",
	surrealism: "mind",
	psychedelic: "mind",
	complexity: "mind",
	non_linear_narrative: "mind",
	meta_narrative: "mind",
	philosophical: "mind",
	historical: "history",
	biographical: "history",
	coming_of_age: "growing",
	family_dynamics: "growing",
}

const isGradeKey = (key: string): key is GradeKey =>
	(GRADE_KEYS as readonly string[]).includes(key)

/** A word's grade: a mood's own, a theme's or style's from GRADE_OF_WORD, else its own color; null for no word. */
export function gradeOfWord(id: string): Grade {
	const word = WORD_BY_ID[id]
	if (!word) return null
	if (word.kind === "mood" && isGradeKey(word.key)) return word.key
	return GRADE_OF_WORD[id] ?? `color:${word.hue}`
}

/** A reading's grade: the grade with the most "want" chips, the first seen on a tie; null when none has one. */
export function gradeOfReading(
	reading: readonly ReadingChip[] | null,
): GradeKey | null {
	if (!reading) return null
	const tally = new Map<GradeKey, number>()
	for (const chip of reading) {
		const grade =
			chip.kind === "want" && chip.key ? GRADE_OF_KEY[chip.key] : undefined
		if (grade) tally.set(grade, (tally.get(grade) ?? 0) + 1)
	}
	let best: GradeKey | null = null
	for (const [grade, n] of tally)
		if (!best || n > (tally.get(best) ?? 0)) best = grade
	return best
}

/**
 * The room's grade for a query and the results on show. Undefined while a typed search's reading is on its way (the
 * room keeps its last grade until it arrives).
 */
export function roomGrade(
	query: Pick<StartQuery, "text" | "picks">,
	results: Pick<StartResults, "signature" | "status" | "reading">,
): Grade | undefined {
	const lead = leadWord(query.picks)
	if (lead) return gradeOfWord(lead)
	if (!query.text) return null
	const current = results.signature === querySignature(query)
	if (current && results.reading) return gradeOfReading(results.reading)
	if (current && (results.status === "ready" || results.status === "error"))
		return null
	return undefined
}

/** A grade's layers: its table entry, or one soft-light layer of a word's color. */
export function layersOf(grade: Exclude<Grade, null>): readonly Layer[] {
	if (grade.startsWith("color:"))
		return [{ bg: grade.slice(6), blend: "soft-light", o: COLOR_STRONG }]
	return isGradeKey(grade) ? GRADES[grade] : []
}

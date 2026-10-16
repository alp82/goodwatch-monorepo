// The taste picker on Watch next (#677, decided in #659): moods, themes, styles, and the member's taste groups in one
// picker. Pure and shared by the server and the browser.
//
// - A choice has an id: "m:funny", "t:crime", "s:slow" for the filters' words, "g1", "g2"... for the member's taste
//   groups, largest first. In the URL they travel as Discover's parameters (`moods`, `themes`, `styles`) and
//   `taste=movie-603`: a taste group by its key, the loved title closest to its center, so a saved link keeps its group
//   when the groups change size or order (#680). Links from before name a group by its size order (`taste=2`).
// - Picks combine by Discover's rule: any within a kind (taste group, mood, theme, style), every kind picked. Another
//   pick of the same kind adds titles; a pick of another kind narrows them. With moods only, that is Watch next's own
//   rule. Up to three picks in all.
// - The words keep the filters' names and colors, with two exceptions where the three kinds overlap: the theme Growing
//   up is the mood Coming of age by the same rule, so it is left out, and the themes History and The mind read "Period
//   pieces" and "Psychological" next to the moods History and Mind-bending.
import { type TitleKey, parseTitleKey, titleKey } from "~/utils/title-key"
import { MOODS, MOOD_KEYS, type MoodKey } from "./moods"
import {
	STYLES,
	STYLE_KEYS,
	type StyleKey,
	THEMES,
	THEME_KEYS,
	type ThemeKey,
} from "./themes-styles"

export const MAX_PICKS = 3

export type ChoiceKind = "taste" | "mood" | "theme" | "style"
export const WORD_KINDS = ["mood", "theme", "style"] as const
export type WordKind = (typeof WORD_KINDS)[number]

export interface Word {
	/** "m:funny", "t:crime", "s:slow". */
	id: string
	kind: WordKind
	key: MoodKey | ThemeKey | StyleKey
	name: string
	/** Its color, as the filters show it. */
	hue: string
	/** What it is, in one line (moods only). */
	description: string | null
}

const THEME_NAMES: Partial<Record<ThemeKey, string>> = {
	history: "Period pieces",
	mind: "Psychological",
}
/** The same rule as a mood (Growing up is Coming of age). */
const LEFT_OUT_THEMES: readonly ThemeKey[] = ["growing"]

export const WORDS: readonly Word[] = [
	...MOODS.map((m) => ({
		id: `m:${m.key}`,
		kind: "mood" as const,
		key: m.key,
		name: m.name,
		hue: m.hue,
		description: m.description,
	})),
	...THEMES.filter((t) => !LEFT_OUT_THEMES.includes(t.id)).map((t) => ({
		id: `t:${t.id}`,
		kind: "theme" as const,
		key: t.id,
		name: THEME_NAMES[t.id] ?? t.name,
		hue: t.color,
		description: null,
	})),
	...STYLES.map((s) => ({
		id: `s:${s.id}`,
		kind: "style" as const,
		key: s.id,
		name: s.name,
		hue: s.color,
		description: null,
	})),
]

export const WORD_BY_ID: Readonly<Record<string, Word>> = Object.fromEntries(
	WORDS.map((w) => [w.id, w]),
)

/** A taste group's choice id: "g1" for the largest. */
export const groupChoice = (number: number) => `g${number}`
/** The group a choice id names (1 for "g1"); null for a word. */
export function groupNumber(id: string): number | null {
	const match = /^g([1-9])$/.exec(id)
	return match ? Number(match[1]) : null
}

export function kindOf(id: string): ChoiceKind | null {
	if (groupNumber(id) !== null) return "taste"
	return WORD_BY_ID[id]?.kind ?? null
}

/** The picks as the URL holds them. */
export interface Picks {
	moods: MoodKey[]
	themes: ThemeKey[]
	styles: StyleKey[]
	/** Taste group numbers, 1 for the largest. */
	taste: number[]
}

export const NO_PICKS: Picks = { moods: [], themes: [], styles: [], taste: [] }

/** The picks as choice ids: taste groups, then moods, themes, and styles. */
export function pickIds(picks: Picks): string[] {
	return [
		...picks.taste.map(groupChoice),
		...picks.moods.map((m) => `m:${m}`),
		...picks.themes.map((t) => `t:${t}`),
		...picks.styles.map((s) => `s:${s}`),
	]
}

/** Choice ids as picks; unknown ids and anything past the third pick are left out. */
export function picksOf(ids: readonly string[]): Picks {
	const picks: Picks = { moods: [], themes: [], styles: [], taste: [] }
	for (const id of [...new Set(ids)].slice(0, MAX_PICKS)) {
		const group = groupNumber(id)
		if (group !== null) picks.taste.push(group)
		else if (WORD_BY_ID[id]?.kind === "mood")
			picks.moods.push(WORD_BY_ID[id].key as MoodKey)
		else if (WORD_BY_ID[id]?.kind === "theme")
			picks.themes.push(WORD_BY_ID[id].key as ThemeKey)
		else if (WORD_BY_ID[id]?.kind === "style")
			picks.styles.push(WORD_BY_ID[id].key as StyleKey)
	}
	return picks
}

/** At most three picks: taste groups first, then moods, themes, and styles, as the URL lists them. */
export const trimPicks = (picks: Picks): Picks => picksOf(pickIds(picks))

/** Picks or unpicks a choice; a fourth pick is refused and changes nothing. */
export function togglePick(
	picks: Picks,
	id: string,
): { picks: Picks; refused: boolean } {
	const ids = pickIds(picks)
	if (ids.includes(id))
		return { picks: picksOf(ids.filter((x) => x !== id)), refused: false }
	if (ids.length >= MAX_PICKS) return { picks, refused: true }
	return { picks: picksOf([...ids, id]), refused: false }
}

/** A taste group's key in the URL, from the loved title closest to its center: "movie-603". */
export function groupKeyOf(key: TitleKey): string {
	const { mediaType, tmdbId } = parseTitleKey(key)
	return `${mediaType}-${tmdbId}`
}

/** The title a group key names; null when it names none. */
export function titleOfGroupKey(ref: string): TitleKey | null {
	const match = /^(movie|show)-([1-9]\d{0,9})$/.exec(ref)
	return match ? titleKey(match[1] as "movie" | "show", Number(match[2])) : null
}

/** A taste group a link from before #680 names by its size order: 1 to 9; null for a group key. */
export const legacyGroupNumber = (ref: string): number | null =>
	/^[1-9]$/.test(ref) ? Number(ref) : null

/** The taste groups `taste=movie-603,2` names: group keys, or a group's size order (1 to 9) from older links. Each once. */
export function tasteRefsOf(value: string | null | undefined): string[] {
	const refs = (value ?? "")
		.split(",")
		.map((x) => x.trim())
		.filter((x) => legacyGroupNumber(x) !== null || titleOfGroupKey(x) !== null)
	return [...new Set(refs)]
}

/**
 * Whether a title has the picks, by Discover's rule: for every kind picked, it has at least one pick of that kind.
 * `has` says whether the title has one choice. No picks: every title fits.
 */
export function fitsPicks(
	ids: readonly string[],
	has: (id: string) => boolean,
): boolean {
	const kinds = new Map<ChoiceKind, string[]>()
	for (const id of ids) {
		const kind = kindOf(id)
		if (kind) kinds.set(kind, [...(kinds.get(kind) ?? []), id])
	}
	for (const list of kinds.values()) if (!list.some(has)) return false
	return true
}

/** How many of the kinds picked a title meets: the fit count Watch next ranks by. */
export function kindsMet(
	ids: readonly string[],
	has: (id: string) => boolean,
): { met: number; picked: number } {
	const kinds = new Map<ChoiceKind, boolean>()
	for (const id of ids) {
		const kind = kindOf(id)
		if (kind) kinds.set(kind, (kinds.get(kind) ?? false) || has(id))
	}
	return {
		met: [...kinds.values()].filter(Boolean).length,
		picked: kinds.size,
	}
}

/**
 * Words that mostly hold the same titles across the catalog (at least 55% of one is the other, #659 research): the
 * picker never suggests one next to the other, and a group's colors never pair them.
 */
const SAME_GROUND: readonly [string, string][] = [
	["m:crime", "t:mystery"],
	["m:crime", "t:crime"],
	["m:worlds", "t:fantasy"],
	["m:worlds", "t:future"],
	["m:history", "t:true"],
	["m:history", "t:history"],
	["m:history", "t:war"],
	["m:action", "s:fast"],
	["m:action", "s:spectacle"],
]
export const sameGround = (a: string, b: string) =>
	SAME_GROUND.some(([x, y]) => (x === a && y === b) || (x === b && y === a))

/** Styles in most of what anyone loves (Music in 42 to 100% of every group): never a group's color or a suggestion. */
export const NEVER_APART: readonly string[] = ["s:music", "s:talky"]

/** A title's words as bit masks, as the title snapshot holds them (bit i is MOOD_KEYS[i], THEME_KEYS[i], STYLE_KEYS[i]). */
export interface WordMasks {
	moods: number
	themes: number
	styles: number
}

export function hasWord(masks: WordMasks, word: Word): boolean {
	if (word.kind === "mood")
		return (masks.moods & (1 << MOOD_KEYS.indexOf(word.key as MoodKey))) !== 0
	if (word.kind === "theme")
		return (
			(masks.themes & (1 << THEME_KEYS.indexOf(word.key as ThemeKey))) !== 0
		)
	return (masks.styles & (1 << STYLE_KEYS.indexOf(word.key as StyleKey))) !== 0
}

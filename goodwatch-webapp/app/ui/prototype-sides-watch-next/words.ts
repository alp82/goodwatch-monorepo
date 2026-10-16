// PROTOTYPE - throwaway (#659, round 4). The filters' three kinds of words (mood, theme, style) as one vocabulary, so
// the round 4 variants can put them next to the member's taste groups. Browser-safe.
//
// The three overlap (research, round 4): Coming of age (mood) and Growing up (theme) are the same rule, so the theme
// is left out; History is both a mood and a theme with different rules, so the theme takes the noun the taste group
// names use ("Period pieces"); The mind (theme) sits next to Mind-bending (mood), so it reads "Psychological".
import { MOODS, MOOD_KEYS, type MoodKey } from "~/domain/moods"
import {
	STYLES,
	STYLE_KEYS,
	type StyleKey,
	THEMES,
	THEME_KEYS,
	type ThemeKey,
} from "~/domain/themes-styles"

export type WordKind = "mood" | "theme" | "style"

export interface Word {
	/** "m:funny", "t:crime", "s:slow": stable, for URLs. */
	id: string
	kind: WordKind
	key: MoodKey | ThemeKey | StyleKey
	name: string
	/** The bit in the snapshot's mask of its kind. */
	bit: number
	/** What it is, in one line (moods only; production's description). */
	description?: string
}

/** Theme names that would read twice next to a mood, by the noun the taste group names use. */
const THEME_NAMES: Partial<Record<ThemeKey, string>> = {
	history: "Period pieces",
	mind: "Psychological",
}
/** The same rule as a mood. */
const SAME_AS_MOOD: readonly ThemeKey[] = ["growing"]

export const WORDS: readonly Word[] = [
	...MOODS.map((m) => ({
		id: `m:${m.key}`,
		kind: "mood" as const,
		key: m.key,
		name: m.name,
		bit: MOOD_KEYS.indexOf(m.key),
		description: m.description,
	})),
	...THEMES.filter((t) => !SAME_AS_MOOD.includes(t.id)).map((t) => ({
		id: `t:${t.id}`,
		kind: "theme" as const,
		key: t.id,
		name: THEME_NAMES[t.id] ?? t.name,
		bit: THEME_KEYS.indexOf(t.id),
	})),
	...STYLES.map((s) => ({
		id: `s:${s.id}`,
		kind: "style" as const,
		key: s.id,
		name: s.name,
		bit: STYLE_KEYS.indexOf(s.id),
	})),
]

export const WORD_BY_ID: Record<string, Word> = Object.fromEntries(
	WORDS.map((w) => [w.id, w]),
)

export const KIND_NAME: Record<WordKind, string> = {
	mood: "Mood",
	theme: "Theme",
	style: "Style",
}

/** A title's three masks, as the snapshot holds them. */
export interface Masks {
	moods: number
	themes: number
	styles: number
}

export const hasWord = (m: Masks, w: Word) =>
	((w.kind === "mood" ? m.moods : w.kind === "theme" ? m.themes : m.styles) &
		(1 << w.bit)) !==
	0

/**
 * Words that mostly hold the same titles across the whole catalog (round 4 research: at least 55% of one is the
 * other), so a preset never pairs them: "Crime & mystery" and "Mystery" say one thing twice.
 */
const SAME_GROUND = [
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

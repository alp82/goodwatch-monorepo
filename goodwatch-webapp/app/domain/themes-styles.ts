// Themes and styles: what a title is about (Crime, War, Future) and how it looks, sounds and is told (Animated, Slow
// burn, Talky). A title has a theme or a style by a fixed rule over its fingerprint and, for two styles, its genres.
// A title can have several of each or none. Pure and shared by the server and the browser: the one place to read or
// change the rules.
//
// Two pages go by these rules:
// - The Explorer builds its Theme and Style islands from them (server/explorer/islands.server.ts), over its own pool
//   of about 12,000 well-known titles. There an island's threshold moves: up while the island holds more than a
//   quarter of the pool, one step down when it holds under 1% (server/explorer/groupings.server.ts).
// - Discover filters by them over the whole catalog, with each rule's own `from` and nothing moving, so a filter
//   gives the same titles to every viewer whatever else is chosen. A theme on Discover and the island of the same
//   name can therefore differ at the edges: where the island's threshold has moved, the island is the stricter or
//   the looser of the two.
//
// How to read a rule: `level` works a number out of a title's fingerprint scores (each 0 to 10), and the title has
// the theme or style when that number is at least `from`. `Math.max(a, b)` means either score counts, and
// `x <= n ? ... : 0` keeps titles out when x is above n. A `- 1` next to a score tightens that score by one step
// against `from`. Animated and Documentary are forms the fingerprint doesn't score, so they go by TMDB genre: level 10
// with the genre, 0 without.
//
// The ids are stable identifiers: they appear in URLs (`themes=war,future`, `styles=animated,slow`, and the
// Explorer's islands) and in the title snapshot's theme and style masks (bit i is THEME_KEYS[i] or STYLE_KEYS[i]),
// so they never change or move. The names, colors and rules may change.
import {
	type CoreScores,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"

export const THEME_KEYS = [
	"crime",
	"mystery",
	"war",
	"politics",
	"true",
	"history",
	"growing",
	"family",
	"mind",
	"showbiz",
	"sports",
	"money",
	"future",
	"fantasy",
] as const

export type ThemeKey = (typeof THEME_KEYS)[number]

export const STYLE_KEYS = [
	"animated",
	"documentary",
	"spectacle",
	"stylized",
	"music",
	"slow",
	"fast",
	"talky",
	"nonlinear",
	"graphic",
] as const

export type StyleKey = (typeof STYLE_KEYS)[number]

/** A person picks up to this many themes, and up to this many styles: more reads as no choice. */
export const MAX_THEMES = 3
export const MAX_STYLES = 3

type FingerprintKey = keyof CoreScores

/** A title's score for an attribute, 0 when the title has none. */
export type Score = (key: FingerprintKey) => number

/**
 * A fingerprint in either of its two shapes: attribute scores by key (as Crate stores them), or the 74 scores in
 * VALID_FINGERPRINT_KEYS order with 255 for a missing score (as the title snapshot stores them).
 */
export type RuleFingerprint =
	| Readonly<Partial<Record<FingerprintKey, number | null>>>
	| ArrayLike<number>

export interface TitleRule<K extends string = string> {
	id: K
	name: string
	/** The theme's or style's color, as a hex color. */
	color: string
	level: (score: Score, genres: readonly string[]) => number
	/** A title has the theme or style when its level is at least this. */
	from: number
}

// Theme: what a title is about. In THEME_KEYS order.
export const THEMES: readonly TitleRule<ThemeKey>[] = [
	{
		id: "crime",
		name: "Crime",
		color: "#c2413a",
		level: (s) => s("crime"),
		from: 8,
	},
	{
		id: "mystery",
		name: "Mystery",
		color: "#5b7fa8",
		level: (s) => s("mystery"),
		from: 8,
	},
	{
		id: "war",
		name: "War",
		color: "#9a9460",
		level: (s) => s("warfare"),
		from: 7,
	},
	{
		id: "politics",
		name: "Politics",
		color: "#8e62d6",
		level: (s) => s("political"),
		from: 7,
	},
	{
		id: "true",
		name: "True stories",
		color: "#b98a5a",
		level: (s) => s("biographical"),
		from: 6,
	},
	{
		id: "history",
		name: "History",
		color: "#9c7a52",
		level: (s) => (s("warfare") <= 5 ? s("historical") : 0),
		from: 8,
	},
	{
		id: "growing",
		name: "Growing up",
		color: "#7cc4e8",
		level: (s) => s("coming_of_age"),
		from: 8,
	},
	{
		id: "family",
		name: "Family",
		color: "#8ccf4d",
		level: (s) => s("family_dynamics"),
		from: 8,
	},
	{
		id: "mind",
		name: "The mind",
		color: "#9b7bea",
		level: (s) => s("psychological"),
		from: 8,
	},
	{
		id: "showbiz",
		name: "Showbiz",
		color: "#e2cf55",
		level: (s) => s("showbiz"),
		from: 6,
	},
	{
		id: "sports",
		name: "Sports",
		color: "#e8793d",
		level: (s) => s("sports"),
		from: 6,
	},
	{
		id: "money",
		name: "Money",
		color: "#7fae3a",
		level: (s) => s("class_and_capitalism"),
		from: 7,
	},
	{
		id: "future",
		name: "Future",
		color: "#3fc1b0",
		level: (s) => Math.max(s("futuristic"), s("technology_and_humanity")),
		from: 7,
	},
	{
		id: "fantasy",
		name: "Fantasy",
		color: "#d4508a",
		level: (s) => s("fantasy"),
		from: 7,
	},
]

// Style: how a title looks, sounds, and is told, kept to the essentials. Animated and Documentary are forms the
// fingerprint doesn't score, so they go by TMDB genre: a title has the form or it doesn't. In STYLE_KEYS order.
const DOCUMENTARY_GENRES = ["Documentary", "Reality", "Talk", "News"]
export const STYLES: readonly TitleRule<StyleKey>[] = [
	{
		id: "animated",
		name: "Animated",
		color: "#e38fb8",
		level: (_s, genres) => (genres.includes("Animation") ? 10 : 0),
		from: 10,
	},
	{
		id: "documentary",
		name: "Documentary",
		color: "#9aa3ad",
		level: (_s, genres) =>
			genres.some((g) => DOCUMENTARY_GENRES.includes(g)) ? 10 : 0,
		from: 10,
	},
	{
		id: "spectacle",
		name: "Spectacle",
		color: "#e8793d",
		level: (s) => s("spectacle"),
		from: 8,
	},
	{
		id: "stylized",
		name: "Stylized",
		color: "#d4508a",
		level: (s) => s("visual_stylization"),
		from: 8,
	},
	{
		id: "music",
		name: "Music",
		color: "#e2cf55",
		level: (s) => Math.max(s("music_centrality"), s("sound_centrality") - 1),
		from: 7,
	},
	{
		id: "slow",
		name: "Slow burn",
		color: "#5b7fa8",
		level: (s) => s("slow_burn"),
		from: 8,
	},
	{
		id: "fast",
		name: "Fast-paced",
		color: "#c2413a",
		level: (s) => s("fast_pace"),
		from: 8,
	},
	{
		id: "talky",
		name: "Talky",
		color: "#b98a5a",
		level: (s) => s("dialogue_centrality"),
		from: 8,
	},
	{
		id: "nonlinear",
		name: "Nonlinear",
		color: "#8e62d6",
		level: (s) => s("non_linear_narrative"),
		from: 7,
	},
	{
		id: "graphic",
		name: "Graphic",
		color: "#7fae3a",
		level: (s) => Math.max(s("grotesque"), s("violence") - 1),
		from: 8,
	},
]

export const THEME_BY_KEY = Object.fromEntries(
	THEMES.map((theme) => [theme.id, theme]),
) as Record<ThemeKey, TitleRule<ThemeKey>>

export const STYLE_BY_KEY = Object.fromEntries(
	STYLES.map((style) => [style.id, style]),
) as Record<StyleKey, TitleRule<StyleKey>>

const MISSING = 255
// A title without a title analysis has fewer scores than this and has no theme and no style: the Explorer's rule.
const MIN_SCORES = 10

const KEY_INDEX = Object.fromEntries(
	VALID_FINGERPRINT_KEYS.map((key, i) => [key, i]),
) as Record<FingerprintKey, number>

function isOrdered(
	fingerprint: RuleFingerprint,
): fingerprint is ArrayLike<number> {
	return typeof (fingerprint as ArrayLike<number>).length === "number"
}

/** The rules a title meets at their own `from`, as a bit mask: bit i is rules[i]. A missing score counts as 0. */
function maskOf(
	rules: readonly TitleRule[],
	fingerprint: RuleFingerprint | null | undefined,
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
	for (let i = 0; i < rules.length; i++)
		if (rules[i].level(score, genres ?? []) >= rules[i].from) mask |= 1 << i
	return mask
}

/** The themes a title has, as a bit mask: bit i is THEME_KEYS[i]. */
export const themeMaskOf = (
	fingerprint: RuleFingerprint | null | undefined,
	genres: readonly string[] | null | undefined,
): number => maskOf(THEMES, fingerprint, genres)

/** The styles a title has, as a bit mask: bit i is STYLE_KEYS[i]. */
export const styleMaskOf = (
	fingerprint: RuleFingerprint | null | undefined,
	genres: readonly string[] | null | undefined,
): number => maskOf(STYLES, fingerprint, genres)

/** The themes in a mask from themeMaskOf, in THEME_KEYS order. */
export const themesInMask = (mask: number): ThemeKey[] =>
	THEME_KEYS.filter((_, i) => (mask & (1 << i)) !== 0)

/** The styles in a mask from styleMaskOf, in STYLE_KEYS order. */
export const stylesInMask = (mask: number): StyleKey[] =>
	STYLE_KEYS.filter((_, i) => (mask & (1 << i)) !== 0)

/**
 * The mask of some keys of a group, with the bits of themeMaskOf or styleMaskOf. Picked keys combine with OR: a title
 * fits when it shares a bit.
 */
export function maskOfKeys<K extends string>(
	all: readonly K[],
	chosen: readonly K[],
): number {
	let mask = 0
	for (const key of chosen) {
		const bit = all.indexOf(key)
		if (bit >= 0) mask |= 1 << bit
	}
	return mask
}

/** The keys a URL names (`themes=war,future`): known keys only, each once, in the given order, at most `max`. */
export function parseKeys<K extends string>(
	all: readonly K[],
	value: string | null | undefined,
	max: number,
): K[] {
	const keys: K[] = []
	for (const part of (value ?? "").split(",")) {
		if (keys.length === max) break
		const key = part.trim() as K
		if (all.includes(key) && !keys.includes(key)) keys.push(key)
	}
	return keys
}

/**
 * Picks or unpicks a theme or style. A pick beyond `max` is refused and leaves the choice as it is; the caller says
 * why ("Three themes is the most. Remove one to add War.").
 */
export function toggleKey<K extends string>(
	chosen: readonly K[],
	key: K,
	max: number,
): { chosen: K[]; refused: boolean } {
	if (chosen.includes(key))
		return { chosen: chosen.filter((k) => k !== key), refused: false }
	if (chosen.length >= max) return { chosen: [...chosen], refused: true }
	return { chosen: [...chosen, key], refused: false }
}

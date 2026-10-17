// PROTOTYPE - throwaway. Word helpers shared by the sheet, table, glyph and label variants.
import type { CoreScores } from "~/server/utils/fingerprint"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import * as F from "~/ui/fingerprint/fingerprintText"
import type { VariantProps } from "../types"

type Key = keyof CoreScores
export type Area = "Energy" | "Heart" | "Humor" | "World" | "Craft" | "Style"
export const AREAS: Area[] = ["Energy", "Heart", "Humor", "World", "Craft", "Style"]

// Copied from fingerprintText (not exported there).
const FEEL: Partial<Record<Key, { adj: string; strong: string }>> = {
	adrenaline: { adj: "thrilling", strong: "pulse-pounding" },
	tension: { adj: "tense", strong: "nerve-racking" },
	scare: { adj: "scary", strong: "terrifying" },
	violence: { adj: "violent", strong: "brutally violent" },
	romance: { adj: "romantic", strong: "deeply romantic" },
	eroticism: { adj: "sensual", strong: "explicitly sexual" },
	wholesome: { adj: "wholesome", strong: "heartwarming" },
	wonder: { adj: "wondrous", strong: "awe-inspiring" },
	pathos: { adj: "moving", strong: "deeply moving" },
	melancholy: { adj: "melancholic", strong: "profoundly sad" },
	uncanny: { adj: "eerie", strong: "deeply unsettling" },
	catharsis: { adj: "cathartic", strong: "cathartic" },
	nostalgia: { adj: "nostalgic", strong: "nostalgic" },
	hopefulness: { adj: "hopeful", strong: "uplifting" },
	bleakness: { adj: "bleak", strong: "relentlessly bleak" },
	slow_burn: { adj: "slow-burning", strong: "slow-burning" },
	fast_pace: { adj: "fast-paced", strong: "breakneck" },
	intrigue: { adj: "intriguing", strong: "gripping" },
	complexity: { adj: "layered", strong: "intricate" },
	ambiguity: { adj: "ambiguous", strong: "open-ended" },
	surrealism: { adj: "surreal", strong: "dreamlike" },
	eccentricity: { adj: "quirky", strong: "eccentric" },
	philosophical: { adj: "philosophical", strong: "philosophical" },
	spectacle: { adj: "spectacular", strong: "epic" },
	psychedelic: { adj: "trippy", strong: "psychedelic" },
	grotesque: { adj: "grotesque", strong: "grotesque" },
	camp_and_irony: { adj: "campy", strong: "gloriously campy" },
	situational_comedy: { adj: "funny", strong: "hilarious" },
	wit_wordplay: { adj: "witty", strong: "razor-witty" },
	absurdist_humor: { adj: "absurd", strong: "gloriously absurd" },
	dark_humor: { adj: "darkly funny", strong: "pitch-black funny" },
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const sentence = (s: string) => cap(s.toLowerCase().replace(/&/g, "and"))
export const traitLabel = (k: string) => sentence(getFingerprintMeta(k).label)

/** The strongest feel adjectives, strongest first. */
export function feelWords(t: F.TitleInput, n = 3, min = 7) {
	const s = t.fingerprint.scores
	return (Object.keys(FEEL) as Key[])
		.filter((k) => s[k] >= min)
		.sort((a, b) => s[b] - s[a])
		.slice(0, n)
		.map((k) => (s[k] >= 9 ? FEEL[k]?.strong : FEEL[k]?.adj) ?? "")
}

/** "Thrilling, intriguing, awe-inspiring" */
export function tagline(t: F.TitleInput) {
	const w = feelWords(t, 3)
	return w.length ? cap(w.join(", ")) : ""
}

// Craft-like traits score high for most titles, so they only count when exceptional.
const COMMON: Key[] = [
	"direction", "acting", "cinematography", "editing", "narrative_structure", "dialogue_quality",
	"character_depth", "rewatchability", "music_composition", "dialogue_centrality", "sound_centrality",
	"music_centrality", "contemporary_realism",
]

/** Traits ranked by how much they set this title apart: highlight keys first, then strong uncommon traits. */
export function rankedTraits({ t, media }: VariantProps, n = 8) {
	const s = t.fingerprint.scores
	const hl = (media.fingerprint?.highlightKeys ?? []).filter((k): k is Key => k in s)
	const weight = (k: Key) => s[k] - (COMMON.includes(k) ? 2 : 0)
	const rest = (Object.keys(s) as Key[])
		.filter((k) => !hl.includes(k) && weight(k) >= 7)
		.sort((a, b) => weight(b) - weight(a))
	return [...hl.sort((a, b) => s[b] - s[a]), ...rest].slice(0, n).map((k) => ({ key: k, score: s[k], label: traitLabel(k) }))
}

const GOOD_FOR_ORDER = [
	"Date Night", "Family Movie Night", "Kids", "Friends Night", "Solo Watch", "Comfort Watch", "Binge-Friendly",
	"Background Watch", "Thought-Provoking", "Pure Escapism", "Party Vibe", "Teens", "Partner Watch",
	"Drop-in Friendly", "Intergenerational", "Adults", "Public Viewing Safe",
]

/** The most telling "good for" flags, sentence case. */
export function goodFor(t: F.TitleInput, n = 4) {
	const all = [...t.fingerprint.socialSuitability, ...t.fingerprint.viewingContext].map((x) => x.name)
	const rank = (x: string) => {
		const i = GOOD_FOR_ORDER.indexOf(x)
		return i < 0 ? 99 : i
	}
	const sorted = all.sort((a, b) => rank(a) - rank(b)).map(sentence)
	return { shown: sorted.slice(0, n), more: sorted.slice(n) }
}

/** One word per area and tier. */
export const AREA_WORD: Record<Area, string[]> = {
	Energy: ["Calm", "Low-key", "Steady", "High", "Relentless"],
	Heart: ["Cool", "Reserved", "Warm", "Big", "Deep"],
	Humor: ["None", "A touch", "Light", "Funny", "Very funny"],
	World: ["Thin", "Simple", "Solid", "Immersive", "Total"],
	Craft: ["Rough", "Plain", "Solid", "Strong", "Masterful"],
	Style: ["Plain", "Modest", "Clean", "Striking", "Stunning"],
}

/** The area phrase, e.g. "masterful craft". */
export const AREA_PHRASE: Record<Area, string[]> = {
	Energy: ["calm", "low-key", "steady energy", "high energy", "relentless energy"],
	Heart: ["emotionally cool", "light on feelings", "some heart", "big heart", "deeply emotional"],
	Humor: ["no humor", "a touch of humor", "light humor", "funny", "very funny"],
	World: ["thin world", "simple world", "solid world", "immersive world", "fully immersive world"],
	Craft: ["rough craft", "plain craft", "solid craft", "strong craft", "masterful craft"],
	Style: ["plain style", "modest style", "clean style", "striking style", "stunning style"],
}

/** The single strongest area; Craft and Style lose ties since they run high everywhere. */
export function standout(t: F.TitleInput): Area {
	const p = t.fingerprint.pillars
	return [...AREAS].sort((a, b) => p[b] - p[a] || (["Craft", "Style"].includes(a) ? 1 : 0) - (["Craft", "Style"].includes(b) ? 1 : 0))[0]
}

/** Content intensity in ratings-board words. */
export function intensityWord(score: number) {
	if (score <= 2) return "None"
	if (score <= 4) return "Mild"
	if (score <= 6) return "Moderate"
	if (score <= 8) return "Strong"
	return "Severe"
}

export function paceWord(t: F.TitleInput) {
	const s = t.fingerprint.scores
	if (s.fast_pace >= 8) return s.slow_burn >= 6 ? "Builds, then races" : "Fast throughout"
	if (s.slow_burn >= 8) return "Slow burn"
	if (s.fast_pace >= 6) return "Brisk"
	if (s.slow_burn >= 6) return "Unhurried"
	return "Steady"
}

export function humorWord(t: F.TitleInput) {
	const s = t.fingerprint.scores
	const kinds: [Key, string][] = [
		["situational_comedy", "situational"], ["wit_wordplay", "witty"], ["physical_comedy", "slapstick"],
		["cringe_humor", "cringe"], ["absurdist_humor", "absurd"], ["satire_parody", "satirical"], ["dark_humor", "dark"],
	]
	const max = Math.max(...kinds.map(([k]) => s[k]))
	if (max <= 2) return { level: "Serious throughout", kinds: [] as string[] }
	const top = kinds.filter(([k]) => s[k] >= 5).sort((a, b) => s[b[0]] - s[a[0]]).slice(0, 2).map(([, w]) => w)
	const level = max >= 9 ? "Very funny" : max >= 8 ? "Funny" : max >= 5 ? "Some laughs" : "A touch"
	return { level, kinds: top }
}

/** "Skip it if" reasons, lower case: "you want fast pacing". */
export const skipIfShort = (t: F.TitleInput) => F.skipIf(t)

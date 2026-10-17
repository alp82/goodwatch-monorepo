// Contrast pairs: two traits read together, such as "Tense, not scary" or "Funny, with heart". A pair applies when
// its traits clear its thresholds, and pairs that pull furthest apart (or, for "but" and "with", are both strongest)
// come first.

import { HUMOR_TRAITS, type Scores, type TraitKey } from "./areas"
import { strongestOf } from "./trait-scores"

export interface Contrast {
	/** The strong side, capitalized: "Tense". */
	lead: string
	conj: "not" | "but" | "with"
	/** The other side: "scary". */
	other: string
	/** The trait behind the lead, which decides the pair's area. */
	leadKey: (s: Scores) => TraitKey
	otherKey: (s: Scores) => TraitKey
	applies: (s: Scores) => boolean
	strength: (s: Scores) => number
}

const maxOf = (s: Scores, keys: readonly TraitKey[]) =>
	Math.max(...keys.map((k) => s[k]))

/** "A, not B": A at `min` or more and B at `max` or less. */
const not = (
	lead: string,
	other: string,
	high: TraitKey,
	low: TraitKey,
	min: number,
	max: number,
): Contrast => ({
	lead,
	conj: "not",
	other,
	leadKey: () => high,
	otherKey: () => low,
	applies: (s) => s[high] >= min && s[low] <= max,
	strength: (s) => s[high] - s[low],
})

/** "A, but B" (or "with" or "not"): the strongest of each side at `min` or more. */
const both = (
	lead: string,
	other: string,
	a: TraitKey | readonly TraitKey[],
	b: TraitKey | readonly TraitKey[],
	min: number,
	conj: Contrast["conj"] = "but",
): Contrast => {
	const as: readonly TraitKey[] = typeof a === "string" ? [a] : a
	const bs: readonly TraitKey[] = typeof b === "string" ? [b] : b
	return {
		lead,
		conj,
		other,
		leadKey: (s) => strongestOf(s, as),
		otherKey: (s) => strongestOf(s, bs),
		applies: (s) => maxOf(s, as) >= min && maxOf(s, bs) >= min,
		strength: (s) => Math.min(maxOf(s, as), maxOf(s, bs)) - 4.5,
	}
}

const CONTRASTS: Contrast[] = [
	not("Tense", "scary", "tension", "scare", 7, 4),
	not("Exciting", "scary", "adrenaline", "scare", 6, 3),
	not("Thrilling", "gory", "adrenaline", "grotesque", 7, 3),
	not("Violent", "gory", "violence", "grotesque", 7, 3),
	not("Philosophical", "slow", "philosophical", "slow_burn", 7, 3),
	not("Heartwarming", "a tearjerker", "wholesome", "pathos", 7, 4),
	not("Clever", "confusing", "complexity", "ambiguity", 8, 4),
	not("A crime story", "a whodunit", "crime", "mystery", 8, 5),
	not("Strange", "hard to follow", "surrealism", "complexity", 7, 5),
	// Both sides strong, read as "not": depth keeps the feel-good from being fluffy.
	both(
		"Feel-good",
		"fluffy",
		"hopefulness",
		["character_depth", "complexity"],
		8,
		"not",
	),
	both(
		"Action-packed",
		"mindless",
		"adrenaline",
		["philosophical", "complexity"],
		8,
		"not",
	),
	both(
		"Family-friendly",
		"childish",
		"wholesome",
		["character_depth", "wit_wordplay", "complexity"],
		7,
		"not",
	),
	both("Epic", "personal", "spectacle", "character_depth", 8),
	both("Fast", "layered", "fast_pace", "complexity", 7),
	both("Slow", "gripping", "slow_burn", ["tension", "intrigue"], 7),
	both("Bleak", "darkly funny", "bleakness", "dark_humor", 7),
	both("Funny", "bittersweet", HUMOR_TRAITS, "melancholy", 7),
	both("Quirky", "heartfelt", "eccentricity", "pathos", 7),
	both("Violent", "thoughtful", "violence", "philosophical", 8),
	both("Nostalgic", "fresh", "nostalgia", "novelty", 8),
	both("Dark", "hopeful", "bleakness", "hopefulness", 6),
	both(
		"Stylish",
		"substance",
		"visual_stylization",
		["character_depth", "philosophical", "narrative_structure"],
		9,
		"with",
	),
	both("Funny", "heart", HUMOR_TRAITS, ["pathos", "wholesome"], 7, "with"),
]

export interface PickedContrast {
	contrast: Contrast
	leadKey: TraitKey
	otherKey: TraitKey
}

/** The strongest pairs that apply, at most `n`, no two sharing a trait. */
export function pickContrasts(s: Scores, n: number): PickedContrast[] {
	const used = new Set<TraitKey>()
	const picked: PickedContrast[] = []
	const ranked = CONTRASTS.filter((c) => c.applies(s)).sort(
		(x, y) => y.strength(s) - x.strength(s),
	)
	for (const contrast of ranked) {
		const leadKey = contrast.leadKey(s)
		const otherKey = contrast.otherKey(s)
		if (used.has(leadKey) || used.has(otherKey)) continue
		used.add(leadKey)
		used.add(otherKey)
		picked.push({ contrast, leadKey, otherKey })
		if (picked.length === n) break
	}
	return picked
}

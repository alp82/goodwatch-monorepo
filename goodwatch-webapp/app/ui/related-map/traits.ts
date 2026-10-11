// What the related map knows about a title's fingerprint: the twenty attributes that read as "more" and "less" of
// something, each with a plain word, the grammar of a filter, and the rule that says which filtered lists a title's
// pack brings along. The server builds packs with it, and the browser draws chips and asks for pages with it.
import { TMDB_IMAGE_BASE } from "~/utils/tmdb-image"

/**
 * The traits a chip may offer: a plain word and an emoji of its own. In the order of how often "more of it" is
 * something a visitor asks for, which breaks ties when a title has several traits at the same level. A pack carries
 * a title's levels in this order.
 */
export const MAP_TRAITS: [string, string, string][] = [
	["situational_comedy", "Comedy", "😂"],
	["romance", "Romance", "💘"],
	["hopefulness", "Hope", "🌅"],
	["scare", "Scares", "😱"],
	["wholesome", "Warmth", "🤗"],
	["wit_wordplay", "Wit", "💬"],
	["surrealism", "Surreal", "🌀"],
	["adrenaline", "Adrenaline", "⚡"],
	["tension", "Tension", "😬"],
	["wonder", "Wonder", "✨"],
	["dark_humor", "Dark humor", "💀"],
	["complexity", "Complexity", "🧩"],
	["violence", "Violence", "🩸"],
	["spectacle", "Spectacle", "🎆"],
	["fast_pace", "Pace", "⏩"],
	["slow_burn", "Slow burn", "🕯️"],
	["absurdist_humor", "Absurdity", "🤪"],
	["bleakness", "Bleakness", "🌑"],
	["melancholy", "Melancholy", "🌧️"],
	["dialogue_centrality", "Talk", "🗣️"],
]

export const TRAIT_KEYS = MAP_TRAITS.map(([key]) => key)

/** Traits of one family tell much the same story, so the chips offer at most one of each. */
const FAMILIES = [
	["bleakness", "violence", "scare", "melancholy"],
	["hopefulness", "wholesome", "romance", "wonder"],
	["situational_comedy", "wit_wordplay", "dark_humor", "absurdist_humor"],
	["tension", "adrenaline", "fast_pace", "slow_burn"],
	["complexity", "surrealism", "spectacle", "dialogue_centrality"],
]

/** Per trait: its plain word, its emoji, and its family. */
export type TraitWords = Record<string, [string, string, number]>

export function traitWords(): TraitWords {
	const words: TraitWords = {}
	for (const [key, word, emoji] of MAP_TRAITS)
		words[key] = [
			word,
			emoji,
			FAMILIES.findIndex((family) => family.includes(key)),
		]
	return words
}

/** From this level up a title has a trait, and a chip that adds the trait asks for it. */
export const WITH_FROM = 6
/** Down to this level a title is without a trait, and a chip that drops the trait asks for it. */
export const WITHOUT_TO = 4

/**
 * A filter is a list of tokens, and a token is one condition a title passes or not: `tension>6` (tension of 6 or
 * more) or `tension<4` (4 or less). These two levels are the only ones a chip asks for.
 */
export interface TraitToken {
	key: string
	op: ">" | "<"
	value: number
}

const TRAIT = new Set(TRAIT_KEYS)

export function parseToken(token: string): TraitToken | null {
	const found = /^([a-z_]+)([<>])(\d{1,2})$/.exec(token)
	if (!found || !TRAIT.has(found[1])) return null
	const op = found[2] as TraitToken["op"]
	const value = Number(found[3])
	return value === (op === ">" ? WITH_FROM : WITHOUT_TO)
		? { key: found[1], op, value }
		: null
}

/** The most chips that can be on at once. */
export const MAX_FILTER_TOKENS = 3

/**
 * A filter as its tokens in a fixed order, so that one filter has one name. Null when it is not a filter the chips
 * can make: an unknown token, one trait twice, or more tokens than chips can be on.
 */
export function filterName(text: string): string | null {
	const tokens = [...new Set(text.split(",").filter(Boolean))].sort()
	if (tokens.length > MAX_FILTER_TOKENS) return null
	const keys = new Set<string>()
	for (const token of tokens) {
		const parsed = parseToken(token)
		if (!parsed || keys.has(parsed.key)) return null
		keys.add(parsed.key)
	}
	return tokens.join(",")
}

/**
 * The chips of a title, as the tokens a tap on each asks for: up to three traits it is strong on (a tap drops the
 * trait) and up to three it has little of (a tap adds it), one per family in each group. A title's pack brings the
 * filtered list of each along, so that the first use of a chip is drawn from memory. From the title's own levels
 * alone, so the server and the browser name the same ones.
 */
export function chipTokens(
	level: (key: string) => number,
	words: TraitWords,
): string[] {
	const order = Object.keys(words)
	const out: string[] = []
	const families: Record<number, boolean> = {}
	const take = (list: string[], count: number) => {
		let taken = 0
		for (const key of list) {
			if (taken >= count) break
			if (families[words[key][2]]) continue
			families[words[key][2]] = true
			out.push(key)
			taken++
		}
	}
	take(
		order
			.filter((key) => level(key) >= WITH_FROM)
			.sort(
				(a, b) => level(b) - level(a) || order.indexOf(a) - order.indexOf(b),
			),
		3,
	)
	const appeal = (key: string) =>
		10 - level(key) + 2 * (1 - order.indexOf(key) / order.length)
	// What it has little of may share a family with what it has much of, but not with each other.
	for (const key of Object.keys(families)) delete families[Number(key)]
	take(
		order
			.filter((key) => level(key) <= WITHOUT_TO && out.indexOf(key) < 0)
			.sort((a, b) => appeal(b) - appeal(a)),
		3,
	)
	return out.map((key) =>
		level(key) >= WITH_FROM
			? `${key}<${WITHOUT_TO}`
			: `${key}>${WITH_FROM}`,
	)
}

/** What the engine needs to read a pack and to address a poster image. */
export interface MapMeta {
	/** The order of the levels in a pack's level string. */
	keys: string[]
	image: string
}

export const mapMeta = (): MapMeta => ({
	keys: TRAIT_KEYS,
	image: TMDB_IMAGE_BASE,
})

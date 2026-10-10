// PROTOTYPE for "Prototype native-scroll carousels on title pages", eleventh round. Throwaway code: not for production.
//
// What the eleventh round's forms (roam1 with its fixes, rings1 to rings10) and their pack share: the names, the
// twenty plain traits and their comparatives, which attributes a pack carries, the grammar of a filter, and the rule
// that says which filtered lists a title's pack brings along. Handed to the forms as plain data and as one function
// with no outside references, because they run as the page's inline script.
import { BEST_WORDS } from "~/ui/prototype-carousels/best-meta"
import type { PlayMeta } from "~/ui/prototype-carousels/play-meta"

export const RING_NAMES: Record<string, string> = {
	rings1: "G1 Bars",
	rings2: "G2 Three stops",
	rings3: "G3 Words",
	rings4: "G4 Edges",
	rings5: "G5 Legend",
	rings6: "G6 Pad",
	rings7: "G7 Blend",
	rings8: "G8 Practical",
	rings9: "G9 Heading",
	rings10: "G10 In words",
	mix1: "M1 Level chips",
	mix2: "M2 Legend bars",
	mix3: "M3 One heading",
	mix4: "M4 Signposts",
	mix5: "M5 Before and after",
	mix6: "M6 Keep what you found",
	fin1: "F1 Path bar",
	fin2: "F2 Poster trail",
	fin3: "F3 One card",
}

/** How a form's pack chooses the filtered lists it brings along (see `ringTokens` and the pack builder). */
export const RING_MODES: Record<string, string> = {
	roam1: "chips",
	rings1: "bars",
	rings2: "stops",
	rings3: "words",
	rings4: "edges",
	rings5: "0",
	rings6: "pad",
	rings7: "0",
	rings8: "practical",
	rings9: "0",
	rings10: "0",
	// Twelfth round (mix-forms.ts). The chips and bars of a fingerprint bring the lists the bars form brings.
	mix1: "bars",
	mix2: "0",
	mix3: "0",
	mix4: "0",
	mix5: "bars",
	mix6: "0",
	// Thirteenth round (fin-forms.ts). The level chips' lists, so the same packs as mix1.
	fin1: "bars",
	fin2: "bars",
	fin3: "bars",
}
export const isMixVariant = (variant: string) => variant.startsWith("mix")
export const isFinVariant = (variant: string) => variant.startsWith("fin")
export const isRingsVariant = (variant: string) => variant in RING_MODES

/** Families of traits that tell much the same story (best-meta.ts): a control offers at most one of each. */
const FAMILIES = [
	["bleakness", "violence", "scare", "melancholy"],
	["hopefulness", "wholesome", "romance", "wonder"],
	["situational_comedy", "wit_wordplay", "dark_humor", "absurdist_humor"],
	["tension", "adrenaline", "fast_pace", "slow_burn"],
	["complexity", "surrealism", "spectacle", "dialogue_centrality"],
]

/**
 * More of a trait and less of it as a visitor would say it. "Less" is always "less" and the trait's own word: no
 * word claims an opposite that the fingerprint does not measure.
 */
const SAY: Record<string, [string, string]> = {
	situational_comedy: ["Funnier", "Less comedy"],
	romance: ["More romantic", "Less romance"],
	hopefulness: ["More hopeful", "Less hopeful"],
	scare: ["Scarier", "Less scary"],
	wholesome: ["Warmer", "Less warm"],
	wit_wordplay: ["Wittier", "Less witty"],
	surrealism: ["Weirder", "Less surreal"],
	adrenaline: ["More adrenaline", "Less adrenaline"],
	tension: ["Tenser", "Less tense"],
	wonder: ["More wonder", "Less wonder"],
	dark_humor: ["Darker jokes", "Less dark humor"],
	complexity: ["More complex", "Less complex"],
	violence: ["More violent", "Less violent"],
	spectacle: ["Bigger spectacle", "Less spectacle"],
	fast_pace: ["Faster", "Less fast"],
	slow_burn: ["Slower burn", "Less slow burn"],
	absurdist_humor: ["Sillier", "Less absurd"],
	bleakness: ["Bleaker", "Less bleak"],
	melancholy: ["Sadder", "Less sad"],
	dialogue_centrality: ["Talkier", "Less talk"],
}

/** The attributes a rings pack carries per title, in this order: the twenty plain traits and two facts. */
export const RING_KEYS = [...BEST_WORDS.map(([key]) => key), "_r", "_st"]
const TRAIT = new Set(BEST_WORDS.map(([key]) => key))

export interface RingsExtra {
	/** Per trait: its plain word, its emoji, more of it and less of it in a visitor's words, and its family. */
	w: Record<string, [string, string, string, string, number]>
	hi: number
	lo: number
}

export function ringsExtra(): RingsExtra {
	const w: RingsExtra["w"] = {}
	for (const [key, word, emoji] of BEST_WORDS)
		w[key] = [word, emoji, SAY[key][0], SAY[key][1], FAMILIES.findIndex((family) => family.includes(key))]
	return { w, hi: 6, lo: 4 }
}

/**
 * A filter is a list of tokens, and a token is one condition a title passes or not:
 * - `tension>6`, `tension<4`: a level of one of the twenty traits, at least or at most.
 * - `_y>2000`, `_y<1998`: the year, at least or at most.
 * - `_k=m`, `_k=s`: a movie or a show.
 * - `_r>80`: the score, at least.
 * - `_st=1`: on one of the large subscription services in the visitor's country.
 * - `_b=m603`: not a condition but a second title: the list is of titles alike both.
 */
export interface RingToken {
	key: string
	op: ">" | "<" | "="
	value: string
}
export function parseToken(token: string): RingToken | null {
	const found = /^([a-z_]+)([<>=])([a-z0-9]+)$/.exec(token)
	if (!found) return null
	const key = found[1]
	const op = found[2] as RingToken["op"]
	const value = found[3]
	const number = /^\d{1,4}$/.test(value)
	if (TRAIT.has(key)) return op !== "=" && number && Number(value) <= 10 ? { key, op, value } : null
	if (key === "_y" || key === "_r") return op !== "=" && number ? { key, op, value } : null
	if (key === "_k") return op === "=" && (value === "m" || value === "s") ? { key, op, value } : null
	if (key === "_st") return op === "=" && value === "1" ? { key, op, value } : null
	if (key === "_b") return op === "=" && /^[ms]\d{1,9}$/.test(value) ? { key, op, value } : null
	return null
}
export const isToken = (token: string) => parseToken(token) !== null

/** A filter as its tokens in a fixed order, so that one filter has one name. */
export const tokenName = (tokens: string[]) => [...new Set(tokens.filter(isToken))].sort().join(",")

/**
 * The filtered lists a title's pack brings along, so that the first use of a control is drawn from memory. From the
 * title's own levels alone, which the browser knows for every title on the map: it names them when it asks for a
 * neighbor's pack, and the server names the same ones for the page's title.
 *
 * `keys`: the traits a walk holds on to (the three chips, the pad's two), chosen once for the page's title.
 * No outside references: this function is part of the inline script.
 */
export function ringTokens(
	mode: string,
	level: (key: string) => number,
	keys: string[],
	w: Record<string, [string, string, string, string, number]>,
): string[] {
	const order = Object.keys(w)
	const picks = (strong: number, weak: number) => {
		const out: string[] = []
		const families: Record<number, boolean> = {}
		const take = (list: string[], count: number) => {
			let taken = 0
			for (const key of list) {
				if (taken >= count) break
				if (families[w[key][4]]) continue
				families[w[key][4]] = true
				out.push(key)
				taken++
			}
		}
		take(
			order.filter((key) => level(key) >= 6).sort((a, b) => level(b) - level(a) || order.indexOf(a) - order.indexOf(b)),
			strong,
		)
		const appeal = (key: string) => 10 - level(key) + 2 * (1 - order.indexOf(key) / order.length)
		// What it has little of may share a family with what it has much of, but not with each other.
		for (const key of Object.keys(families)) delete families[Number(key)]
		take(
			order.filter((key) => level(key) <= 4 && out.indexOf(key) < 0).sort((a, b) => appeal(b) - appeal(a)),
			weak,
		)
		return out
	}
	const flip = (key: string) => (level(key) >= 6 ? `${key}<4` : `${key}>6`)
	const less = (key: string, by: number, cap = 10) => `${key}<${Math.max(0, Math.min(cap, level(key) - by))}`
	const more = (key: string, by: number, least = 0) => `${key}>${Math.min(10, Math.max(least, level(key) + by))}`
	if (mode === "chips" || mode === "edges") return keys.map(flip)
	if (mode === "bars") return picks(3, 3).map(flip)
	if (mode === "words") return picks(2, 3).map((key) => (level(key) >= 6 ? less(key, 2, 5) : more(key, 2, 5)))
	if (mode === "stops" || mode === "pad") {
		const out: string[] = []
		for (const key of keys) {
			if (level(key) >= 2) out.push(less(key, 2))
			if (level(key) <= 8) out.push(more(key, 2))
		}
		return out
	}
	// The facts of the practical form (movie or show, year, score, streaming) are common among the nearest titles:
	// its pack brings no list for them.
	return []
}

/** The engine's vocabulary for the rings forms: only the attributes their packs carry. */
export function ringsMeta(base: PlayMeta): PlayMeta {
	const traits: PlayMeta["traits"] = {}
	for (const key of RING_KEYS) traits[key] = base.traits[key] ?? { e: "", l: key, n: key, c: "#9ca3af", on: false }
	return { ...base, keys: RING_KEYS, traits }
}

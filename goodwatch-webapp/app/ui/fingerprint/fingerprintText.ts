// Fingerprint attribute scores turned into short, readable text for the
// detail page and its meta description. Templates only: the same scores
// always produce the same words, on the server and in the browser.

import { type CoreScores, type FingerprintResult, PILLAR_ATTRIBUTES } from "~/server/utils/fingerprint"
import { moods } from "~/ui/explore/category/moods"

type Key = keyof CoreScores

export interface TitleInput {
	title: string
	mediaType: "movie" | "show"
	year: string
	genres: string[]
	fingerprint: FingerprintResult
}

// Adjectives for keys that describe how a title feels. `strong` is used at 9+.
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
}

const HUMOR: Partial<Record<Key, string>> = {
	situational_comedy: "situational comedy",
	wit_wordplay: "sharp wit",
	physical_comedy: "slapstick",
	cringe_humor: "cringe comedy",
	absurdist_humor: "absurdist humor",
	satire_parody: "satire",
	dark_humor: "dark humor",
}

const THEME: Partial<Record<Key, string>> = {
	fantasy: "fantasy",
	futuristic: "the future",
	historical: "history",
	contemporary_realism: "everyday modern life",
	crime: "crime",
	mystery: "mystery",
	warfare: "war",
	political: "politics",
	sports: "sports",
	biographical: "a real life story",
	coming_of_age: "growing up",
	family_dynamics: "family",
	psychological: "the mind",
	showbiz: "show business",
	gaming: "games",
	pop_culture: "pop culture",
	social_commentary: "society",
	class_and_capitalism: "class and money",
	technology_and_humanity: "technology",
	spiritual: "faith and meaning",
}

const CRAFT: Partial<Record<Key, string>> = {
	direction: "direction",
	acting: "performances",
	cinematography: "cinematography",
	editing: "editing",
	music_composition: "score",
	world_immersion: "world-building",
	visual_stylization: "visual style",
	dialogue_quality: "dialogue",
	character_depth: "characters",
	narrative_structure: "storytelling",
	sound_centrality: "sound design",
}

const PILLAR_WORDS: Record<string, string[]> = {
	Energy: ["calm", "low-key", "steady energy", "high energy", "relentless energy"],
	Heart: ["emotionally cool", "light on feelings", "some heart", "big heart", "deeply emotional"],
	Humor: ["no humor", "a touch of humor", "light humor", "funny", "very funny"],
	World: ["thin world", "simple world", "solid world", "immersive world", "fully immersive world"],
	Craft: ["rough craft", "plain craft", "solid craft", "strong craft", "masterful craft"],
	Style: ["plain style", "modest style", "clean style", "striking style", "stunning style"],
}

const noun = (t: TitleInput) => (t.mediaType === "movie" ? "movie" : "series")

function top(scores: CoreScores, keys: Partial<Record<Key, unknown>>, min: number, n: number) {
	return (Object.keys(keys) as Key[])
		.filter((k) => scores[k] >= min)
		.sort((a, b) => scores[b] - scores[a])
		.slice(0, n)
}

export function list(items: string[], conj = "and") {
	if (items.length <= 1) return items[0] ?? ""
	if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`
	return `${items.slice(0, -1).join(", ")}, ${conj} ${items[items.length - 1]}`
}

// Keys reaching these have been filtered to ones the lexicon covers.
const word = (lex: Partial<Record<Key, string>>, k: Key) => lex[k] ?? ""
const feelWord = (s: CoreScores, k: Key) => (s[k] >= 9 ? FEEL[k]?.strong : FEEL[k]?.adj) ?? ""
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a")

function genreLabel(t: TitleInput) {
	const g = t.genres.filter((x) => !["Action & Adventure", "Sci-Fi & Fantasy"].includes(x))
	const main = (g[0] ?? "").toLowerCase().replace("science fiction", "sci-fi").replace("animation", "animated")
	return main ? `${main} ${noun(t)}` : noun(t)
}

// The one-line headline, for example "Relentless energy, masterful craft".
export function pillarLine(t: TitleInput) {
	const p = t.fingerprint.pillars
	const entries = Object.entries(p) as [string, number][]
	const strong = entries.filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2)
	const weakest = entries.filter(([k]) => ["Energy", "Heart", "Humor"].includes(k)).sort((a, b) => a[1] - b[1])[0]
	const parts = strong.map(([k, v]) => PILLAR_WORDS[k][v])
	if (weakest && weakest[1] <= 1 && !strong.some(([k]) => k === weakest[0]))
		parts.push(PILLAR_WORDS[weakest[0]][weakest[1]])
	return cap(parts.join(", "))
}


function feelAdjectives(s: CoreScores, n: number) {
	return top(s, FEEL, 7, n).map((k) => feelWord(s, k))
}

function humorPhrase(s: CoreScores) {
	const keys = top(s, HUMOR, 5, 2)
	const max = Math.max(...(Object.keys(HUMOR) as Key[]).map((k) => s[k]))
	if (max <= 2) return { level: "none", text: "almost no humor" }
	if (keys.length === 0) return { level: "light", text: "a little humor" }
	const kinds = list(keys.map((k) => word(HUMOR, k)))
	if (max >= 8) return { level: "high", text: `plenty of ${kinds}` }
	return { level: "some", text: `some ${kinds}` }
}

// One sentence, meta-description sized.
export function summary(t: TitleInput) {
	const s = t.fingerprint.scores
	const adj = feelAdjectives(s, 2)
	const themes = top(s, THEME, 7, 2).map((k) => word(THEME, k))
	const craft = top(s, CRAFT, 9, 2).map((k) => word(CRAFT, k))
	const g = genreLabel(t)
	let out = adj.length ? `${cap(article(adj[0]))} ${adj.join(", ")} ${g}` : `${cap(article(g))} ${g}`
	if (themes.length) out += ` about ${list(themes)}`
	if (craft.length) out += `, with standout ${list(craft)}`
	return `${out}.`
}








export function skipIf(t: TitleInput) {
	const s = t.fingerprint.scores
	const out: string[] = []
	if (humorPhrase(s).level === "none") out.push("you want something to laugh at")
	if (s.bleakness >= 8 && s.hopefulness <= 4) out.push("you need an uplifting mood")
	if (s.slow_burn >= 8) out.push("you want fast pacing")
	if (s.complexity >= 8 || s.non_linear_narrative >= 8) out.push("you want to half-watch while scrolling")
	if (s.violence >= 8 || s.grotesque >= 7) out.push("graphic violence bothers you")
	if (s.scare >= 8) out.push("you scare easily")
	if (s.eroticism >= 7) out.push("you're watching with family")
	if (s.fast_pace >= 8 && s.adrenaline >= 8) out.push("you want something quiet and calm")
	if (s.wholesome >= 8 && s.bleakness <= 3) out.push("you want dark or edgy material")
	return out.slice(0, 4)
}




// Evaluates the mood pages' own fingerprint rules against this title, so the
// links point to pages this title actually appears on.
type Cond = { field?: string; operator?: string; value?: number; logic?: "AND" | "OR"; conditions?: Cond[] }

function evalCond(c: Cond, s: CoreScores): boolean {
	if (c.conditions) {
		const r = c.conditions.map((x) => evalCond(x, s))
		return c.logic === "OR" ? r.some(Boolean) : r.every(Boolean)
	}
	const v = s[c.field as Key] ?? 0
	return c.operator === "<=" ? v <= (c.value ?? 0) : v >= (c.value ?? 0)
}

export function matchingMoods(t: TitleInput) {
	const s = t.fingerprint.scores
	const type = t.mediaType === "movie" ? "movies" : "shows"
	return Object.values(moods)
		.filter((m) => {
			const raw = m.discoverParams?.fingerprintConditions
			if (!raw) return false
			const conds = JSON.parse(raw as string) as Cond[]
			return conds.every((c) => evalCond(c, s))
		})
		.map((m) => ({ label: m.label, url: `/${type}/moods/${m.path}` }))
}


// --- Per-pillar text for the pillar rows and the pillar detail ---

export const PILLAR_KEYS: Record<string, readonly Key[]> = PILLAR_ATTRIBUTES

export function pillarDrivers(t: TitleInput, pillar: string) {
	const s = t.fingerprint.scores
	return [...PILLAR_KEYS[pillar]].sort((a, b) => s[b] - s[a]).slice(0, 3).map((k) => ({ key: k, score: s[k] }))
}

export function pillarSentence(t: TitleInput, pillar: string) {
	const s = t.fingerprint.scores
	const pick = (keys: readonly Key[], lex: Partial<Record<Key, string>>, min = 7) =>
		keys.filter((k) => s[k] >= min && lex[k]).sort((a, b) => s[b] - s[a]).map((k) => word(lex, k))
	const feel = (keys: readonly Key[]) =>
		keys.filter((k) => s[k] >= 7 && FEEL[k]).sort((a, b) => s[b] - s[a]).map((k) => feelWord(s, k))
	switch (pillar) {
		case "Energy": {
			const a = feel(PILLAR_KEYS.Energy)
			const pace = s.slow_burn >= 7 ? " The story builds slowly, so the intensity comes in waves." : ""
			return a.length ? `${t.title} is ${list(a.slice(0, 3))}.${pace}` : `${t.title} is calm and low-intensity.${pace}`
		}
		case "Heart": {
			const a = feel(PILLAR_KEYS.Heart)
			const th = pick(["coming_of_age", "family_dynamics"], THEME)
			const about = th.length ? ` Much of it is about ${list(th)}.` : ""
			return a.length ? `Emotionally, it's ${list(a.slice(0, 3))}.${about}` : `It keeps its emotions at a distance.${about}`
		}
		case "Humor":
			return `Expect ${humorPhrase(s).text}.`
		case "World": {
			const th = top(s, THEME, 7, 3).map((k) => word(THEME, k))
			const parts = [th.length ? `Its world is built around ${list(th)}.` : ""]
			if (s.world_immersion >= 8) parts.push("The setting feels lived-in and easy to get lost in.")
			if (s.rewatchability >= 8) parts.push("It holds up on a rewatch.")
			if (s.ambiguity >= 7) parts.push("It leaves some questions open.")
			return parts.filter(Boolean).join(" ") || "The world stays in the background."
		}
		case "Craft": {
			const c = pick(["direction", "acting", "narrative_structure", "dialogue_quality", "character_depth"], CRAFT, 8)
			const extra = s.complexity >= 8 ? " The plot is layered and rewards full attention." : ""
			return c.length ? `The ${list(c.slice(0, 3))} stand out.${extra}` : `The craft is serviceable rather than remarkable.${extra}`
		}
		case "Style": {
			const c = pick(["cinematography", "editing", "music_composition", "visual_stylization", "sound_centrality"], CRAFT, 8)
			return c.length ? `Look and sound: the ${list(c.slice(0, 3))} stand out.` : "The look and sound stay functional."
		}
	}
	return ""
}

// A pillar in three parts: a short bold verdict, an optional note, and the
// attributes that drive it.

export interface PillarBrief {
	verdict: string
	note: string
	drivers: { key: Key; score: number }[]
}

export function pillarBrief(t: TitleInput, pillar: string): PillarBrief {
	const s = t.fingerprint.scores
	const drivers = pillarDrivers(t, pillar)
	const feel = (keys: readonly Key[], n: number) =>
		keys
			.filter((k) => s[k] >= 7 && FEEL[k])
			.sort((a, b) => s[b] - s[a])
			.slice(0, n)
			.map((k) => feelWord(s, k))
	const pick = (keys: readonly Key[], lex: Partial<Record<Key, string>>, min: number, n: number) =>
		keys.filter((k) => s[k] >= min && lex[k]).sort((a, b) => s[b] - s[a]).slice(0, n).map((k) => word(lex, k))
	switch (pillar) {
		case "Energy": {
			const a = feel(PILLAR_KEYS.Energy, 2)
			const note = s.slow_burn >= 7 ? "Builds slowly, so the intensity comes in waves." : s.fast_pace >= 7 ? "Fast from start to finish." : ""
			return { verdict: a.length ? cap(list(a)) : "Calm and low-key", note, drivers }
		}
		case "Heart": {
			const a = feel(PILLAR_KEYS.Heart, 2)
			const th = pick(["coming_of_age", "family_dynamics"], THEME, 7, 2)
			return { verdict: a.length ? cap(list(a)) : "Emotionally reserved", note: th.length ? `Much of it is about ${list(th)}.` : "", drivers }
		}
		case "Humor": {
			const h = humorPhrase(s)
			const verdict = h.level === "none" ? "Serious throughout" : cap(h.text)
			return { verdict, note: h.level === "some" || h.level === "light" ? "Not a comedy at heart." : "", drivers }
		}
		case "World": {
			const th = top(s, THEME, 7, 3).map((k) => word(THEME, k))
			const notes = [s.world_immersion >= 8 ? "Lived-in and easy to get lost in." : "", s.rewatchability >= 8 ? "Holds up on a rewatch." : ""]
			return { verdict: th.length ? cap(list(th)) : "Kept in the background", note: notes.filter(Boolean).join(" "), drivers }
		}
		case "Craft": {
			const c = pick(["direction", "acting", "narrative_structure", "dialogue_quality", "character_depth"], CRAFT, 8, 3)
			return {
				verdict: c.length ? `Standout ${list(c)}` : "Solid, not remarkable",
				note: s.complexity >= 8 ? "Layered plot that rewards full attention." : "",
				drivers,
			}
		}
		case "Style": {
			const c = pick(["cinematography", "editing", "music_composition", "visual_stylization", "sound_centrality"], CRAFT, 8, 3)
			return {
				verdict: c.length ? `Standout ${list(c)}` : "Functional look and sound",
				note: s.visual_stylization >= 8 ? "A distinctive visual signature." : "",
				drivers,
			}
		}
	}
	return { verdict: "", note: "", drivers }
}



// Attributes outside a pillar's formula that still help explain it.
export const RELATED_KEYS: Record<string, Key[]> = {
	Energy: ["slow_burn", "uncanny", "grotesque", "bleakness", "warfare"],
	Heart: ["bleakness", "spiritual", "philosophical", "character_depth"],
	Humor: ["camp_and_irony", "eccentricity", "pastiche", "wholesome"],
	World: [
		"fantasy", "futuristic", "historical", "contemporary_realism", "crime", "mystery", "warfare", "political",
		"sports", "biographical", "psychological", "showbiz", "gaming", "pop_culture", "social_commentary",
		"class_and_capitalism", "technology_and_humanity", "spiritual", "surrealism",
	],
	Craft: ["novelty", "homage_and_reference", "philosophical", "educational", "slow_burn", "fast_pace"],
	Style: ["spectacle", "psychedelic", "grotesque", "camp_and_irony", "pastiche", "dialogue_centrality"],
}

export function pillarAttributes(t: TitleInput, pillar: string) {
	const s = t.fingerprint.scores
	const own = [...PILLAR_KEYS[pillar]].sort((a, b) => s[b] - s[a]).map((k) => ({ key: k, score: s[k] }))
	const related = RELATED_KEYS[pillar]
		.filter((k) => !PILLAR_KEYS[pillar].includes(k) && s[k] >= 5)
		.sort((a, b) => s[b] - s[a])
		.slice(0, 6)
		.map((k) => ({ key: k, score: s[k] }))
	return { own, related }
}

function condFields(c: Cond): string[] {
	return c.conditions ? c.conditions.flatMap(condFields) : c.field ? [c.field] : []
}

// Mood pages this title belongs to whose rules use one of these attributes.
export function moodsForKeys(t: TitleInput, keys: string[]) {
	const s = t.fingerprint.scores
	const type = t.mediaType === "movie" ? "movies" : "shows"
	return Object.values(moods)
		.filter((m) => {
			const raw = m.discoverParams?.fingerprintConditions
			if (!raw) return false
			const conds = JSON.parse(raw as string) as Cond[]
			return conds.every((c) => evalCond(c, s)) && conds.flatMap(condFields).some((f) => keys.includes(f))
		})
		.map((m) => ({ label: m.label, url: `/${type}/moods/${m.path}` }))
}


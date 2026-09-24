// PROTOTYPE - throwaway. Question: what should fingerprint-as-text look like on
// detail pages so they carry GoodWatch-specific words that TMDB clones lack?
// Deterministic templates only, no LLM at render time.

import type { CoreScores, FingerprintResult } from "~/server/utils/fingerprint"
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
const pct = (n: number) => `${n}/10`

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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a")

function genreLabel(t: TitleInput) {
	const g = t.genres.filter((x) => !["Action & Adventure", "Sci-Fi & Fantasy"].includes(x))
	const main = (g[0] ?? "").toLowerCase().replace("science fiction", "sci-fi").replace("animation", "animated")
	return main ? `${main} ${noun(t)}` : noun(t)
}

// "High energy, masterful craft, no humor" - the pillar line from the user's example.
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

export function pillarWord(pillar: string, tier: number) {
	return PILLAR_WORDS[pillar]?.[tier] ?? ""
}

function feelAdjectives(s: CoreScores, n: number) {
	return top(s, FEEL, 7, n).map((k) => (s[k] >= 9 ? FEEL[k]!.strong : FEEL[k]!.adj))
}

function humorPhrase(s: CoreScores) {
	const keys = top(s, HUMOR, 5, 2)
	const max = Math.max(...(Object.keys(HUMOR) as Key[]).map((k) => s[k]))
	if (max <= 2) return { level: "none", text: "almost no humor" }
	if (keys.length === 0) return { level: "light", text: "a little humor" }
	const kinds = list(keys.map((k) => HUMOR[k]!))
	if (max >= 8) return { level: "high", text: `plenty of ${kinds}` }
	return { level: "some", text: `some ${kinds}` }
}

// One sentence, meta-description sized.
export function summary(t: TitleInput) {
	const s = t.fingerprint.scores
	const adj = feelAdjectives(s, 2)
	const themes = top(s, THEME, 7, 2).map((k) => THEME[k]!)
	const craft = top(s, CRAFT, 9, 2).map((k) => CRAFT[k]!)
	const g = genreLabel(t)
	let out = adj.length ? `${cap(article(adj[0]))} ${adj.join(", ")} ${g}` : `${cap(article(g))} ${g}`
	if (themes.length) out += ` about ${list(themes)}`
	if (craft.length) out += `, with standout ${list(craft)}`
	return `${out}.`
}

export function feelParagraph(t: TitleInput) {
	const s = t.fingerprint.scores
	const adj = feelAdjectives(s, 4)
	const humor = humorPhrase(s)
	const themes = top(s, THEME, 6, 3).map((k) => THEME[k]!)
	const sentences: string[] = []
	if (adj.length) sentences.push(`${t.title} is ${list(adj)}.`)
	if (themes.length) sentences.push(`At its core it's about ${list(themes)}.`)
	sentences.push(`Expect ${humor.text}.`)
	if (s.slow_burn >= 7) sentences.push("The story takes its time and builds slowly.")
	else if (s.fast_pace >= 7) sentences.push("It moves fast and rarely slows down.")
	if (s.complexity >= 8) sentences.push("It rewards full attention; the plot is layered.")
	return sentences.join(" ")
}

export function standouts(t: TitleInput) {
	const s = t.fingerprint.scores
	return top(s, CRAFT, 8, 4).map((k) => ({ key: k, label: CRAFT[k]!, score: s[k] }))
}

export function craftSentence(t: TitleInput) {
	const items = standouts(t)
	if (!items.length) return ""
	const what = list(items.map((i) => `${i.label} (${pct(i.score)})`))
	return `GoodWatch rates its ${what} as ${items.length === 1 ? "a standout" : "standouts"}.`
}

const BEST_FOR_LABEL: Record<string, string> = {
	solo_watch: "watching alone",
	date_night: "a date night",
	partner: "watching with a partner",
	friends: "a night with friends",
	group_party: "a group party",
	family: "family movie night",
	kids: "kids",
	teens: "teens",
	intergenerational: "watching across generations",
}

const CONTEXT_LABEL: Record<string, string> = {
	thought_provoking: "leaves you with a lot to think about",
	pure_escapism: "works as pure escapism",
	comfort_watch: "makes a good comfort watch",
	background_friendly: "works with half your attention",
	binge_friendly: "is easy to binge",
	drop_in_friendly: "is easy to follow if you miss a bit",
}

export function bestFor(t: TitleInput) {
	const ids = t.fingerprint.socialSuitability.map((x) => x.id)
	return ids.filter((id) => BEST_FOR_LABEL[id]).map((id) => BEST_FOR_LABEL[id])
}

export function bestForSentence(t: TitleInput) {
	const who = bestFor(t).slice(0, 4)
	const ctx = t.fingerprint.viewingContext.map((x) => CONTEXT_LABEL[x.id]).filter(Boolean)
	const parts: string[] = []
	if (who.length) parts.push(`Good for ${list(who, "or")}.`)
	if (ctx.length) parts.push(`It ${list(ctx.slice(0, 2))}.`)
	return parts.join(" ")
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

// Yes/no questions people type into search, answered from scores.
export interface Faq {
	q: string
	a: string
}

function level(score: number, yes: string, some: string, no: string) {
	return score >= 7 ? yes : score >= 4 ? some : no
}

export function faqs(t: TitleInput): Faq[] {
	const s = t.fingerprint.scores
	const n = noun(t)
	const T = t.title
	const ids = t.fingerprint.socialSuitability.map((x) => x.id)
	const humorMax = Math.max(...(Object.keys(HUMOR) as Key[]).map((k) => s[k]))
	const out: Faq[] = [
		{
			q: `Is ${T} scary?`,
			a: level(
				Math.max(s.scare, s.uncanny),
				`Yes. GoodWatch scores it ${pct(s.scare)} for scares and ${pct(s.uncanny)} for eeriness.`,
				`Somewhat. It has unsettling moments (scares ${pct(s.scare)}, eeriness ${pct(s.uncanny)}), but horror isn't its focus.`,
				`No. It scores ${pct(s.scare)} for scares.`,
			),
		},
		{
			q: `Is ${T} violent?`,
			a: level(
				s.violence,
				`Yes. Violence scores ${pct(s.violence)}, so expect graphic or frequent physical conflict.`,
				`Moderately. Violence scores ${pct(s.violence)}.`,
				`Not really. Violence scores ${pct(s.violence)}.`,
			),
		},
		{
			q: `Is ${T} funny?`,
			a: level(
				humorMax,
				`Yes. It has ${humorPhrase(s).text}.`,
				`A little. Expect ${humorPhrase(s).text}, but it's not a comedy at heart.`,
				`No. It's a serious ${n} with ${humorPhrase(s).text}.`,
			),
		},
		{
			q: `Is ${T} sad?`,
			a: level(
				Math.max(s.melancholy, s.pathos),
				`Yes, it can be. Pathos scores ${pct(s.pathos)} and melancholy ${pct(s.melancholy)}.`,
				`In places. Pathos scores ${pct(s.pathos)}.`,
				`Not particularly. Melancholy scores ${pct(s.melancholy)}.`,
			),
		},
		{
			q: `Is ${T} slow?`,
			a:
				s.slow_burn >= 7
					? `It's a slow burn (${pct(s.slow_burn)}). The payoff builds gradually.`
					: s.fast_pace >= 7
						? `No. It's fast-paced (${pct(s.fast_pace)}).`
						: `It keeps a moderate pace (slow burn ${pct(s.slow_burn)}, fast pace ${pct(s.fast_pace)}).`,
		},
		{
			q: `Is ${T} hard to follow?`,
			a: level(
				s.complexity,
				`It asks for attention. Complexity scores ${pct(s.complexity)}.`,
				`Not very. Complexity scores ${pct(s.complexity)}.`,
				`No. Complexity scores ${pct(s.complexity)}, so it's easy to follow.`,
			),
		},
		{
			q: `Is ${T} good for date night?`,
			a: ids.includes("date_night")
				? `Yes. GoodWatch marks it as a good date-night pick${s.romance >= 6 ? ` with real romance (${pct(s.romance)})` : ""}.`
				: `Probably not. GoodWatch doesn't mark it as a date-night pick.`,
		},
		{
			q: `Is ${T} family friendly?`,
			a: ids.includes("family") || ids.includes("kids")
				? `Yes. GoodWatch marks it as suitable for ${list(["family", "kids"].filter((x) => ids.includes(x)))}.`
				: `No. GoodWatch marks it for ${list(["adults", "teens"].filter((x) => ids.includes(x))) || "older viewers"}, not kids.`,
		},
	]
	return out
}

// Evaluates the mood pages' own fingerprint rules against this title, so the
// links are the same pages this title would appear on.
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

// The word count of GoodWatch-only prose a variant adds, shown in the switcher.
export function wordCount(parts: string[]) {
	return parts.join(" ").split(/\s+/).filter(Boolean).length
}

// --- Per-pillar explanations, for the drill-down variant ---

export const PILLAR_KEYS: Record<string, Key[]> = {
	Energy: ["adrenaline", "tension", "scare", "fast_pace", "spectacle", "violence"],
	Heart: ["romance", "wholesome", "pathos", "melancholy", "hopefulness", "catharsis", "nostalgia", "coming_of_age", "family_dynamics", "wonder"],
	Humor: ["situational_comedy", "wit_wordplay", "physical_comedy", "cringe_humor", "absurdist_humor", "satire_parody", "dark_humor"],
	World: ["world_immersion", "dialogue_centrality", "rewatchability", "ambiguity", "novelty"],
	Craft: ["direction", "acting", "narrative_structure", "dialogue_quality", "character_depth", "intrigue", "complexity", "non_linear_narrative", "meta_narrative"],
	Style: ["cinematography", "editing", "music_composition", "visual_stylization", "music_centrality", "sound_centrality"],
}

export function pillarDrivers(t: TitleInput, pillar: string) {
	const s = t.fingerprint.scores
	return [...PILLAR_KEYS[pillar]].sort((a, b) => s[b] - s[a]).slice(0, 3).map((k) => ({ key: k, score: s[k] }))
}

export function pillarSentence(t: TitleInput, pillar: string) {
	const s = t.fingerprint.scores
	const pick = (keys: Key[], lex: Partial<Record<Key, string>>, min = 7) =>
		keys.filter((k) => s[k] >= min && lex[k]).sort((a, b) => s[b] - s[a]).map((k) => lex[k]!)
	const feel = (keys: Key[]) =>
		keys.filter((k) => s[k] >= 7 && FEEL[k]).sort((a, b) => s[b] - s[a]).map((k) => (s[k] >= 9 ? FEEL[k]!.strong : FEEL[k]!.adj))
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
			const th = top(s, THEME, 7, 3).map((k) => THEME[k]!)
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

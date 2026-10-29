// What a title does to the viewer, read from its fingerprint: effects such as "Leaves you in awe" combine several
// sub-scores (wonder AND spectacle AND a world to sink into), so the title page can name a feeling and show exactly
// which scores make it. Shared by the title page's fingerprint section and the server's population queries
// (rarest pairs of effects, titles that share a selection of effects).
//
// Scoring rule (the same for every effect, so effects compare on one scale, 0 to 10):
//   part value  = the sub-score; for a group ("any humor kind"), the mean of its two highest members.
//   mix         = weighted mean of the positive parts.
//   weakest     = the lowest of the parts marked `need` (what makes it a combination: awe needs wonder and spectacle
//                 and world immersion, so a 9 in wonder alone can't carry it).
//   held back   = for each negative part, |weight| x how far the score is above 4 (a little bleakness never hurts a
//                 warm title; a lot does).
//   strength    = 0.6 x mix + 0.4 x weakest - held back, clamped to 0..10.
// An effect counts when its strength reaches its threshold (6.5 unless it says otherwise). Ties go to the effect with
// more needed parts (the more specific combination), then library order.
import type { CoreScores } from "~/server/utils/fingerprint"
import type { Area } from "~/ui/details/fingerprint/area-colors"

export type Key = keyof CoreScores

export interface Part {
	/** One sub-score, or a group whose value is the mean of its two highest members. */
	key: Key | readonly Key[]
	/** Positive weights mix in; negative weights hold the effect back. */
	w: number
	/** A must-have: the weakest must-have pulls the strength down. */
	need?: boolean
	/** A name for a group ("any kind of comedy"). */
	label?: string
}

export interface Effect {
	id: string
	name: string
	/** One line: what it feels like from the couch. */
	meaning: string
	/** The area whose color the effect wears, so it matches the fingerprint's colors. */
	area: Area
	parts: readonly Part[]
	/** The strength at which the effect counts. */
	min?: number
	/** An effect of how well it's made (most acclaimed titles have it): at most two lead the list. */
	craft?: boolean
	/** For effects whose absence is worth saying ("Not for laughs"): what you'd come for. */
	noun?: string
}

const HUMOR_LOUD: readonly Key[] = [
	"situational_comedy",
	"physical_comedy",
	"absurdist_humor",
]
const HUMOR_DRY: readonly Key[] = [
	"wit_wordplay",
	"dark_humor",
	"satire_parody",
]
const ELSEWHERE: readonly Key[] = ["fantasy", "futuristic", "historical"]
const POWER: readonly Key[] = ["political", "class_and_capitalism"]
const STRANGE: readonly Key[] = ["surrealism", "psychedelic", "meta_narrative"]
const SQUIRM: readonly Key[] = ["cringe_humor", "grotesque"]
const REAL_STORY: readonly Key[] = ["historical", "biographical"]

export const EFFECTS: readonly Effect[] = [
	{
		id: "awe",
		noun: "awe",
		name: "Leaves you in awe",
		meaning: "Wonder on a big canvas, in a world you can sink into.",
		area: "World",
		parts: [
			{ key: "wonder", w: 1, need: true },
			{ key: "spectacle", w: 0.9, need: true },
			{ key: "world_immersion", w: 0.9, need: true },
			{ key: "music_composition", w: 0.4 },
			{ key: "cinematography", w: 0.4 },
		],
	},
	{
		id: "edge",
		noun: "suspense",
		name: "Keeps you on edge",
		meaning: "Tension that rarely lets go.",
		area: "Energy",
		parts: [
			{ key: "tension", w: 1, need: true },
			{ key: "intrigue", w: 0.6, need: true },
			{ key: "adrenaline", w: 0.4 },
			{ key: "scare", w: 0.2 },
		],
	},
	{
		id: "think",
		noun: "big ideas",
		name: "Makes you think",
		meaning: "Big ideas in a story that doesn't spell them out.",
		area: "Craft",
		parts: [
			{ key: "philosophical", w: 1, need: true },
			{ key: "complexity", w: 0.8, need: true },
			{ key: "ambiguity", w: 0.6 },
			{ key: "social_commentary", w: 0.3 },
		],
	},
	{
		id: "heartbreak",
		noun: "tears",
		name: "Breaks your heart",
		meaning: "Sadness that lands because you care.",
		area: "Heart",
		parts: [
			{ key: "pathos", w: 1, need: true },
			{ key: "melancholy", w: 1, need: true },
			{ key: "character_depth", w: 0.4 },
			{ key: "hopefulness", w: -0.15 },
		],
	},
	{
		id: "longing",
		noun: "romance",
		name: "Leaves you longing",
		meaning: "Love and what might have been.",
		area: "Heart",
		parts: [
			{ key: "romance", w: 1, need: true },
			{ key: "melancholy", w: 0.9, need: true },
			{ key: "nostalgia", w: 0.6 },
			{ key: "slow_burn", w: 0.3 },
		],
	},
	{
		id: "laugh",
		noun: "laughs",
		name: "Makes you laugh",
		meaning: "Out-loud comedy: situations, slapstick, absurdity.",
		area: "Humor",
		parts: [
			{ key: HUMOR_LOUD, w: 1, need: true, label: "Comedy" },
			{ key: "bleakness", w: -0.3 },
		],
	},
	{
		id: "smirk",
		name: "Makes you smirk",
		meaning: "Dry wit, dark jokes, a satirical edge.",
		area: "Humor",
		parts: [
			{ key: HUMOR_DRY, w: 1, need: true, label: "Dry humor" },
			{ key: "eccentricity", w: 0.3 },
		],
	},
	{
		id: "pull",
		craft: true,
		name: "Pulls you in",
		meaning: "A world and a story you can't step out of.",
		area: "World",
		parts: [
			{ key: "world_immersion", w: 1, need: true },
			{ key: "narrative_structure", w: 0.8, need: true },
			{ key: "intrigue", w: 0.6 },
			{ key: "rewatchability", w: 0.3 },
		],
		min: 7.5,
	},
	{
		id: "warm",
		noun: "warmth",
		name: "Warms you up",
		meaning: "Kind, gentle, hopeful company.",
		area: "Heart",
		parts: [
			{ key: "wholesome", w: 1, need: true },
			{ key: "hopefulness", w: 0.9, need: true },
			{ key: "bleakness", w: -0.4 },
			{ key: "violence", w: -0.3 },
		],
	},
	{
		id: "lift",
		noun: "uplift",
		name: "Lifts you up",
		meaning: "Earned hope: you come out lighter.",
		area: "Heart",
		parts: [
			{ key: "hopefulness", w: 1, need: true },
			{ key: "catharsis", w: 0.8, need: true },
			{ key: "bleakness", w: -0.3 },
		],
	},
	{
		id: "pulse",
		noun: "adrenaline",
		name: "Gets your pulse racing",
		meaning: "Fast, physical, adrenaline first.",
		area: "Energy",
		parts: [
			{ key: "adrenaline", w: 1, need: true },
			{ key: "fast_pace", w: 0.8, need: true },
			{ key: "spectacle", w: 0.4 },
		],
	},
	{
		id: "fear",
		noun: "scares",
		name: "Scares you",
		meaning: "Dread and frights that stay after the lights go off.",
		area: "Energy",
		parts: [
			{ key: "scare", w: 1, need: true },
			{ key: "uncanny", w: 0.7, need: true },
			{ key: "tension", w: 0.4 },
		],
	},
	{
		id: "skin",
		name: "Gets under your skin",
		meaning: "Something is off, and it lives in people's heads.",
		area: "Energy",
		parts: [
			{ key: "uncanny", w: 1, need: true },
			{ key: "psychological", w: 0.9, need: true },
			{ key: "ambiguity", w: 0.3 },
		],
	},
	{
		id: "guess",
		name: "Keeps you guessing",
		meaning: "Questions, clues, and answers held back.",
		area: "Craft",
		parts: [
			{ key: "mystery", w: 1, need: true },
			{ key: "intrigue", w: 0.9, need: true },
			{ key: "complexity", w: 0.3 },
			{ key: "non_linear_narrative", w: 0.3 },
		],
	},
	{
		id: "bend",
		name: "Bends your mind",
		meaning: "Dreamlike, trippy, playing with what's real.",
		area: "Style",
		parts: [
			{ key: STRANGE, w: 1, need: true, label: "Strangeness" },
			{ key: "complexity", w: 0.5, need: true },
			{ key: "non_linear_narrative", w: 0.4 },
		],
	},
	{
		id: "elsewhere",
		name: "Takes you somewhere else",
		meaning: "A far-off world, past or future, built to live in.",
		area: "World",
		parts: [
			{ key: ELSEWHERE, w: 1, need: true, label: "Another time or world" },
			{ key: "world_immersion", w: 0.9, need: true },
			{ key: "novelty", w: 0.3 },
		],
	},
	{
		id: "real",
		name: "Feels like real life",
		meaning: "Ordinary places, people who talk like people.",
		area: "World",
		parts: [
			{ key: "contemporary_realism", w: 1, need: true },
			{ key: "character_depth", w: 0.7, need: true },
			{ key: "dialogue_quality", w: 0.5 },
		],
	},
	{
		id: "mirror",
		name: "Holds up a mirror",
		meaning: "Says something sharp about power, money and society.",
		area: "World",
		parts: [
			{ key: "social_commentary", w: 1, need: true },
			{ key: POWER, w: 0.8, need: true, label: "Power and money" },
			{ key: "satire_parody", w: 0.3 },
		],
	},
	{
		id: "schemes",
		name: "Draws you into power games",
		meaning: "Plots, alliances and betrayals to keep track of.",
		area: "Craft",
		parts: [
			{ key: "political", w: 1, need: true },
			{ key: "intrigue", w: 0.8, need: true },
			{ key: "complexity", w: 0.5 },
		],
	},
	{
		id: "shaken",
		noun: "brutality",
		name: "Leaves you shaken",
		meaning: "Violence with weight, in a dark world.",
		area: "Energy",
		parts: [
			{ key: "violence", w: 1, need: true },
			{ key: "bleakness", w: 0.8, need: true },
			{ key: "grotesque", w: 0.3 },
			{ key: "tension", w: 0.3 },
		],
	},
	{
		id: "weighs",
		name: "Weighs on you",
		meaning: "Dark and heavy; little light gets in.",
		area: "Heart",
		parts: [
			{ key: "bleakness", w: 1, need: true },
			{ key: "melancholy", w: 0.5 },
			{ key: "hopefulness", w: -0.3 },
		],
		min: 7,
	},
	{
		id: "care",
		craft: true,
		name: "Makes you care deeply",
		meaning: "People drawn so well you feel for them.",
		area: "Heart",
		parts: [
			{ key: "character_depth", w: 1, need: true },
			{ key: "pathos", w: 0.9, need: true },
			{ key: "acting", w: 0.5 },
		],
		min: 7.5,
	},
	{
		id: "home",
		name: "Hits close to home",
		meaning: "Families, the ties and the friction.",
		area: "Heart",
		parts: [
			{ key: "family_dynamics", w: 1, need: true },
			{ key: "pathos", w: 0.6, need: true },
			{ key: "contemporary_realism", w: 0.3 },
			{ key: "coming_of_age", w: 0.3 },
		],
	},
	{
		id: "goosebumps",
		craft: true,
		name: "Gives you goosebumps",
		meaning: "Music and sound carry the big moments.",
		area: "Style",
		parts: [
			{ key: "music_composition", w: 1, need: true },
			{ key: "music_centrality", w: 0.8, need: true },
			{ key: "sound_centrality", w: 0.5 },
			{ key: "spectacle", w: 0.3 },
		],
		min: 7.5,
	},
	{
		id: "eyes",
		craft: true,
		name: "Feasts your eyes",
		meaning: "Frames you'd pause just to look at.",
		area: "Style",
		parts: [
			{ key: "cinematography", w: 1, need: true },
			{ key: "visual_stylization", w: 0.8, need: true },
			{ key: "spectacle", w: 0.3 },
		],
		min: 7.5,
	},
	{
		id: "attention",
		craft: true,
		name: "Rewards close watching",
		meaning: "Layered plotting that pays back full attention.",
		area: "Craft",
		parts: [
			{ key: "complexity", w: 1, need: true },
			{ key: "narrative_structure", w: 0.8, need: true },
			{ key: "non_linear_narrative", w: 0.3 },
			{ key: "rewatchability", w: 0.3 },
		],
		min: 7.5,
	},
	{
		id: "patience",
		name: "Pays off your patience",
		meaning: "Builds slowly, then lands hard.",
		area: "Energy",
		parts: [
			{ key: "slow_burn", w: 1, need: true },
			{ key: "catharsis", w: 0.9, need: true },
			{ key: "direction", w: 0.3 },
		],
	},
	{
		id: "lingers",
		name: "Stays with you",
		meaning: "Open questions and feelings that outlast the credits.",
		area: "Heart",
		parts: [
			{ key: "ambiguity", w: 1, need: true },
			{ key: "pathos", w: 0.8, need: true },
			{ key: "philosophical", w: 0.4 },
		],
	},
	{
		id: "back",
		name: "Takes you back",
		meaning: "Growing up, and the pull of the past.",
		area: "Heart",
		parts: [
			{ key: "nostalgia", w: 1, need: true },
			{ key: "coming_of_age", w: 0.8, need: true },
			{ key: "wholesome", w: 0.2 },
		],
	},
	{
		id: "squirm",
		name: "Makes you squirm",
		meaning: "Awkward, gross or both, on purpose.",
		area: "Humor",
		parts: [{ key: SQUIRM, w: 1, need: true, label: "Cringe and gross-out" }],
		min: 7,
	},
	{
		id: "battle",
		name: "Puts you on the battlefield",
		meaning: "War at full scale, felt up close.",
		area: "Energy",
		parts: [
			{ key: "warfare", w: 1, need: true },
			{ key: "spectacle", w: 0.8, need: true },
			{ key: "violence", w: 0.3 },
		],
	},
	{
		id: "crime",
		name: "Puts you inside a crime",
		meaning: "Crime from the inside: the plans, the risks, the cost.",
		area: "World",
		parts: [
			{ key: "crime", w: 1, need: true },
			{ key: "tension", w: 0.7, need: true },
			{ key: "psychological", w: 0.4 },
		],
	},
	{
		id: "fall",
		name: "Makes you fall for them",
		meaning: "Romance with chemistry you can feel.",
		area: "Heart",
		parts: [
			{ key: "romance", w: 1, need: true },
			{ key: "character_depth", w: 0.6, need: true },
			{ key: "eroticism", w: 0.3 },
		],
	},
	{
		id: "charm",
		name: "Charms you",
		meaning: "Odd characters and a playful voice.",
		area: "Humor",
		parts: [
			{ key: "eccentricity", w: 1, need: true },
			{ key: "wit_wordplay", w: 0.7, need: true },
			{ key: "wholesome", w: 0.3 },
		],
	},
	{
		id: "learn",
		name: "Teaches you something",
		meaning: "You come away knowing more about a real story.",
		area: "Craft",
		parts: [
			{ key: "educational", w: 1, need: true },
			{ key: REAL_STORY, w: 0.7, need: true, label: "Real history" },
		],
	},
	{
		id: "comfort",
		noun: "comfort",
		name: "Feels like comfort food",
		meaning: "Easy, warm and good to come back to.",
		area: "Humor",
		parts: [
			{ key: "rewatchability", w: 1, need: true },
			{ key: "wholesome", w: 0.9, need: true },
			{ key: "situational_comedy", w: 0.4 },
			{ key: "complexity", w: -0.3 },
			{ key: "bleakness", w: -0.3 },
		],
	},
]

const DEFAULT_MIN = 6.5

const round1 = (n: number) => Math.round(n * 10) / 10

export interface PartReading {
	part: Part
	/** For a group, every member with its score, highest first; the two highest made the value. */
	members: { key: Key; score: number }[]
	value: number
}

export interface EffectReading {
	effect: Effect
	strength: number
	counts: boolean
	threshold: number
	parts: PartReading[]
	weakest: PartReading | null
	/** How much the negative parts took off. */
	heldBack: number
}

function readPart(part: Part, s: CoreScores): PartReading {
	const keys = typeof part.key === "string" ? [part.key] : part.key
	const members = keys
		.map((key) => ({ key, score: s[key] ?? 0 }))
		.sort((a, b) => b.score - a.score)
	const value =
		members.length === 1
			? members[0].score
			: (members[0].score + members[1].score) / 2
	return { part, members, value }
}

export function readEffect(effect: Effect, s: CoreScores): EffectReading {
	const parts = effect.parts.map((p) => readPart(p, s))
	const pos = parts.filter((p) => p.part.w > 0)
	const mix =
		pos.reduce((n, p) => n + p.value * p.part.w, 0) /
		pos.reduce((n, p) => n + p.part.w, 0)
	const needs = pos.filter((p) => p.part.need)
	const weakest = needs.length
		? needs.reduce((lo, p) => (p.value < lo.value ? p : lo))
		: null
	const heldBack = parts
		.filter((p) => p.part.w < 0)
		.reduce((n, p) => n + -p.part.w * Math.max(0, p.value - 4), 0)
	const strength = round1(
		Math.max(
			0,
			Math.min(10, 0.6 * mix + 0.4 * (weakest?.value ?? mix) - heldBack),
		),
	)
	const threshold = effect.min ?? DEFAULT_MIN
	return {
		effect,
		strength,
		counts: strength >= threshold,
		threshold,
		parts,
		weakest,
		heldBack: round1(heldBack),
	}
}

/** Every effect for a title, strongest first. */
export function readEffects(s: CoreScores): EffectReading[] {
	const needs = (r: EffectReading) =>
		r.effect.parts.filter((p) => p.need).length
	return EFFECTS.map((e) => readEffect(e, s)).sort(
		(a, b) =>
			b.strength - a.strength ||
			needs(b) - needs(a) ||
			EFFECTS.indexOf(a.effect) - EFFECTS.indexOf(b.effect),
	)
}

/** The strength as a word, in the scales' manner. Below its threshold an effect only reads as "some" or "a little". */
export function strengthWord(r: EffectReading) {
	const n = r.strength
	if (!r.counts) return n >= 5.5 ? "Some" : "A little"
	if (n >= 9.5) return "Overwhelming"
	if (n >= 8.5) return "Very strong"
	if (n >= 7.5) return "Strong"
	return "Clear"
}

/** What not to come for: up to three effects a viewer might expect, that this title barely has (under 2.5). */
export function notFor(readings: readonly EffectReading[]) {
	return readings
		.filter((r) => r.effect.noun && r.strength < 2.5)
		.sort((a, b) => a.strength - b.strength)
		.slice(0, 3)
		.map((r) => r.effect.noun as string)
}

/**
 * The effects that lead, strongest first, with one variety rule: at most two craft effects ("Pulls you in", "Feasts
 * your eyes"...) among them, since nearly every acclaimed title has those; a third waits in the rest, still in order.
 */
export function leading(counted: readonly EffectReading[], n: number) {
	const lead: EffectReading[] = []
	let craft = 0
	for (const r of counted) {
		if (lead.length === n) break
		if (r.effect.craft && craft === 2) continue
		if (r.effect.craft) craft++
		lead.push(r)
	}
	return { lead, rest: counted.filter((r) => !lead.includes(r)) }
}

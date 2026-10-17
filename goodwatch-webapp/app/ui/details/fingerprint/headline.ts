// The words at the head of the fingerprint section: one composed sentence for the whole title, and a few bold lines
// for one area. Both come as segments, so the words that name an area can be colored and selected.

import * as F from "~/ui/fingerprint/fingerprintText"
import { type Area, type TraitKey, areaOfTrait } from "./areas"
import { type PickedContrast, pickContrasts } from "./contrasts"

/** A run of headline text. With an area it is a selectable word in the area's color; else plain or muted. */
export type Segment =
	| { text: string; area: Area }
	| { text: string; area?: undefined; tone: "plain" | "muted" }

const plain = (text: string): Segment => ({ text, tone: "plain" })
const muted = (text: string): Segment => ({ text, tone: "muted" })

// Adjectives for traits that describe how a title feels. `strong` is used at 9 or more.
const FEEL: Partial<Record<TraitKey, { adj: string; strong: string }>> = {
	adrenaline: { adj: "thrilling", strong: "pulse-pounding" },
	tension: { adj: "tense", strong: "nerve-racking" },
	scare: { adj: "scary", strong: "terrifying" },
	violence: { adj: "violent", strong: "brutal" },
	romance: { adj: "romantic", strong: "deeply romantic" },
	wholesome: { adj: "wholesome", strong: "heartwarming" },
	wonder: { adj: "wondrous", strong: "awe-inspiring" },
	pathos: { adj: "moving", strong: "deeply moving" },
	melancholy: { adj: "melancholic", strong: "bittersweet" },
	uncanny: { adj: "eerie", strong: "deeply unsettling" },
	nostalgia: { adj: "nostalgic", strong: "nostalgic" },
	hopefulness: { adj: "hopeful", strong: "uplifting" },
	bleakness: { adj: "bleak", strong: "bleak" },
	slow_burn: { adj: "slow-burning", strong: "slow-burning" },
	fast_pace: { adj: "fast-paced", strong: "breakneck" },
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

// Tone words read as heart in the headline.
const leadArea = (k: TraitKey): Area =>
	k === "bleakness" || k === "hopefulness" ? "Heart" : areaOfTrait(k)

/** An area as a short phrase, by tier (0 to 4): the first of an area's lines. */
const AREA_PHRASE: Record<Area, readonly string[]> = {
	Energy: [
		"Calm",
		"Low-key",
		"Steady energy",
		"High energy",
		"Relentless energy",
	],
	Heart: [
		"Emotionally cool",
		"Emotionally reserved",
		"Some heart",
		"Big heart",
		"Deeply emotional",
	],
	Humor: ["No humor", "A touch of humor", "Light humor", "Funny", "Very funny"],
	World: [
		"A thin world",
		"A simple world",
		"A solid world",
		"A rich world",
		"A fully immersive world",
	],
	Craft: [
		"Rough craft",
		"Plain craft",
		"Solid craft",
		"Strong craft",
		"Masterful craft",
	],
	Style: [
		"Plain style",
		"Modest style",
		"Clean style",
		"Striking style",
		"Stunning style",
	],
}

// The first genre on this list names the title.
const GENRE_NOUN: [string, string][] = [
	["Science Fiction", "sci-fi"],
	["Animation", "animated"],
	["Horror", "horror"],
	["Crime", "crime"],
	["Fantasy", "fantasy"],
	["Thriller", "thriller"],
	["Comedy", "comedy"],
	["Romance", "romance"],
	["War", "war"],
	["Western", "western"],
	["Mystery", "mystery"],
	["Documentary", "documentary"],
	["Family", "family"],
	["Action", "action"],
	["Adventure", "adventure"],
	["Drama", "drama"],
]
// "A nostalgic, eccentric comedy" reads better than "comedy movie".
const STANDALONE_MOVIE_GENRES = [
	"comedy",
	"drama",
	"thriller",
	"western",
	"documentary",
]

function titleNoun(t: F.TitleInput) {
	const genre = GENRE_NOUN.find(([g]) => t.genres.includes(g))?.[1]
	const kind = t.mediaType === "movie" ? "movie" : "series"
	if (!genre) return kind
	if (t.mediaType === "movie" && STANDALONE_MOVIE_GENRES.includes(genre))
		return genre
	return `${genre} ${kind}`
}

const isLight = (t: F.TitleInput) =>
	t.genres.includes("Comedy") ||
	t.genres.includes("Animation") ||
	t.genres.includes("Family")

// "thrilling but never gory" inside the sentence; "Thrilling," + " not gory." as a line of its own.
function contrastSegments(
	{ contrast: c, leadKey }: PickedContrast,
	as: "clause" | "line",
): Segment[] {
	const area = areaOfTrait(leadKey)
	if (as === "line")
		return [
			{ text: `${c.lead},`, area },
			c.conj === "not"
				? muted(` ${c.conj} ${c.other}.`)
				: plain(` ${c.conj} ${c.other}.`),
		]
	const lead = c.lead.toLowerCase()
	if (c.conj === "not")
		return [{ text: lead, area }, muted(` but never ${c.other}`)]
	return [{ text: lead, area }, plain(` ${c.conj} ${c.other}`)]
}

// How the title looks, from its top style and craft tiers.
function lookClause(tier: F.TitleInput["fingerprint"]["pillars"]): Segment[] {
	if (tier.Style === 4 && tier.Craft === 4)
		return [
			{ text: "stunning", area: "Style" },
			plain(" and "),
			{ text: "masterfully made", area: "Craft" },
		]
	if (tier.Style === 4) return [{ text: "stunning to look at", area: "Style" }]
	if (tier.Craft === 4) return [{ text: "masterfully made", area: "Craft" }]
	if (tier.Style === 3) return [{ text: "striking to look at", area: "Style" }]
	if (tier.Craft === 3) return [{ text: "well made", area: "Craft" }]
	return []
}

const HUMOR_CLAUSE = [
	"never funny",
	"rarely funny",
	"only lightly funny",
	"often funny",
	"very funny",
]
// A comedy or a family title that isn't funny is still light, so "never funny" would mislead.
const LIGHT_HUMOR_CLAUSE = [
	"with no jokes",
	"with a touch of humor",
	"with light humor",
	"often funny",
	"very funny",
]

/**
 * The whole fingerprint in one sentence, for example "A relentless, philosophical sci-fi movie: stunning to look
 * at, thrilling but never gory, only lightly funny." Two lead adjectives, then up to three clauses: the look, one
 * contrast, and heart or humor, whichever stands further from the middle.
 */
export function composeHeadline(t: F.TitleInput): Segment[] {
	const s = t.fingerprint.scores
	const tier = t.fingerprint.pillars
	const used = new Set<TraitKey>()
	const touched = new Set<Area>()

	// "relentless" when energy is at the top, then the strongest feel words, preferring an area not yet named.
	const lead: { text: string; area: Area }[] = []
	if (tier.Energy === 4) {
		lead.push({ text: "relentless", area: "Energy" })
		touched.add("Energy")
	}
	const candidates = (Object.keys(FEEL) as TraitKey[])
		.filter((k) => s[k] >= 7 && k !== "spectacle")
		.sort((a, b) => s[b] - s[a] || tier[leadArea(b)] - tier[leadArea(a)])
	const pickLead = (freshAreaOnly: boolean) => {
		for (const k of candidates) {
			if (lead.length >= 2) return
			if (used.has(k) || (freshAreaOnly && touched.has(leadArea(k)))) continue
			const words = FEEL[k]
			if (!words) continue
			const word = s[k] >= 9 ? words.strong : words.adj
			if (lead.some((x) => x.text === word)) continue
			lead.push({ text: word, area: leadArea(k) })
			used.add(k)
			touched.add(leadArea(k))
		}
	}
	pickLead(true)
	pickLead(false)

	const noun = titleNoun(t)
	const first = lead[0]?.text ?? noun
	const segs: Segment[] = [plain(/^[aeiou]/i.test(first) ? "An " : "A ")]
	lead.forEach((x, i) => {
		segs.push(x)
		segs.push(plain(i < lead.length - 1 ? ", " : " "))
	})
	segs.push(plain(noun))

	const clauses: Segment[][] = []
	const look = lookClause(tier)
	if (look.length) clauses.push(look)

	// Contrasts that start "A ..." ("A crime story") don't fit inside the sentence.
	const contrast = pickContrasts(s, 12).find(
		(x) =>
			!used.has(x.leadKey) &&
			!used.has(x.otherKey) &&
			!x.contrast.lead.startsWith("A "),
	)
	if (contrast) {
		clauses.push(contrastSegments(contrast, "clause"))
		touched.add(areaOfTrait(contrast.leadKey))
		touched.add(areaOfTrait(contrast.otherKey))
	}

	const heart: Segment | null =
		tier.Heart <= 1
			? { text: "emotionally reserved", area: "Heart" }
			: tier.Heart === 3
				? { text: "big-hearted", area: "Heart" }
				: tier.Heart === 4
					? { text: "deeply moving", area: "Heart" }
					: null
	// A comedy that is funny says so in its genre already.
	const humor: Segment | null =
		t.genres.includes("Comedy") && tier.Humor >= 3
			? null
			: tier.Humor <= 2 && s.dark_humor >= 7
				? { text: "darkly funny at times", area: "Humor" }
				: {
						text: (isLight(t) ? LIGHT_HUMOR_CLAUSE : HUMOR_CLAUSE)[tier.Humor],
						area: "Humor",
					}
	const feeling = [
		{ area: "Heart" as const, seg: heart },
		{ area: "Humor" as const, seg: humor },
	]
		.filter((x) => x.seg && !touched.has(x.area))
		.sort(
			(a, b) =>
				Math.abs(tier[b.area] - 2) - Math.abs(tier[a.area] - 2) ||
				tier[a.area] - tier[b.area],
		)[0]
	if (feeling?.seg) clauses.push([feeling.seg])

	if (clauses.length) {
		segs.push(plain(": "))
		clauses.forEach((c, i) => {
			segs.push(...c)
			if (i < clauses.length - 1) segs.push(plain(", "))
		})
	}
	segs.push(plain("."))
	return segs
}

/**
 * Bold lines for one area: the area's phrase ("Relentless energy."), then up to two contrasts led by its traits
 * ("Thrilling, not gory."). Without a contrast, the area's verdict follows instead.
 */
export function areaLines(t: F.TitleInput, area: Area): Segment[][] {
	const lines: Segment[][] = [
		[{ text: `${AREA_PHRASE[area][t.fingerprint.pillars[area]]}.`, area }],
	]
	const contrasts = pickContrasts(t.fingerprint.scores, 12).filter(
		(x) => areaOfTrait(x.leadKey) === area,
	)
	for (const x of contrasts.slice(0, 2)) lines.push(contrastSegments(x, "line"))
	if (lines.length === 1) {
		const verdict = F.pillarBrief(t, area).verdict
		// World verdicts are bare theme lists ("Family"), which need a frame to read as a line.
		const framed =
			area === "World" &&
			t.fingerprint.pillars.World >= 1 &&
			!verdict.startsWith("Kept")
				? `Built around ${verdict.charAt(0).toLowerCase()}${verdict.slice(1)}`
				: verdict
		lines.push([plain(`${framed}.`)])
	}
	return lines
}

/** The plain text of segments, for tests and labels. */
export const segmentText = (segs: Segment[]) => segs.map((x) => x.text).join("")

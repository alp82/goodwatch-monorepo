// The questions about how a title feels, answered from its fingerprint: will it make me laugh, plot or characters,
// can I half-watch it, date night, will it scare me, will I feel good after. A question is asked only when its answer
// is a strong verdict, and the answer names the trait scores behind it. Each answer comes with a small visual and the
// traits behind it (the "Why"). titleQuestions.ts picks at most two of them for the questions section.

import type { MovieResult, ShowResult } from "~/server/types/details-types"
import {
	type Area,
	HUMOR_TRAITS,
	type Scores,
	type TraitKey,
	areaLevelWord,
} from "~/ui/details/fingerprint/areas"
import {
	ATTENTION_TRAITS,
	attentionDemand,
} from "~/ui/details/fingerprint/scales"
import { byScore, clamp01 } from "~/ui/details/fingerprint/trait-scores"
import { GUIDE } from "~/ui/details/fingerprint/viewing-guide"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { list } from "~/ui/fingerprint/fingerprintText"

type Media = MovieResult | ShowResult

export type FingerprintQuestionId =
	| "laugh"
	| "drive"
	| "halfWatch"
	| "date"
	| "scare"
	| "feelGood"

export type FingerprintVisual =
	/** A dot between two ends, at 0 (left) to 1 (right). */
	| {
			kind: "slider"
			position: number
			left: string
			right: string
			area: Area
			label: string
	  }
	/** An area's tier (0 to 4) as a short meter with a word. */
	| { kind: "meter"; tier: number; area: Area; word: string }
	/** The viewing guide's audiences, with the ones the answer rests on highlighted. */
	| { kind: "chips"; items: string[]; highlighted: string[] }

export interface TraitEvidence {
	/** Names one side of a two-sided answer ("Characters"); a one-sided answer has none. */
	side?: string
	area: Area
	traits: { key: TraitKey; score: number }[]
}

export interface FingerprintAnswer {
	id: FingerprintQuestionId
	q: string
	a: string
	visual: FingerprintVisual
	evidence: TraitEvidence[]
	/** How far the verdict is from neutral; the section asks the strongest ones. */
	strength: number
	/** The question the title's genre raises: scare for horror, laugh for comedy, date night for romance. */
	genreQuestion: boolean
}

/** How many of these questions the section asks at most. */
export const MAX_FINGERPRINT_QUESTIONS = 2

const label = (k: TraitKey) => getFingerprintMeta(k).label.toLowerCase()
const scored = (s: Scores, keys: readonly TraitKey[]) =>
	keys.map((key) => ({ key, score: s[key] }))
/** "uncanny (9 of 10)" */
const traitWithScore = (s: Scores, k: TraitKey) => `${label(k)} (${s[k]} of 10)`
/** "9 of 10 for uncanny and 7 for tension" */
const ratedFor = (s: Scores, keys: readonly TraitKey[]) =>
	list(keys.map((k, i) => `${s[k]}${i === 0 ? " of 10" : ""} for ${label(k)}`))

// What each humor trait is called in a sentence.
const HUMOR_KIND: Partial<Record<TraitKey, string>> = {
	situational_comedy: "situational comedy",
	wit_wordplay: "sharp wit",
	physical_comedy: "slapstick",
	cringe_humor: "cringe comedy",
	absurdist_humor: "absurd humor",
	satire_parody: "satire",
	dark_humor: "dark humor",
}

const CHARACTER_KEYS: TraitKey[] = [
	"character_depth",
	"pathos",
	"dialogue_centrality",
]
const PLOT_KEYS: TraitKey[] = ["intrigue", "spectacle", "mystery"]

const hasGenre = (media: Media, ...names: string[]) =>
	(media.details.genres ?? []).some((g) => names.includes(g))

/**
 * The questions whose answer is a strong verdict, strongest first, with the title's genre question ahead of the rest.
 * None for a title without a fingerprint.
 */
export function fingerprintAnswers(media: Media): FingerprintAnswer[] {
	const fp = media.fingerprint
	if (!fp) return []
	const T = media.details.title
	const noun = media.mediaType === "movie" ? "movie" : "series"
	const s = fp.scores
	const who = fp.socialSuitability.map((entry) => entry.name)
	const context = fp.viewingContext.map((entry) => entry.name)
	const answers: FingerprintAnswer[] = []

	// Laugh: a funny title (humor tier 3 or more), or a comedy, whatever its tier. The humor kinds are named only when
	// there is humor to describe (tier 2 or more).
	const humor = fp.pillars.Humor
	const comedy = hasGenre(media, "Comedy")
	if (humor >= 3 || comedy) {
		const humorKeys = byScore(s, HUMOR_TRAITS)
		const kinds = humorKeys.filter((k) => s[k] >= 5 && HUMOR_KIND[k]).slice(0, 2)
		const kindText = list(kinds.map((k) => `${HUMOR_KIND[k]} (${s[k]} of 10)`))
		const a =
			humor >= 2 && kinds.length
				? `${humor >= 4 ? "Yes, a lot" : humor >= 3 ? "Yes" : "Now and then"}: the humor is mostly ${kindText}.`
				: `Not much for a comedy: the title analysis gives its humor ${humor} of 4.`
		answers.push({
			id: "laugh",
			q: `Will ${T} make me laugh?`,
			a,
			visual: {
				kind: "meter",
				tier: humor,
				area: "Humor",
				word: areaLevelWord("Humor", humor),
			},
			evidence: [{ area: "Humor", traits: scored(s, humorKeys.slice(0, 4)) }],
			strength: comedy ? 4 : humor,
			genreQuestion: comedy,
		})
	}

	// Plot or characters: the weighted character side against the weighted plot side, asked only when one side leads
	// by 2 or more.
	const character =
		(s.character_depth * 2 + s.pathos + s.dialogue_centrality) / 4
	const plot = (s.intrigue * 2 + s.spectacle + s.mystery) / 4
	if (Math.abs(plot - character) >= 2) {
		const lead =
			plot > character
				? byScore(s, PLOT_KEYS).slice(0, 2)
				: byScore(s, CHARACTER_KEYS).slice(0, 2)
		answers.push({
			id: "drive",
			q: `Is ${T} plot-driven or character-driven?`,
			a:
				plot > character
					? `Mostly plot-driven: ${list(lead.map((k) => traitWithScore(s, k)))} carry it more than its characters do.`
					: `Mostly character-driven: it leans on ${list(lead.map((k) => traitWithScore(s, k)))} more than on its plot.`,
			visual: {
				kind: "slider",
				position: clamp01((plot - character) / 8 + 0.5),
				left: "Characters",
				right: "Plot",
				area: "Craft",
				label: "Characters or plot",
			},
			evidence: [
				{ side: "Characters", area: "Heart", traits: scored(s, CHARACTER_KEYS) },
				{ side: "Plot", area: "Energy", traits: scored(s, PLOT_KEYS) },
			],
			strength: Math.abs(plot - character),
			genreQuestion: false,
		})
	}

	// Half-watch: asked for a demanding title (its two most demanding traits average 8 or more), or for an easy one
	// the viewing guide calls background or drop-in friendly.
	const demandKeys = byScore(s, ATTENTION_TRAITS)
	const demand = attentionDemand(s)
	const easyGuide = context.find(
		(c) => c === GUIDE.backgroundWatch || c === GUIDE.dropIn,
	)
	if (demand >= 8 || (demand <= 4 && easyGuide)) {
		answers.push({
			id: "halfWatch",
			q: `Can I half-watch ${T}?`,
			a:
				demand >= 8
					? `No, it needs your attention: the title analysis rates it ${ratedFor(s, demandKeys.slice(0, 2))}.`
					: `Yes: it's easy to follow, with ${label(demandKeys[0])} at only ${s[demandKeys[0]]} of 10, and the viewing guide calls it ${easyGuide === GUIDE.dropIn ? "drop-in friendly" : "good for background watching"}.`,
			visual: {
				kind: "slider",
				position: clamp01((demand - 2) / 8),
				left: "Easy watch",
				right: "Demanding",
				area: "Craft",
				label: "Attention",
			},
			evidence: [{ area: "Craft", traits: scored(s, demandKeys) }],
			strength: Math.abs(demand - 6) + 2,
			genreQuestion: false,
		})
	}

	// Date night: asked for a romance, or for a title where romance is 6 of 10 or more.
	const romance = s.romance
	const romanceGenre = hasGenre(media, "Romance")
	if (romanceGenre || romance >= 6) {
		const family = who.includes(GUIDE.familyNight) || who.includes(GUIDE.kids)
		const level = `romance is ${romance} of 10`
		answers.push({
			id: "date",
			q: `Is ${T} good for date night?`,
			a: who.includes(GUIDE.dateNight)
				? `${romance >= 6 ? "Yes" : "It can be"}: ${level}, and the viewing guide lists it for date night.`
				: family
					? `It's better for a family night: ${level}, and the viewing guide lists it for ${who.includes(GUIDE.kids) ? "kids and families" : "families"}.`
					: `${who.includes(GUIDE.partnerWatch) ? "It suits a quiet night in as a couple" : "Not really"}: ${level}, but the viewing guide doesn't list it for date night.`,
			visual: {
				kind: "chips",
				items: who,
				highlighted:
					who.includes(GUIDE.dateNight) || !family
						? [GUIDE.dateNight, GUIDE.partnerWatch]
						: [GUIDE.familyNight, GUIDE.kids, GUIDE.partnerWatch],
			},
			evidence: [{ area: "Heart", traits: scored(s, ["romance", "eroticism"]) }],
			// A title the guide doesn't list for date night answers less clearly.
			strength: romance - 3 - (who.includes(GUIDE.dateNight) ? 0 : 1),
			genreQuestion: romanceGenre,
		})
	}

	// Scare: asked for a horror title, a scary one (6 or more), or a gruesome one (grotesque 7 or more). A horror title
	// that unsettles more than it frightens says so.
	const horror = hasGenre(media, "Horror")
	if (horror || s.scare >= 6 || s.grotesque >= 7) {
		const unsettling = s.scare < 6 && (s.uncanny >= 7 || s.tension >= 8)
		const others = byScore(s, ["uncanny", "tension"]).filter((k) => s[k] >= 7)
		const a = unsettling
			? `It's more unsettling than scary: the title analysis rates it ${ratedFor(s, others)}, but ${s.scare} for scares.`
			: s.scare >= 6
				? `${s.scare >= 8 ? "Yes, it's frightening" : "At times"}: scares are rated ${s.scare} of 10${s.grotesque >= 7 ? `, and some images are gruesome (grotesque ${s.grotesque} of 10)` : ""}.`
				: s.grotesque >= 7
						? `It's more gruesome than scary: grotesque is rated ${s.grotesque} of 10, scares ${s.scare}.`
						: `Not much for a horror ${noun}: scares are rated ${s.scare} of 10 and tension ${s.tension}.`
		answers.push({
			id: "scare",
			q: `Will ${T} scare me?`,
			a,
			visual: {
				kind: "slider",
				position: clamp01(s.scare / 10),
				left: "Not scary",
				right: "Terrifying",
				area: "Energy",
				label: "Scare",
			},
			evidence: [
				{
					area: "Energy",
					traits: scored(s, byScore(s, ["scare", "tension", "uncanny", "grotesque"])),
				},
			],
			strength: Math.abs(s.scare - 5) + (horror ? 2 : 0),
			genreQuestion: horror,
		})
	}

	// Feel good: asked when hopefulness and bleakness are 5 or more points apart.
	const mood = s.hopefulness - s.bleakness
	if (Math.abs(mood) >= 5) {
		const tone = byScore(
			s,
			mood > 0 ? ["hopefulness", "wholesome"] : ["bleakness", "melancholy"],
		)
		answers.push({
			id: "feelGood",
			q: `Will I feel good after watching ${T}?`,
			a:
				mood > 0
					? `Yes, it's an uplifting ${noun}: the title analysis rates it ${ratedFor(s, tone)}.`
					: `Probably not: the title analysis rates it ${ratedFor(s, tone)}, against ${s.hopefulness} for hopefulness.`,
			visual: {
				kind: "slider",
				position: clamp01(mood / 16 + 0.5),
				left: "Bleak",
				right: "Hopeful",
				area: "Heart",
				label: "Tone",
			},
			evidence: [
				{
					area: "Heart",
					traits: scored(
						s,
						byScore(s, ["hopefulness", "wholesome", "bleakness", "melancholy"]),
					),
				},
			],
			strength: Math.abs(mood) / 2 + 1,
			genreQuestion: false,
		})
	}

	return answers.sort(
		(a, b) =>
			Number(b.genreQuestion) - Number(a.genreQuestion) ||
			b.strength - a.strength,
	)
}

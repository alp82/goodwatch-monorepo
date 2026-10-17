// The questions about how a title feels, answered from its fingerprint: will it make me laugh, plot or characters,
// can I half-watch it, date night, will it scare me, will I feel good after. Each answer comes with a small visual
// and the traits behind it (the "Why"). titleQuestions.ts puts the questions and answers in the FAQ and its
// structured data; the questions section draws the visuals.

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
}

const label = (k: TraitKey) => getFingerprintMeta(k).label.toLowerCase()
const capitalize = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1)
const scored = (s: Scores, keys: readonly TraitKey[]) =>
	keys.map((key) => ({ key, score: s[key] }))

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
const LAUGH_VERDICT = [
	"No. It plays it straight.",
	"Not really. Humor is rare.",
	"A little.",
	"Yes.",
	"Yes, a lot.",
]

const CHARACTER_KEYS: TraitKey[] = [
	"character_depth",
	"pathos",
	"dialogue_centrality",
]
const PLOT_KEYS: TraitKey[] = ["intrigue", "spectacle", "mystery"]

/** The six answers for a title with a fingerprint, in FAQ order; none without one. */
export function fingerprintAnswers(media: Media): FingerprintAnswer[] {
	const fp = media.fingerprint
	if (!fp) return []
	const T = media.details.title
	const noun = media.mediaType === "movie" ? "movie" : "series"
	const s = fp.scores
	const who = fp.socialSuitability.map((entry) => entry.name)
	const context = fp.viewingContext.map((entry) => entry.name)

	// Laugh: the humor tier, with the two strongest kinds of humor.
	const humor = fp.pillars.Humor
	const humorKeys = byScore(s, HUMOR_TRAITS)
	const kinds = humorKeys
		.filter((k) => s[k] >= 5)
		.slice(0, 2)
		.map((k) => HUMOR_KIND[k] ?? "")
	const laugh: FingerprintAnswer = {
		id: "laugh",
		q: `Will ${T} make me laugh?`,
		a: `${LAUGH_VERDICT[humor]}${kinds.length && humor >= 1 ? ` The humor is mostly ${list(kinds)}.` : ""}`,
		visual: {
			kind: "meter",
			tier: humor,
			area: "Humor",
			word: areaLevelWord("Humor", humor),
		},
		evidence: [{ area: "Humor", traits: scored(s, humorKeys.slice(0, 4)) }],
	}

	// Plot or characters: the weighted character side against the weighted plot side; a gap under 1 is both.
	const character =
		(s.character_depth * 2 + s.pathos + s.dialogue_centrality) / 4
	const plot = (s.intrigue * 2 + s.spectacle + s.mystery) / 4
	const plotLead = byScore(s, PLOT_KEYS).slice(0, 2)
	const characterLead = byScore(s, CHARACTER_KEYS).slice(0, 2)
	const drive: FingerprintAnswer = {
		id: "drive",
		q: `Is ${T} plot-driven or character-driven?`,
		a:
			plot - character >= 1
				? `Mostly plot-driven. ${capitalize(list(plotLead.map(label)))} carry it more than its characters do.`
				: character - plot >= 1
					? `Mostly character-driven. It leans on ${list(characterLead.map(label))} more than on its plot.`
					: "Both, in balance. It gives its characters as much weight as its plot.",
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
	}

	// Half-watch: how demanding the two most demanding traits are (as the Attention scale reads it), softened by the
	// viewing guide.
	const demandKeys = byScore(s, ATTENTION_TRAITS)
	const demand = attentionDemand(s)
	const dropIn = context.some(
		(c) => c === GUIDE.backgroundWatch || c === GUIDE.dropIn,
	)
	const halfWatch: FingerprintAnswer = {
		id: "halfWatch",
		q: `Can I half-watch ${T}?`,
		a:
			demand >= 8
				? `No, it needs your attention.${s.complexity >= 8 ? " The plot is layered, and it's easy to lose the thread." : ""}`
				: demand >= 6
					? dropIn
						? "Mostly, yes. It asks for some focus, but our viewing guide says you can drop in and out."
						: "Better with focus. It asks for some attention to follow."
					: "Yes. It's easy to follow.",
		visual: {
			kind: "slider",
			position: clamp01((demand - 2) / 8),
			left: "Easy watch",
			right: "Demanding",
			area: "Craft",
			label: "Attention",
		},
		evidence: [{ area: "Craft", traits: scored(s, demandKeys) }],
	}

	// Date night rests on the viewing guide's flag alone; the answer says so and adds how much romance there is.
	const romance = s.romance
	const love =
		romance >= 6
			? "Romance is a big part of it."
			: romance >= 3
				? "Romance plays a supporting part."
				: "There's little romance in it."
	const family = who.includes(GUIDE.familyNight) || who.includes(GUIDE.kids)
	const date: FingerprintAnswer = {
		id: "date",
		q: `Is ${T} good for date night?`,
		a: who.includes(GUIDE.dateNight)
			? `${romance >= 3 ? "Yes" : "Probably"}. Our viewing guide lists it for date night. ${love}`
			: family
				? `It's better for a family night. Our viewing guide lists it for ${who.includes(GUIDE.kids) ? "kids and families" : "families"}${who.includes(GUIDE.partnerWatch) ? ", and it also works for couples" : ""}.`
				: who.includes(GUIDE.partnerWatch)
					? `It works for a couple. Our viewing guide lists it for watching with a partner, not for date night. ${love}`
					: `Not really. Our viewing guide doesn't list it for date night${romance >= 6 ? ", despite its romance" : ""}.`,
		visual: {
			kind: "chips",
			items: who,
			highlighted:
				who.includes(GUIDE.dateNight) || !family
					? [GUIDE.dateNight, GUIDE.partnerWatch]
					: [GUIDE.familyNight, GUIDE.kids, GUIDE.partnerWatch],
		},
		evidence: [{ area: "Heart", traits: scored(s, ["romance", "eroticism"]) }],
	}

	// Scare: the scare trait, with a note when tension or gore is what people will feel instead.
	const scareLevel = s.scare
	const scareNote =
		scareLevel < 6 && s.tension >= 8
			? " It's tense rather than scary."
			: s.grotesque >= 7
				? " Some images are gruesome."
				: ""
	const scare: FingerprintAnswer = {
		id: "scare",
		q: `Will ${T} scare me?`,
		a: `${
			scareLevel >= 8
				? "Yes. It's genuinely frightening."
				: scareLevel >= 6
					? "At times. It has some frightening moments."
					: scareLevel >= 4
						? "Barely. The scares are mild."
						: "No."
		}${scareNote}`,
		visual: {
			kind: "slider",
			position: clamp01(scareLevel / 10),
			left: "Not scary",
			right: "Terrifying",
			area: "Energy",
			label: "Scare",
		},
		evidence: [
			{
				area: "Energy",
				traits: scored(
					s,
					byScore(s, ["scare", "tension", "uncanny", "grotesque"]),
				),
			},
		],
	}

	// Feel good: hopeful against bleak.
	const mood = s.hopefulness - s.bleakness
	const feelGood: FingerprintAnswer = {
		id: "feelGood",
		q: `Will I feel good after watching ${T}?`,
		a:
			mood >= 3
				? `Yes. It's an uplifting ${noun} that leaves you hopeful.`
				: mood <= -3
					? `Probably not. Its tone is bleak${s.melancholy >= 7 ? " and sad" : ""}.`
					: "Mixed feelings. It balances dark and hopeful moments.",
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
	}

	return [laugh, drive, halfWatch, date, scare, feelGood]
}

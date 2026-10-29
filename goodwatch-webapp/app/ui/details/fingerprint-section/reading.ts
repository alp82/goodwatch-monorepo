import {
	type EffectReading,
	leading,
	notFor,
	readEffects,
} from "~/domain/fingerprint-effects/effects"
// What the title page's fingerprint section says, as data, read from the title's scores:
//
// - Rows: the five leading effects that count (domain/fingerprint-effects), type size by strength (6.5, where an
//   effect starts to count, is the smallest; 10 the largest), each in the print family color of its lead ingredient
//   (wonder makes awe, so "Leaves you in awe" is Feel's rose); then what the title is not for.
// - Shape: eight fixed axes of feeling, the same for every title so two shapes compare at a glance. They sit round
//   the circle like a map of feelings: stirred up at the top, calm at the bottom, dark on the left, light on the right.
//   An axis is as strong as its strongest member effect, which leads it.
// - Dials: the 11 fingerprint scales plus Originality, each in its print family color, with the sub-scores it reads.
// - Print: the title's 74 sub-scores as the member taste print's attributes, centered on the population's medians.
import { familyOf } from "~/domain/fingerprint-families"
import type { FamilyId } from "~/server/taste-portrait/view"
import {
	type CoreScores,
	PILLAR_ATTRIBUTES,
	VALID_FINGERPRINT_KEYS,
} from "~/server/utils/fingerprint"
import {
	ATTENTION_TRAITS,
	SCALE_GROUPS,
	type Scale,
	readScale,
} from "~/ui/details/fingerprint/scales"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import type * as F from "~/ui/fingerprint/fingerprintText"
import type { WhorlAttribute } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR, FAMILY_ORDER } from "~/ui/profile/taste/model"

export type Key = keyof CoreScores

export { familyOf }

/** An effect's color: the print family of its lead ingredient. */
export const effectColor = (r: EffectReading) =>
	FAMILY_COLOR[familyOf(r.parts[0].members[0].key)]

/** The effect as a chip: two words at most, so three fit a phone's line or two. */
const SHORT: Record<string, string> = {
	awe: "Awe",
	edge: "On edge",
	think: "Big ideas",
	heartbreak: "Heartbreak",
	longing: "Longing",
	laugh: "Laughs",
	smirk: "Smirks",
	pull: "Pull",
	warm: "Warmth",
	lift: "Uplift",
	pulse: "Adrenaline",
	fear: "Scares",
	skin: "Under the skin",
	guess: "Guessing",
	bend: "Mind-bending",
	elsewhere: "Somewhere else",
	real: "Real life",
	mirror: "A mirror",
	schemes: "Power games",
	shaken: "Shaken",
	weighs: "Weight",
	care: "Caring",
	home: "Close to home",
	goosebumps: "Goosebumps",
	eyes: "Eye feast",
	attention: "Close watching",
	patience: "Slow payoff",
	lingers: "Stays with you",
	back: "Nostalgia",
	squirm: "Squirming",
	battle: "Battlefield",
	crime: "Crime",
	fall: "Falling for them",
	charm: "Charm",
	learn: "Learning",
	comfort: "Comfort",
}
export const shortName = (r: EffectReading) =>
	SHORT[r.effect.id] ?? r.effect.name

/** A sub-score's name in running text: "world immersion". */
export const keyLabel = (key: Key) =>
	getFingerprintMeta(key).label.toLowerCase()

// --- Axes -------------------------------------------------------------------------------------------------------

export interface Axis {
	id: string
	/** How you feel, in one or two words. */
	label: string
	/** Effect ids that make the axis; the strongest leads. */
	members: readonly string[]
}

/** Clockwise from the top. Opposites are opposites: Thrilled / Thinking, On edge / Warm, Shaken / Laughing. */
export const AXES: readonly Axis[] = [
	{ id: "thrilled", label: "Thrilled", members: ["pulse", "battle"] },
	{ id: "awe", label: "In awe", members: ["awe", "elsewhere"] },
	{
		id: "laughing",
		label: "Laughing",
		members: ["laugh", "smirk", "charm", "squirm"],
	},
	{ id: "warm", label: "Warm", members: ["warm", "lift", "comfort", "back"] },
	{
		id: "thinking",
		label: "Thinking",
		members: ["think", "guess", "bend", "mirror"],
	},
	{
		id: "moved",
		label: "Moved",
		members: ["heartbreak", "longing", "lingers"],
	},
	{ id: "shaken", label: "Shaken", members: ["shaken", "weighs"] },
	{ id: "edge", label: "On edge", members: ["edge", "fear", "skin"] },
]

const AXIS_OF = new Map(
	AXES.flatMap((a) => a.members.map((m) => [m, a.id] as const)),
)
export const axisOf = (effectId: string) => AXIS_OF.get(effectId) ?? null

export interface AxisView {
	axis: Axis
	index: number
	lead: EffectReading
	strength: number
	counts: boolean
	color: string
}

function readAxes(all: EffectReading[]): AxisView[] {
	const byId = new Map(all.map((r) => [r.effect.id, r]))
	return AXES.map((axis, index) => {
		const lead = axis.members
			.map((id) => byId.get(id) as EffectReading)
			.reduce((a, b) => (b.strength > a.strength ? b : a))
		return {
			axis,
			index,
			lead,
			strength: lead.strength,
			counts: lead.counts,
			color: effectColor(lead),
		}
	})
}

// --- Rows -------------------------------------------------------------------------------------------------------

/** The smallest row sits at 6.5 (an effect counts from there), the largest at 10. */
export const sizeOf = (strength: number) =>
	Math.max(0, Math.min(1, (strength - 6.5) / 3.5))

export interface Phrase {
	r: EffectReading
	color: string
	/** 0 (smallest type) to 1 (largest). */
	k: number
}

/** A row for any effect (the compact row a selected effect outside the five gets). */
export const phraseOf = (r: EffectReading): Phrase => ({
	r,
	color: effectColor(r),
	k: sizeOf(r.strength),
})

// --- Dials ------------------------------------------------------------------------------------------------------

/** How a dial reads its sub-scores, for what it lights on the print. */
export type Source =
	| { kind: "balance"; high: readonly Key[]; low: readonly Key[] }
	| { kind: "max"; keys: readonly Key[] }
	| { kind: "top2"; keys: readonly Key[] }
	| { kind: "area"; keys: readonly Key[] }

/** Each scale's inputs (the ones scales.ts reads) and the family it's drawn in. */
const SOURCES: Record<string, { family: FamilyId; source: Source }> = {
	Energy: {
		family: "feel",
		source: { kind: "area", keys: PILLAR_ATTRIBUTES.Energy },
	},
	Intensity: {
		family: "feel",
		source: { kind: "max", keys: ["violence", "grotesque", "scare"] },
	},
	Heart: {
		family: "feel",
		source: { kind: "area", keys: PILLAR_ATTRIBUTES.Heart },
	},
	Humor: {
		family: "humor",
		source: { kind: "area", keys: PILLAR_ATTRIBUTES.Humor },
	},
	Setting: {
		family: "world",
		source: {
			kind: "balance",
			high: ["fantasy", "futuristic", "surrealism"],
			low: ["contemporary_realism", "historical", "biographical"],
		},
	},
	World: {
		family: "world",
		source: { kind: "area", keys: PILLAR_ATTRIBUTES.World },
	},
	Pace: {
		family: "story",
		source: { kind: "balance", high: ["fast_pace"], low: ["slow_burn"] },
	},
	Tone: {
		family: "story",
		source: { kind: "balance", high: ["hopefulness"], low: ["bleakness"] },
	},
	Attention: {
		family: "story",
		source: { kind: "top2", keys: ATTENTION_TRAITS },
	},
	Style: {
		family: "craft",
		source: { kind: "area", keys: PILLAR_ATTRIBUTES.Style },
	},
	Craft: {
		family: "craft",
		source: { kind: "area", keys: PILLAR_ATTRIBUTES.Craft },
	},
}

export interface ScaleReading {
	sc: Scale
	family: FamilyId
	color: string
	source: Source
	position: number
	word: string
}

/**
 * The twelfth dial, from the novelty score, in the craft family so the strip is symmetric. Among the 3,000 most
 * popular movies novelty 8+ is 11%, 2 or less 10%.
 */
const ORIGINALITY: Scale = {
	name: "Originality",
	area: "Craft",
	left: "Familiar",
	right: "Original",
	words: ["By the book", "Familiar", "A fresh spin", "Fresh", "One of a kind"],
	fromMiddle: false,
	position: (t) =>
		Math.min(1, Math.max(0, (t.fingerprint.scores.novelty - 1) / 9)),
}

/** The 12 dials: the 11 scales in the print's family order (Feel, Humor, World, Story, Craft), then Originality. */
export function scaleReadings(t: F.TitleInput): ScaleReading[] {
	const all = SCALE_GROUPS.flatMap((g) => g.scales).map((sc): ScaleReading => {
		const { family, source } = SOURCES[sc.name]
		const { position, word } = readScale(sc, t)
		return { sc, family, color: FAMILY_COLOR[family], source, position, word }
	})
	const ordered = FAMILY_ORDER.flatMap((family) =>
		all.filter((s) => s.family === family),
	)
	const { position, word } = readScale(ORIGINALITY, t)
	return [
		...ordered,
		{
			sc: ORIGINALITY,
			family: "craft",
			color: FAMILY_COLOR.craft,
			source: { kind: "max", keys: ["novelty"] },
			position,
			word,
		},
	]
}

// --- The title --------------------------------------------------------------------------------------------------

export interface Reading {
	all: EffectReading[]
	rows: Phrase[]
	/** What the title is not for: effects a viewer might expect, under 2.5. */
	not: string[]
	axes: AxisView[]
	/** The 2-3 strongest axes that count: labeled in white. */
	bold: Set<string>
	scales: ScaleReading[]
}

export function readTitle(t: F.TitleInput): Reading {
	const all = readEffects(t.fingerprint.scores)
	const counted = all.filter((r) => r.counts)
	const { lead } = leading(counted.length ? counted : all.slice(0, 3), 5)
	const axes = readAxes(all)
	const ranked = [...axes].sort((a, b) => b.strength - a.strength)
	const counting = ranked.filter((a) => a.counts)
	const bold = new Set(
		(counting.length >= 2 ? counting.slice(0, 3) : ranked.slice(0, 2)).map(
			(a) => a.axis.id,
		),
	)
	return {
		all,
		rows: lead.map(phraseOf),
		not: notFor(all),
		axes,
		bold,
		scales: scaleReadings(t),
	}
}

/**
 * The title's print in the member print's terms: an attribute's edge is how far the title's score sits above the
 * population median, curved so standouts swell (d^1.5); below the median it pulls in a third as much.
 */
export function printAttributes(
	s: CoreScores,
	median: Record<Key, number>,
): WhorlAttribute[] {
	return VALID_FINGERPRINT_KEYS.map((key) => {
		const m = Math.max(1, Math.min(9, median[key] ?? 5))
		const v = s[key] ?? 0
		const d = v >= m ? (v - m) / (10 - m) : (v - m) / m
		return {
			key,
			label: getFingerprintMeta(key).label,
			family: familyOf(key),
			edge: d >= 0 ? d ** 1.5 : d / 3,
		}
	})
}

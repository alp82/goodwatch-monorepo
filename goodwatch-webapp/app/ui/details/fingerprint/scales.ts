// Two-ended readings of a fingerprint, each with a word: pace, energy, intensity, tone, heart, humor, attention,
// setting, world, style, and craft, grouped as Feel, Story, and Look.

import type * as F from "~/ui/fingerprint/fingerprintText"
import type { Area, TraitKey } from "./areas"

export interface Scale {
	name: string
	/** The area the scale belongs to: selecting the scale selects it. */
	area: Area
	left: string
	right: string
	/** Five words from the left end to the right end. */
	words: readonly [string, string, string, string, string]
	/** True for a scale with a real opposite at each end: it fills from the middle, the rest from the left. */
	fromMiddle: boolean
	/** Where the title sits, from 0 (left) to 1 (right). */
	position: (t: F.TitleInput) => number
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const meanOfTopTwo = (xs: number[]) => {
	const sorted = [...xs].sort((x, y) => y - x)
	return (sorted[0] + (sorted[1] ?? 0)) / 2
}
const scores = (t: F.TitleInput) => t.fingerprint.scores

// Opposites as a difference of up to 8 either side of the middle.
const balance = (high: number, low: number) => clamp((high - low) / 16 + 0.5)

const PACE: Scale = {
	name: "Pace",
	area: "Energy",
	left: "Slow burn",
	right: "Fast",
	words: ["Very slow", "Slow burn", "Steady", "Fast", "Breakneck"],
	fromMiddle: true,
	position: (t) => balance(scores(t).fast_pace, scores(t).slow_burn),
}

const TONE: Scale = {
	name: "Tone",
	area: "Heart",
	left: "Bleak",
	right: "Hopeful",
	words: ["Bleak", "Mostly dark", "Mixed", "Mostly hopeful", "Uplifting"],
	fromMiddle: true,
	position: (t) => balance(scores(t).hopefulness, scores(t).bleakness),
}

const SETTING: Scale = {
	name: "Setting",
	area: "World",
	left: "Everyday",
	right: "Otherworldly",
	words: [
		"Real world",
		"Grounded",
		"Heightened",
		"Otherworldly",
		"Fantastical",
	],
	fromMiddle: true,
	position: (t) => {
		const s = scores(t)
		return balance(
			Math.max(s.fantasy, s.futuristic, s.surrealism),
			Math.max(s.contemporary_realism, s.historical, s.biographical),
		)
	},
}

const ATTENTION: Scale = {
	name: "Attention",
	area: "Craft",
	left: "Easy watch",
	right: "Demanding",
	words: [
		"Easy watch",
		"Easy to follow",
		"Some focus",
		"Demanding",
		"Very demanding",
	],
	fromMiddle: false,
	// The two most demanding traits; 2 or less reads as an easy watch, 10 as very demanding.
	position: (t) => {
		const s = scores(t)
		return clamp(
			(meanOfTopTwo([
				s.complexity,
				s.philosophical,
				s.non_linear_narrative,
				s.ambiguity,
				s.meta_narrative,
			]) -
				2) /
				8,
		)
	},
}

const INTENSITY_KEYS: TraitKey[] = ["violence", "grotesque", "scare"]

const INTENSITY: Scale = {
	name: "Intensity",
	area: "Energy",
	left: "Gentle",
	right: "Brutal",
	words: ["Gentle", "Mild", "Some edge", "Intense", "Brutal"],
	fromMiddle: false,
	// The strongest of violence, gore, and scares; 1 or less reads as gentle, 10 as brutal.
	position: (t) =>
		clamp((Math.max(...INTENSITY_KEYS.map((k) => scores(t)[k])) - 1) / 9),
}

// An area as a scale. The position follows the area's tier (0 to 4 to the five fifths), so the word always
// matches the tier shown elsewhere on the page.
const areaScale = (
	area: Area,
	left: string,
	right: string,
	words: Scale["words"],
): Scale => ({
	name: area,
	area,
	left,
	right,
	words,
	fromMiddle: false,
	position: (t) => (t.fingerprint.pillars[area] + 0.5) / 5,
})

const ENERGY = areaScale("Energy", "Calm", "Relentless", [
	"Calm",
	"Low-key",
	"Steady",
	"High energy",
	"Relentless",
])
const HEART = areaScale("Heart", "Cool", "Deeply emotional", [
	"Cool",
	"Light",
	"Some heart",
	"Big heart",
	"Deeply emotional",
])
const HUMOR = areaScale("Humor", "Serious", "Very funny", [
	"Serious",
	"A touch",
	"Light",
	"Funny",
	"Very funny",
])
const WORLD = areaScale("World", "Background", "Immersive", [
	"Background",
	"Simple",
	"Solid",
	"Immersive",
	"Fully immersive",
])
const CRAFT = areaScale("Craft", "Plain", "Masterful", [
	"Rough",
	"Plain",
	"Solid",
	"Strong",
	"Masterful",
])
const STYLE = areaScale("Style", "Plain", "Stunning", [
	"Plain",
	"Modest",
	"Clean",
	"Striking",
	"Stunning",
])

export interface ScaleGroup {
	name: "Feel" | "Story" | "Look"
	scales: Scale[]
}

export const SCALE_GROUPS: readonly ScaleGroup[] = [
	{ name: "Feel", scales: [PACE, ENERGY, INTENSITY, TONE, HEART, HUMOR] },
	{ name: "Story", scales: [ATTENTION, SETTING, WORLD] },
	{ name: "Look", scales: [STYLE, CRAFT] },
]

const ALL_SCALES = SCALE_GROUPS.flatMap((g) => g.scales)

/** The scales that belong to an area, in group order. */
export const scalesOf = (area: Area) =>
	ALL_SCALES.filter((sc) => sc.area === area)

/** Where the title sits on a scale and the word for that spot (one word per fifth). */
export function readScale(sc: Scale, t: F.TitleInput) {
	const position = sc.position(t)
	const fifth = [0.2, 0.4, 0.6, 0.8].filter((edge) => position >= edge).length
	return { position, word: sc.words[fifth] }
}

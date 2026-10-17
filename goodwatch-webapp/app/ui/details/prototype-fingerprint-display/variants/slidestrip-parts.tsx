// PROTOTYPE - throwaway.
// Shared bits for the slidestrip, slidegrid, allsliders and compact variants: two-ended scales, tracks, intensity words.
import { HEX, type Pillar } from "~/ui/details/DetailsFingerprint"
import type * as F from "~/ui/fingerprint/fingerprintText"
import { PILLAR_KEYS } from "~/ui/fingerprint/fingerprintText"

export type Scores = F.TitleInput["fingerprint"]["scores"]
export type Key = keyof Scores

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const top2 = (xs: number[]) => {
	const b = [...xs].sort((x, y) => y - x)
	return (b[0] + (b[1] ?? 0)) / 2
}

export interface Scale {
	name: string
	area: Pillar
	left: string
	right: string
	// Five words from the left pole to the right pole.
	words: [string, string, string, string, string]
	value: (t: F.TitleInput) => number
	// The traits the reading comes from, shown one tap away.
	keys: (t: F.TitleInput) => Key[]
}

const fixed = (keys: Key[]) => () => keys

// Copied from Sliders.tsx (round 1): true opposites, difference / 16 centred, except Attention.
export const SCALES: Scale[] = [
	{
		name: "Pace",
		area: "Energy",
		left: "Slow burn",
		right: "Fast",
		words: ["Very slow", "Slow burn", "Steady", "Fast", "Breakneck"],
		value: ({ fingerprint: { scores: s } }) => clamp((s.fast_pace - s.slow_burn) / 16 + 0.5),
		keys: fixed(["fast_pace", "slow_burn"]),
	},
	{
		name: "Tone",
		area: "Heart",
		left: "Bleak",
		right: "Hopeful",
		words: ["Bleak", "Mostly dark", "Mixed", "Mostly hopeful", "Uplifting"],
		value: ({ fingerprint: { scores: s } }) => clamp((s.hopefulness - s.bleakness) / 16 + 0.5),
		keys: fixed(["hopefulness", "bleakness"]),
	},
	{
		name: "Setting",
		area: "World",
		left: "Everyday",
		right: "Otherworldly",
		words: ["Real world", "Grounded", "Heightened", "Otherworldly", "Fantastical"],
		value: ({ fingerprint: { scores: s } }) =>
			clamp(
				(Math.max(s.fantasy, s.futuristic, s.surrealism) -
					Math.max(s.contemporary_realism, s.historical, s.biographical)) /
					16 +
					0.5,
			),
		keys: fixed(["fantasy", "futuristic", "surrealism", "contemporary_realism", "historical", "biographical"]),
	},
	{
		name: "Attention",
		area: "Craft",
		left: "Easy watch",
		right: "Demanding",
		words: ["Easy watch", "Easy to follow", "Some focus", "Demanding", "Very demanding"],
		value: ({ fingerprint: { scores: s } }) =>
			clamp((top2([s.complexity, s.philosophical, s.non_linear_narrative, s.ambiguity, s.meta_narrative]) - 2) / 8),
		keys: fixed(["complexity", "philosophical", "non_linear_narrative", "ambiguity", "meta_narrative"]),
	},
]

// Areas as scales. The position follows the area's tier (0-4 to the five fifths), so the word
// always matches the meter shown elsewhere on the page.
const areaScale = (area: Pillar, name: string, left: string, right: string, words: Scale["words"]): Scale => ({
	name,
	area,
	left,
	right,
	words,
	value: (t) => (t.fingerprint.pillars[area] + 0.5) / 5,
	keys: () => [...PILLAR_KEYS[area]],
})

export const AREA_SCALES: Record<Pillar, Scale> = {
	Energy: areaScale("Energy", "Energy", "Calm", "Relentless", ["Calm", "Low-key", "Steady", "High energy", "Relentless"]),
	Heart: areaScale("Heart", "Heart", "Cool", "Deeply emotional", ["Cool", "Light", "Some heart", "Big heart", "Deeply emotional"]),
	Humor: areaScale("Humor", "Humor", "Serious", "Very funny", ["Serious", "A touch", "Light", "Funny", "Very funny"]),
	World: areaScale("World", "World", "Background", "Immersive", ["Background", "Simple", "Solid", "Immersive", "Fully immersive"]),
	Craft: areaScale("Craft", "Craft", "Plain", "Masterful", ["Rough", "Plain", "Solid", "Strong", "Masterful"]),
	Style: areaScale("Style", "Style", "Plain", "Stunning", ["Plain", "Modest", "Clean", "Striking", "Stunning"]),
}

const INTENSITY_KEYS: Key[] = ["violence", "grotesque", "scare"]
export const INTENSITY_SCALE: Scale = {
	name: "Intensity",
	area: "Energy",
	left: "Gentle",
	right: "Brutal",
	words: ["Gentle", "Mild", "Some edge", "Intense", "Brutal"],
	// The strongest of violence, gore and scares; 1 or less reads as gentle, 10 as brutal.
	value: ({ fingerprint: { scores: s } }) => clamp((Math.max(...INTENSITY_KEYS.map((k) => s[k])) - 1) / 9),
	keys: fixed(INTENSITY_KEYS),
}

export const wordAt = (sc: Scale, v: number) => sc.words[v < 0.2 ? 0 : v < 0.4 ? 1 : v < 0.6 ? 2 : v < 0.8 ? 3 : 4]
export const nearEnd = (v: number) => (v < 0.4 ? "left" : v >= 0.6 ? "right" : null)

export function reading(sc: Scale, t: F.TitleInput) {
	const v = sc.value(t)
	return { v, word: wordAt(sc, v), near: nearEnd(v) }
}

// Traits behind a scale, strongest first, with their 0-10 scores.
export function scaleTraits(sc: Scale, t: F.TitleInput, n = 6) {
	const s = t.fingerprint.scores
	return sc
		.keys(t)
		.map((key) => ({ key, score: s[key] }))
		.sort((a, b) => b.score - a.score)
		.slice(0, n)
}

// The track with its dot. "pill" matches round 1's Sliders; "dot" is the thin one-line version.
export function Track({
	v,
	area,
	label,
	size = "pill",
	className = "",
}: {
	v: number
	area: Pillar
	label: string
	size?: "pill" | "dot"
	className?: string
}) {
	const pill = size === "pill"
	const half = pill ? 16 : 6
	return (
		<span
			role="img"
			aria-label={label}
			className={`relative block rounded-full bg-white/8 ${pill ? "h-2.5" : "h-1"} ${className}`}
		>
			<span className="absolute inset-y-0 left-1/2 w-px bg-white/15" aria-hidden="true" />
			<span
				className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-black/40 ${pill ? "h-3 w-8" : "h-2.5 w-2.5"}`}
				style={{ left: `calc(${half}px + ${v} * (100% - ${half * 2}px))`, background: HEX[area] }}
				aria-hidden="true"
			/>
		</span>
	)
}

// Content intensity in parents guide words (copied from Grid.tsx). Only categories at "mild" or above.
const INTENSITY: { key: Key; label: string }[] = [
	{ key: "violence", label: "Violence" },
	{ key: "grotesque", label: "Gore" },
	{ key: "scare", label: "Scares" },
	{ key: "eroticism", label: "Sex" },
]
const level = (n: number) => (n >= 9 ? "severe" : n >= 7 ? "strong" : n >= 5 ? "moderate" : n >= 3 ? "mild" : null)

export function intensity(t: F.TitleInput) {
	const s = t.fingerprint.scores
	return INTENSITY.map((x) => ({ ...x, word: level(s[x.key]) })).filter((x): x is typeof x & { word: string } => !!x.word)
}

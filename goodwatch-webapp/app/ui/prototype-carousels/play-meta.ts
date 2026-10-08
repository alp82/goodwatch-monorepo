// PROTOTYPE for "Prototype native-scroll carousels on title pages", seventh round. Throwaway code: not for production.
//
// What the play engine (play-engine.ts) knows about the fingerprint: the names, emoji, and colors the title page's
// fingerprint section uses, the nouns of the earlier rounds' reasons, and the axes of the dive model with their
// truth thresholds. It is handed to the engine as plain data, because the engine runs as an inline script.
import { PILLAR_ATTRIBUTES } from "~/server/utils/fingerprint"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import {
	ALL_AXES,
	type Axis,
	MIN_NEAR,
	MIN_STEP,
} from "~/ui/prototype-carousels/dive-model"
import { SHARED } from "~/ui/prototype-carousels/explore-model"

export const PLAY_VARIANTS = [
	"play1",
	"play2",
	"play3",
	"play4",
	"play5",
	"play6",
	"play7",
	"play8",
	"play9",
	"play10",
] as const
export type PlayVariant = (typeof PLAY_VARIANTS)[number]
export const isPlayVariant = (value: unknown): value is PlayVariant =>
	PLAY_VARIANTS.includes(value as PlayVariant)

/** The colors of the fingerprint section's six groups (DetailsFingerprint.tsx). */
const PILLAR_HEX: Record<string, string> = {
	Energy: "#f59e0b",
	Heart: "#f43f5e",
	Humor: "#14b8a6",
	World: "#10b981",
	Craft: "#8b5cf6",
	Style: "#0ea5e9",
}

// Attributes that are an end of a fixed axis already, or say nothing as "more" and "less" (ring-model.ts), and the
// craft scores, which say how well a title is made and not what it is like.
const NOT_A_TRAIT = [
	"nostalgia",
	"pop_culture",
	"gaming",
	"contemporary_realism",
	"visual_stylization",
	"non_linear_narrative",
	"character_depth",
	"music_centrality",
	"educational",
]

// One emoji per axis end, from the attribute that carries it.
const AXIS_EMOJI: Record<string, [string, string]> = {
	tone: ["🌤️", "🌫️"],
	pace: ["🕯️", "🏎️"],
	humor: ["🎭", "😂"],
	strange: ["🏙️", "🌀"],
	ideas: ["🎈", "🧠"],
	scale: ["💬", "🎆"],
}

export interface PlayTrait {
	/** Emoji, label ("Tech & Humanity"), noun inside a sentence ("technology theme"), color. */
	e: string
	l: string
	n: string
	c: string
	/** Whether the forms offer it as a trait of a title. */
	on: boolean
}

export interface PlayMeta {
	/** The order of the scores in a pack's score string. */
	keys: string[]
	traits: Record<string, PlayTrait>
	axes: (Axis & { emoji: [string, string] })[]
	minStep: number
	minNear: number
	image: string
}

const solid = (rgba: string) =>
	rgba.replace(/rgba\(([^)]+),\s*[\d.]+\)/, "rgb($1)").replace(/\s+/g, "")

export function playMeta(): PlayMeta {
	const pillarOf = new Map<string, string>()
	for (const [pillar, keys] of Object.entries(PILLAR_ATTRIBUTES))
		for (const key of keys) pillarOf.set(key, pillar)
	const traits: Record<string, PlayTrait> = {}
	for (const key of VALID_FINGERPRINT_KEYS) {
		const meta = FINGERPRINT_META[key]
		const pillar = pillarOf.get(key)
		traits[key] = {
			e: meta?.emoji ?? "🏷️",
			l: meta?.label ?? key,
			n: SHARED[key] ?? (meta?.label ?? key).toLowerCase(),
			c: pillar ? PILLAR_HEX[pillar] : solid(meta?.color ?? "rgb(158,158,158)"),
			on: Boolean(SHARED[key]) && !NOT_A_TRAIT.includes(key),
		}
	}
	return {
		keys: [...VALID_FINGERPRINT_KEYS],
		traits,
		axes: ALL_AXES.map((axis) => ({
			...axis,
			emoji: AXIS_EMOJI[axis.id] ?? ["", ""],
		})),
		minStep: MIN_STEP,
		minNear: MIN_NEAR,
		image: "https://image.tmdb.org/t/p",
	}
}

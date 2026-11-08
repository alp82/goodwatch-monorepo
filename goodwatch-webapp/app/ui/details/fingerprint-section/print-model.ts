// The fingerprint's data as the title page's section and the fingerprint sub-page read it, from the title:
// - the drawing's eight sections (one feeling each, a 45-degree sector round its axis): size, what feeds it, and the
//   same reading for a typical title (one that scores the population median on every sub-score);
// - where a feeling ranks among popular titles, in words (the ranks come from ranks.server.ts).
import {
	type EffectReading,
	readEffects,
	strengthWord,
} from "~/domain/fingerprint-effects/effects"
import { POPULATION_MEDIANS } from "~/domain/fingerprint-effects/population-medians"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { CoreScores } from "~/server/utils/fingerprint"
import {
	type AxisView,
	type Reading,
	effectColor,
} from "~/ui/details/fingerprint-section/reading"

export type Media = MovieResult | ShowResult

export const noun = (type: "movie" | "show") =>
	type === "movie" ? "movie" : "show"

// --- Sections of the drawing ------------------------------------------------------------------------------------

/** What each section measures, in one line. */
export const SECTION_MEANING: Record<string, string> = {
	thrilled: "Speed, action and battles: how hard it gets your pulse up.",
	awe: "Wonder on a big canvas, or a world far from yours.",
	laughing: "Every kind of funny: out loud, dry, charming, cringe.",
	warm: "Kindness, hope and comfort: how good it is to be in.",
	thinking: "Big ideas, puzzles and twists to work out.",
	moved: "Sadness, longing, and feelings that stay after.",
	shaken: "Violence with weight, darkness that sits heavy.",
	edge: "Tension, fear, and unease that gets under your skin.",
}

/**
 * Where a title's feelings rank among the popular titles the server keeps (ranks.server.ts): for an effect id, or
 * `ax:<axis id>` for a section, the share (0-1) of the `of` titles strictly below and strictly above it.
 */
export interface FpRanks {
	of: number
	ranks: Record<string, [number, number]>
}

/** The key a section's rank is kept under. */
export const sectionRankKey = (axisId: string) => `ax:${axisId}`

export interface SectionView {
	view: AxisView
	id: string
	label: string
	color: string
	strength: number
	word: string
	/** The same section for a typical title. */
	typical: number
	/** The section's effects, strongest first; the first leads and sets the size. */
	members: { r: EffectReading; color: string }[]
}

const typicalCache = new Map<string, Map<string, number>>()
function typicalStrengths(type: "movie" | "show") {
	let m = typicalCache.get(type)
	if (!m) {
		m = new Map(
			readEffects(POPULATION_MEDIANS[type] as CoreScores).map((r) => [
				r.effect.id,
				r.strength,
			]),
		)
		typicalCache.set(type, m)
	}
	return m
}

export function readSections(
	reading: Reading,
	type: "movie" | "show",
): SectionView[] {
	const typical = typicalStrengths(type)
	const byId = new Map(reading.all.map((r) => [r.effect.id, r]))
	return reading.axes.map((view) => ({
		view,
		id: view.axis.id,
		label: view.axis.label,
		color: view.color,
		strength: view.strength,
		word: strengthWord(view.lead),
		typical: Math.max(...view.axis.members.map((id) => typical.get(id) ?? 0)),
		members: view.axis.members
			.map((id) => byId.get(id))
			.filter((r): r is EffectReading => !!r)
			.sort((a, b) => b.strength - a.strength)
			.map((r) => ({ r, color: effectColor(r) })),
	}))
}

// --- Words ------------------------------------------------------------------------------------------------------

export { notForLine } from "~/domain/fingerprint-effects/title-reading"

/**
 * Where a feeling ranks among popular titles, from the shares below and above it: "Stronger than 9 in 10 popular
 * movies", "Weaker than 7 in 10 popular shows", "About the middle of popular movies"; null without a rank.
 */
export function rankLine(
	rank: readonly [number, number] | undefined,
	type: "movie" | "show",
): string | null {
	if (!rank) return null
	const [below, above] = rank
	const pop = `popular ${noun(type)}s`
	const say = (word: string, share: number) =>
		share >= 0.95
			? `${word} than ${Math.min(99, Math.floor(share * 100))} in 100 ${pop}`
			: `${word} than ${Math.floor(share * 10)} in 10 ${pop}`
	if (below >= 0.6) return say("Stronger", below)
	if (above >= 0.6) return say("Weaker", above)
	return `About the middle of ${pop}`
}

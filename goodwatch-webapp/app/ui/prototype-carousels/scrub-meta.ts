// PROTOTYPE for "Prototype native-scroll carousels on title pages", eighth round. Throwaway code: not for production.
//
// What the scrub forms (scrub1 to scrub10) know beyond the play engine's vocabulary: the five fingerprint families
// with their attributes, the single traits the plain forms offer, and the pairs of traits that the seventh round's
// scrub strip treated as opposite ends of one line. Handed to the forms as plain data, because they run as an
// inline script.
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"

export const SCRUB_NAMES: Record<string, string> = {
	scrub1: "S1 Honest ruler",
	scrub2: "S2 Only clear claims",
	scrub3: "S3 Of these, in general",
	scrub4: "S4 Two at once",
	scrub5: "S5 Its own fingerprint",
	scrub6: "S6 What varies here",
	scrub7: "S7 Both of two",
	scrub8: "S8 Hold and scrub",
	scrub9: "S9 Recipe",
	scrub10: "S10 Three lanes",
}

export interface ScrubExtra {
	/** The five fingerprint families, in the fingerprint's own order, with all 74 attributes. */
	groups: { n: string; e: string; k: string[] }[]
	/** The single traits the plain forms offer. */
	fix: string[]
	/** Two traits that can both be true of a title. The first three are ends of the seventh round's axes. */
	pairs: string[][]
}

// The families are the fingerprint's own groups (server/taste-portrait/families.server.ts), by where each starts.
const FAMILIES: [string, string, string][] = [
	["Feel", "💓", "adrenaline"],
	["Humor", "😄", "situational_comedy"],
	["World", "🌍", "fantasy"],
	["Story", "📖", "narrative_structure"],
	["Craft", "🎬", "direction"],
]

export function scrubExtra(): ScrubExtra {
	const keys = [...VALID_FINGERPRINT_KEYS] as string[]
	const starts = FAMILIES.map(([, , first]) => keys.indexOf(first))
	return {
		groups: FAMILIES.map(([n, e], i) => ({
			n,
			e,
			k: keys.slice(starts[i], starts[i + 1] ?? keys.length),
		})),
		fix: [
			"spectacle",
			"dialogue_centrality",
			"world_immersion",
			"bleakness",
			"hopefulness",
			"fast_pace",
			"slow_burn",
			"tension",
			"complexity",
			"surrealism",
			"wit_wordplay",
			"dark_humor",
		],
		pairs: [
			["spectacle", "dialogue_centrality"],
			["bleakness", "hopefulness"],
			["fast_pace", "slow_burn"],
			["tension", "wit_wordplay"],
			["dark_humor", "pathos"],
			["wonder", "melancholy"],
		],
	}
}

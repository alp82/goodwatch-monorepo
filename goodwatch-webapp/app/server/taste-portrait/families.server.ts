// The five fingerprint families: the fingerprint's own groups in CoreScores, listed by key so a reordering of the
// fingerprint can't move an attribute into another family. The feeling family is named Feel, not Mood, so it
// doesn't collide with the Moods of Watch next (owner, #193).
import type { FingerprintKey } from "~/server/taste/index.server"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { Family, FamilyId } from "./view"

const FAMILY_KEYS: Record<FamilyId, readonly FingerprintKey[]> = {
	feel: [
		"adrenaline",
		"tension",
		"scare",
		"violence",
		"romance",
		"eroticism",
		"wholesome",
		"wonder",
		"pathos",
		"melancholy",
		"uncanny",
		"catharsis",
		"nostalgia",
	],
	humor: [
		"situational_comedy",
		"wit_wordplay",
		"physical_comedy",
		"cringe_humor",
		"absurdist_humor",
		"satire_parody",
		"dark_humor",
	],
	world: [
		"fantasy",
		"futuristic",
		"historical",
		"contemporary_realism",
		"crime",
		"mystery",
		"warfare",
		"political",
		"sports",
		"biographical",
		"coming_of_age",
		"family_dynamics",
		"psychological",
		"showbiz",
		"gaming",
		"pop_culture",
		"social_commentary",
		"class_and_capitalism",
		"technology_and_humanity",
		"spiritual",
	],
	story: [
		"narrative_structure",
		"dialogue_quality",
		"character_depth",
		"slow_burn",
		"fast_pace",
		"intrigue",
		"complexity",
		"rewatchability",
		"hopefulness",
		"bleakness",
		"ambiguity",
		"novelty",
		"homage_and_reference",
		"non_linear_narrative",
		"meta_narrative",
		"surrealism",
		"eccentricity",
		"philosophical",
		"educational",
	],
	craft: [
		"direction",
		"acting",
		"cinematography",
		"editing",
		"music_composition",
		"world_immersion",
		"spectacle",
		"visual_stylization",
		"pastiche",
		"psychedelic",
		"grotesque",
		"camp_and_irony",
		"dialogue_centrality",
		"music_centrality",
		"sound_centrality",
	],
}

const NAMES: Record<FamilyId, { name: string; line: string }> = {
	feel: { name: "Feel", line: "How it makes you feel" },
	humor: { name: "Humor", line: "What makes you laugh" },
	world: { name: "World", line: "What it's about" },
	story: { name: "Story", line: "How it's told" },
	craft: { name: "Craft", line: "How it looks and sounds" },
}

const ORDER: FamilyId[] = ["feel", "humor", "world", "story", "craft"]

/** The families, each with its keys in fingerprint order. */
export const FAMILIES: Family[] = ORDER.map((id) => ({
	id,
	...NAMES[id],
	keys: VALID_FINGERPRINT_KEYS.filter((key) => FAMILY_KEYS[id].includes(key)),
}))

const familyByKey = new Map<string, FamilyId>(
	ORDER.flatMap((id) => FAMILY_KEYS[id].map((key) => [key, id] as const)),
)

// Every fingerprint key belongs to exactly one family.
const unplaced = VALID_FINGERPRINT_KEYS.filter((key) => !familyByKey.has(key))
if (unplaced.length || familyByKey.size !== VALID_FINGERPRINT_KEYS.length)
	throw new Error(
		`Fingerprint families don't cover the fingerprint: ${unplaced.join(", ")}`,
	)

export const familyOf = (key: string): FamilyId =>
	familyByKey.get(key) as FamilyId

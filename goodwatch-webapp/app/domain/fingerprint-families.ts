// The five fingerprint families: the fingerprint's own groups in CoreScores, listed by key so a reordering of the
// fingerprint can't move an attribute into another family. The feeling family is named Feel, not Mood, so it
// doesn't collide with the Moods of Watch next (owner, #193). Shared by the server's taste portrait and the title
// page's fingerprint drawing.
import type { FamilyId } from "~/server/taste-portrait/view"
import type { CoreScores } from "~/server/utils/fingerprint"

export const FAMILY_KEYS: Record<FamilyId, readonly (keyof CoreScores)[]> = {
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

const familyByKey = new Map<string, FamilyId>(
	(Object.keys(FAMILY_KEYS) as FamilyId[]).flatMap((id) =>
		FAMILY_KEYS[id].map((key) => [key, id] as const),
	),
)

/** The family a fingerprint key belongs to. */
export const familyOf = (key: string): FamilyId =>
	familyByKey.get(key) as FamilyId

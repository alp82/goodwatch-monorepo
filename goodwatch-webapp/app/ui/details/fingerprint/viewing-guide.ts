// The viewing guide's audiences and occasions that the fingerprint section and the FAQ answers look for, by the
// names the guide gives them (see SOCIAL_SUITABILITY_REGISTRY and VIEWING_CONTEXT_REGISTRY in
// server/utils/fingerprint.ts).

export const GUIDE = {
	dateNight: "Date Night",
	partnerWatch: "Partner Watch",
	familyNight: "Family Movie Night",
	kids: "Kids",
	backgroundWatch: "Background Watch",
	dropIn: "Drop-in Friendly",
} as const

/** Generic audiences that say little about a title, so "Good for" lists them last. */
export const LOW_INFO_GUIDE: readonly string[] = [
	"Adults",
	"Public Viewing Safe",
	"Solo Watch",
	"Intergenerational",
	GUIDE.partnerWatch,
]

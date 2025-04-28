import type { DNAItem } from "~/server/details.server"

export const sortedDNACategories = [
	"Sub-Genres",
	"Mood",
	"Themes",
	"Plot",
	"Cultural Impact",
	"Character Types",
	"Dialog",
	"Narrative",
	"Humor",
	"Pacing",
	"Time",
	"Place",
	"Cinematic Style",
	"Score and Sound",
	"Costume and Set",
	"Key Props",
	"Target Audience",
	"Flag",
] as const

export type DNACategoryName = (typeof sortedDNACategories)[number]

const emptyValues = ["None", "N/A", "", null, undefined]

export const spoilerCategories = ["Plot"]

export const getDNAForCategory = (
	dna: DNAItem[],
	category: DNACategoryName,
) => {
	return (dna || []).filter((dnaItem) => dnaItem.category === category)
}

export const getSortedCategories = (dna: DNAItem[], withSpoilers = true) => {
	return sortedDNACategories.filter((category) => {
		const dnaForCategory = getDNAForCategory(dna, category)
		return (
			Array.isArray(dnaForCategory) &&
			dnaForCategory.length &&
			!emptyValues.includes(dnaForCategory[0].label) &&
			(withSpoilers || !spoilerCategories.includes(category))
		)
	})
}

export const getCategoryColor = (category: string) => {
	switch (category) {
		case "Character Types":
			return "bg-fuchsia-900"
		case "Cinematic Style":
			return "bg-violet-900"
		case "Costume and Set":
			return "bg-teal-900"
		case "Cultural Impact":
			return "bg-green-900"
		case "Dialog":
			return "bg-stone-900"
		case "Flag":
			return "bg-red-900"
		case "Humor":
			return "bg-yellow-900"
		case "Key Props":
			return "bg-zinc-900"
		case "Mood":
			return "bg-cyan-900"
		case "Narrative":
			return "bg-indigo-900"
		case "Pacing":
			return "bg-purple-900"
		case "Place":
			return "bg-emerald-900"
		case "Plot":
			return "bg-blue-900"
		case "Score and Sound":
			return "bg-lime-900"
		case "Sub-Genres":
			return "bg-stone-900"
		case "Target Audience":
			return "bg-pink-900"
		case "Themes":
			return "bg-amber-900"
		case "Time":
			return "bg-orange-900"
		default:
			return "text-gray-500"
	}
}

export const mapCategoryToVectorName = (category: string) => {
	switch (category) {
		case "Character Types":
			return "character_types"
		case "Cinematic Style":
			return "cinematic_style"
		case "Costume and Set":
			return "costume_and_set"
		case "Cultural Impact":
			return "cultural_impact"
		case "Dialog":
			return "dialog"
		case "Flag":
			return "flag"
		case "Humor":
			return "humor"
		case "Key Props":
			return "key_props"
		case "Mood":
			return "mood"
		case "Narrative":
			return "narrative"
		case "Pacing":
			return "pacing"
		case "Place":
			return "place"
		case "Plot":
			return "plot"
		case "Score and Sound":
			return "score_and_sound"
		case "Sub-Genres":
			return "subgenres"
		case "Target Audience":
			return "target_audience"
		case "Themes":
			return "themes"
		case "Time":
			return "time"
		default:
			return category
	}
}

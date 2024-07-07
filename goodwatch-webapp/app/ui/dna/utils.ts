import type { DNA } from "~/server/details.server"

const sortedDNACategories = [
	"Sub-Genres",
	"Mood/Attitudes",
	"Memorable Moments",
	"Plot",
	"Target Audience",
	"Place",
	"Time/Period",
	"Pacing",
	"Narrative Structure",
	"Dialog Style",
	"Score and Sound Design",
	"Character Archetypes",
	"Visual Style",
	"Cinematic Techniques",
	"Costume and Set Design",
	"Key Objects/Props",
	"Flag",
]

const emptyValues = ["None", "N/A", "", null, undefined]

export const spoilerCategories = ["Plot", "Memorable Moments"]

export const getSortedCategories = (dna: DNA, withSpoilers = true) => {
	return sortedDNACategories.filter(
		(category) =>
			Array.isArray(dna[category]) &&
			dna[category].length &&
			!emptyValues.includes(dna[category][0]) &&
			(withSpoilers || !spoilerCategories.includes(category)),
	)
}

export const getCategoryColor = (category: string) => {
	switch (category) {
		case "Cinematic Techniques":
			return "bg-violet-700"
		case "Character Archetypes":
			return "bg-fuchsia-700"
		case "Costume and Set Design":
			return "bg-teal-700"
		case "Dialog Style":
			return "bg-stone-700"
		case "Flag":
			return "bg-red-700"
		case "Key Objects/Props":
			return "bg-zinc-700"
		case "Memorable Moments":
			return "bg-green-700"
		case "Mood/Attitudes":
			return "bg-cyan-700"
		case "Narrative Structure":
			return "bg-indigo-700"
		case "Pacing":
			return "bg-purple-700"
		case "Plot":
			return "bg-blue-700"
		case "Place":
			return "bg-emerald-700"
		case "Score and Sound Design":
			return "bg-lime-700"
		case "Sub-Genres":
			return "bg-stone-700"
		case "Target Audience":
			return "bg-pink-700"
		case "Time/Period":
			return "bg-orange-700"
		case "Visual Style":
			return "bg-amber-700"
		default:
			return "text-gray-500"
	}
}

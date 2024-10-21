import type { DiscoverParams } from "~/server/discover.server"
import type { ColorName } from "~/utils/color"

export const DISCOVER_FILTER_TYPES = [
	"streaming",
	"genre",
	"score",
	"release",
	"cast",
	"crew",
	"dna",
] as const

export type DiscoverFilterType = (typeof DISCOVER_FILTER_TYPES)[number]

export interface DiscoverFilterOption {
	label: string
	color: ColorName
	associatedParams: (keyof DiscoverParams)[]
}

export const discoverFilters: Record<DiscoverFilterType, DiscoverFilterOption> =
	{
		streaming: {
			label: "Streaming",
			color: "emerald",
			associatedParams: ["streamingPreset", "withStreamingProviders"],
		},
		genre: {
			label: "Genre",
			color: "amber",
			associatedParams: ["withGenres", "withoutGenres"],
		},
		score: {
			label: "Score",
			color: "blue",
			associatedParams: ["minScore"],
		},
		release: {
			label: "Release",
			color: "cyan",
			associatedParams: ["minYear", "maxYear"],
		},
		cast: {
			label: "Cast",
			color: "purple",
			associatedParams: ["withCast"],
		},
		crew: {
			label: "Crew",
			color: "pink",
			associatedParams: ["withCrew"],
		},
		dna: {
			label: "DNA",
			color: "indigo",
			associatedParams: [],
		},
	}

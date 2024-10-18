export const DISCOVER_FILTER_TYPES = [
	"streaming",
	"genre",
	"release",
	"cast",
	"crew",
	"score",
	"dna",
] as const

export type DiscoverFilterType = (typeof DISCOVER_FILTER_TYPES)[number]

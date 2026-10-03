// The recommendation experience's feature flags, shared by the server
// (features.server.ts reads their environment variables) and the browser
// (useFeature reads what the root loader resolved for the viewer).
export const FEATURES = [
	"tasteMatch",
	"filterBar",
	"watchNext",
	"tastePage",
	"explorer",
	"navigation",
	"ageFilter",
] as const

export type Feature = (typeof FEATURES)[number]

// Whether each feature is on for the current viewer.
export type EnabledFeatures = Record<Feature, boolean>

export const NO_FEATURES: EnabledFeatures = {
	tasteMatch: false,
	filterBar: false,
	watchNext: false,
	tastePage: false,
	explorer: false,
	navigation: false,
	ageFilter: false,
}

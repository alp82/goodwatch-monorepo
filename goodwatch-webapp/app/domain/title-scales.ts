import type { SourceKey } from "./filter-state"

/** Normalized percentages shared by source-score controls and Find presets. */
export const SCORE_STEPS = [60, 70, 80, 90] as const

/** Display any normalized threshold, including values from older URLs, in the source's notation. */
export function scoreStepLabel(source: SourceKey, score: number): string {
	switch (source) {
		case "imdb":
		case "metacriticUsers":
			return `${(score / 10).toFixed(1)}+`
		case "rtCritics":
		case "rtAudience":
			return `${score}%+`
		case "metacritic":
			return `${score}+`
	}
}

/** Slider stops; the final stop is open ended. Numeric ranges are inclusive. */
export const VOTES_STEPS = [
	1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000,
	2000000,
] as const
export const POPULARITY_RANK_STEPS = [
	1, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 40000,
] as const

export const VOTES_PRESETS = [
	{ key: "hiddenGems", label: "Hidden gems", range: { max: 9999 } },
	{
		key: "knownToFans",
		label: "Known to fans",
		range: { min: 10000, max: 99999 },
	},
	{ key: "wellKnown", label: "Well known", range: { min: 100000 } },
	{ key: "everyone", label: "Everyone's seen it", range: { min: 1000000 } },
] as const
export const POPULARITY_RANK_PRESETS = [
	{ key: "popularNow", label: "Popular now", range: { max: 1000 } },
	{
		key: "underTheRadar",
		label: "Under the radar",
		range: { min: 1001, max: 10000 },
	},
	{ key: "deepCuts", label: "Deep cuts", range: { min: 10001 } },
] as const

/** Counts use these keys under optionCounts.popularity; a stop counts a minimum with no upper bound. */
export const POPULARITY_OPTIONS = [
	...VOTES_PRESETS.map((p) => ({
		key: `votes:${p.key}`,
		field: "votes" as const,
		range: p.range,
	})),
	...POPULARITY_RANK_PRESETS.map((p) => ({
		key: `rank:${p.key}`,
		field: "popularityRank" as const,
		range: p.range,
	})),
	...VOTES_STEPS.map((min) => ({
		key: `votes:${min}`,
		field: "votes" as const,
		range: { min },
	})),
	...POPULARITY_RANK_STEPS.map((min) => ({
		key: `rank:${min}`,
		field: "popularityRank" as const,
		range: { min },
	})),
	{ key: "votes:any", field: "votes" as const, range: {} },
	{ key: "rank:any", field: "popularityRank" as const, range: {} },
]

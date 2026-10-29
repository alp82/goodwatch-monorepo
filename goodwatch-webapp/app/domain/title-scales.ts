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

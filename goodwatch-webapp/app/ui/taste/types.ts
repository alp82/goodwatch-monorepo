import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "~/ui/scoring/types"

export type InteractionType = "score" | "skip" | "plan"

export interface TasteInteraction {
	tmdb_id: number
	media_type: "movie" | "show"
	type: InteractionType
	score?: Score
	timestamp: number
}

export interface GuestRating {
	tmdb_id: number
	media_type: "movie" | "show"
	score: Score
	timestamp: number
}

export interface GuestInteraction {
	tmdb_id: number
	media_type: "movie" | "show"
	type: InteractionType
	score?: Score
	timestamp: number
}

export interface TasteProfile {
	label: string
	emoji: string
	description: string
}

export interface Recommendation extends ScoringMedia {
	matchPercentage: number
	reason?: string
	backdrop_path?: string
}

export type TasteState = "landing" | "rating" | "reveal"

import type { Score } from "~/server/scores.server"

export interface ScoringMedia {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string
	backdrop_path?: string
	release_year?: string
	genres?: string[]
	synopsis?: string
	essence_tags?: string[]
	isRecommended?: boolean
}

export type InteractionType = "score" | "skip" | "plan"

export interface LastRatedItem {
	media: ScoringMedia
	score: Score | null
	actionType: InteractionType
	timestamp?: number
}

export type RewardState = 'rating' | 'reward_pending' | 'reward_revealed'

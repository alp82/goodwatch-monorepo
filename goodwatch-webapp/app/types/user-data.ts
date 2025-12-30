import type { Score } from "~/server/scores.server"

// Media type union
export type MediaType = "movie" | "show"

// Composite key: "movie-123" or "show-456"
export type MediaKey = `${MediaType}-${number}`

// Individual action data structures
export interface ScoreData {
	score: Score
	review: string | null
	updatedAt: Date
}

export interface ActionTimestamp {
	updatedAt: Date
}

// User data structure - grouped by action type
export interface UserData {
	scores: Record<MediaKey, ScoreData>
	wishlist: Record<MediaKey, ActionTimestamp>
	watched: Record<MediaKey, ActionTimestamp>
	favorites: Record<MediaKey, ActionTimestamp>
	skipped: Record<MediaKey, ActionTimestamp>
	[key: string]: unknown
}

// Helper to create media key
export const createMediaKey = (mediaType: MediaType, tmdbId: number): MediaKey => {
	return `${mediaType}-${tmdbId}`
}

// Helper to parse media key
export const parseMediaKey = (key: MediaKey): { mediaType: MediaType; tmdbId: number } => {
	const [mediaType, tmdbId] = key.split("-")
	return {
		mediaType: mediaType as MediaType,
		tmdbId: parseInt(tmdbId, 10),
	}
}

// Type-safe getters for common operations
export const getUserDataHelpers = (data: UserData | undefined) => ({
	getScore: (mediaType: MediaType, tmdbId: number): ScoreData | undefined => {
		const key = createMediaKey(mediaType, tmdbId)
		return data?.scores[key]
	},

	isOnWishlist: (mediaType: MediaType, tmdbId: number): boolean => {
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.wishlist
	},

	isWatched: (mediaType: MediaType, tmdbId: number): boolean => {
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.watched
	},

	isFavorite: (mediaType: MediaType, tmdbId: number): boolean => {
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.favorites
	},

	isSkipped: (mediaType: MediaType, tmdbId: number): boolean => {
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.skipped
	},

	getScoresCount: (): number => {
		return Object.keys(data.scores).length
	},

	getWatchlistCount: (): number => {
		return Object.keys(data.wishlist).length
	},

	getWatchedCount: (): number => {
		return Object.keys(data.watched).length
	},

	getFavoritesCount: (): number => {
		return Object.keys(data.favorites).length
	},
})

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useUserData } from "~/routes/api.user-data"
import type { LastRatedItem, ScoringMedia, InteractionType } from "~/ui/scoring/types"
import type { MediaKey, ScoreData, ActionTimestamp } from "~/types/user-data"
import type { Score } from "~/server/scores.server"

interface RecentAction {
	tmdb_id: number
	media_type: "movie" | "show"
	actionType: InteractionType
	score: Score | null
	updatedAt: Date
}

interface MediaMetadata {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string | null
}

interface UseRecentActionsProps {
	limit?: number
	enabled?: boolean
}

const parseMediaKey = (key: string): { mediaType: "movie" | "show"; tmdbId: number } => {
	const [mediaType, tmdbId] = key.split("-")
	return {
		mediaType: mediaType as "movie" | "show",
		tmdbId: parseInt(tmdbId, 10),
	}
}

export const useRecentActions = ({ limit = 5, enabled = true }: UseRecentActionsProps = {}) => {
	const { data: userData, isLoading: userDataLoading } = useUserData()

	const recentActions = useMemo((): RecentAction[] => {
		if (!userData) return []

		const actions: RecentAction[] = []

		const scores = userData.scores as Record<MediaKey, ScoreData>
		for (const [key, value] of Object.entries(scores)) {
			const { mediaType, tmdbId } = parseMediaKey(key)
			actions.push({
				tmdb_id: tmdbId,
				media_type: mediaType,
				actionType: "score",
				score: value.score,
				updatedAt: new Date(value.updatedAt),
			})
		}

		const wishlist = userData.wishlist as Record<MediaKey, ActionTimestamp>
		for (const [key, value] of Object.entries(wishlist)) {
			const { mediaType, tmdbId } = parseMediaKey(key)
			actions.push({
				tmdb_id: tmdbId,
				media_type: mediaType,
				actionType: "plan",
				score: null,
				updatedAt: new Date(value.updatedAt),
			})
		}

		const skipped = userData.skipped as Record<MediaKey, ActionTimestamp>
		for (const [key, value] of Object.entries(skipped)) {
			const { mediaType, tmdbId } = parseMediaKey(key)
			actions.push({
				tmdb_id: tmdbId,
				media_type: mediaType,
				actionType: "skip",
				score: null,
				updatedAt: new Date(value.updatedAt),
			})
		}

		return actions
			.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
			.slice(0, limit)
	}, [userData, limit])

	const mediaItemsParam = useMemo(() => {
		if (recentActions.length === 0) return null
		return JSON.stringify(
			recentActions.map((a) => ({
				tmdb_id: a.tmdb_id,
				media_type: a.media_type,
			}))
		)
	}, [recentActions])

	const { data: mediaData, isLoading: mediaLoading } = useQuery<{ media: MediaMetadata[] }>({
		queryKey: ["recent-actions-media", mediaItemsParam],
		queryFn: async () => {
			if (!mediaItemsParam) return { media: [] }
			const response = await fetch(`/api/recent-actions-media?items=${encodeURIComponent(mediaItemsParam)}`)
			return response.json()
		},
		enabled: enabled && !!mediaItemsParam,
	})

	const lastRatedItems = useMemo((): LastRatedItem[] => {
		if (!mediaData?.media || recentActions.length === 0) return []

		const mediaMap = new Map<string, MediaMetadata>()
		for (const m of mediaData.media) {
			mediaMap.set(`${m.media_type}-${m.tmdb_id}`, m)
		}

		return recentActions.map((action) => {
			const key = `${action.media_type}-${action.tmdb_id}`
			const metadata = mediaMap.get(key)

			const media: ScoringMedia = {
				tmdb_id: action.tmdb_id,
				media_type: action.media_type,
				title: metadata?.title || "",
				poster_path: metadata?.poster_path || "",
			}

			return {
				media,
				score: action.score,
				actionType: action.actionType,
				timestamp: action.updatedAt.getTime(),
			}
		})
	}, [recentActions, mediaData])

	return {
		lastRatedItems,
		isLoading: userDataLoading || mediaLoading,
	}
}

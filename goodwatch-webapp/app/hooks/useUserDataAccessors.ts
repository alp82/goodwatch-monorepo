import { useMemo } from "react"
import { useUserData } from "~/routes/api.user-data"
import type { MediaType, ScoreData } from "~/types/user-data"
import { createMediaKey, getUserDataHelpers } from "~/types/user-data"

export const useUserScore = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return null
		const key = createMediaKey(mediaType, tmdbId)
		return data.scores[key] || null
	}, [data, mediaType, tmdbId])
}

export const useIsOnWishlist = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return false
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.wishlist
	}, [data, mediaType, tmdbId])
}

export const useIsWatched = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return false
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.watched
	}, [data, mediaType, tmdbId])
}

export const useIsFavorite = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return false
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.favorites
	}, [data, mediaType, tmdbId])
}

export const useIsSkipped = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return false
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.skipped
	}, [data, mediaType, tmdbId])
}

export const useScoresCount = () => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return 0
		return Object.keys(data.scores).length
	}, [data])
}

export const useWishlistCount = () => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return 0
		return Object.keys(data.wishlist).length
	}, [data])
}

export const useWatchedCount = () => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return 0
		return Object.keys(data.watched).length
	}, [data])
}

export const useFavoritesCount = () => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return 0
		return Object.keys(data.favorites).length
	}, [data])
}

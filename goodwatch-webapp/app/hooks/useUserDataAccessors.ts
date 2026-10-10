import { useMemo } from "react"
import { useUserData } from "~/routes/api.user-data"
import type { MediaType, ScoreData } from "~/types/user-data"
import { createMediaKey, isSeen, seenKeys } from "~/types/user-data"

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

/**
 * Where the member stands with the title and what their watch log says about it; null while it is Not started.
 * `state === "seen"` is what the Seen button shows and takes back.
 */
export const useWatchState = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return null
		return data.watchState[createMediaKey(mediaType, tmdbId)] ?? null
	}, [data, mediaType, tmdbId])
}

/** Counts as Seen: the state Seen, or a score. A rated show counts through its score alone. */
export const useIsSeen = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(
		() => isSeen(data, createMediaKey(mediaType, tmdbId)),
		[data, mediaType, tmdbId],
	)
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

/** How many titles count as Seen. */
export const useSeenCount = () => {
	const { data } = useUserData()

	return useMemo(() => seenKeys(data).length, [data])
}

export const useFavoritesCount = () => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return 0
		return Object.keys(data.favorites).length
	}, [data])
}

export const useIsNotInterested = (mediaType: MediaType, tmdbId: number) => {
	const { data } = useUserData()

	return useMemo(() => {
		if (!data) return false
		const key = createMediaKey(mediaType, tmdbId)
		return key in data.notInterested
	}, [data, mediaType, tmdbId])
}


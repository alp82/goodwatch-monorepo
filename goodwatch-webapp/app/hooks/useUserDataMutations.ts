import { useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { UserData, MediaType, MediaKey } from "~/types/user-data"
import { createMediaKey } from "~/types/user-data"
import { queryKeyUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"

interface MutationResult {
	status: "success" | "failed"
}

interface UseScoreMutationParams {
	mediaType: MediaType
	tmdbId: number
	score: Score | null
	review?: string
}

interface UseWishlistMutationParams {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

interface UseWatchedMutationParams {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

interface UseFavoriteMutationParams {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

interface UseSkippedMutationParams {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

interface MutationContext {
	previousData?: UserData
}

const updateScoreOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	score: Score | null,
	review: string | null = null,
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = { ...data, scores: { ...data.scores } }

	if (score === null) {
		delete updated.scores[key]
	} else {
		updated.scores[key] = {
			score,
			review,
			updatedAt: new Date(),
		}
	}

	return updated
}

const updateWishlistOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = { ...data, wishlist: { ...data.wishlist } }

	if (action === "add") {
		updated.wishlist[key] = { updatedAt: new Date() }
	} else {
		delete updated.wishlist[key]
	}

	return updated
}

const updateWatchedOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = { ...data, watched: { ...data.watched } }

	if (action === "add") {
		updated.watched[key] = { updatedAt: new Date() }
	} else {
		delete updated.watched[key]
	}

	return updated
}

const updateFavoriteOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = { ...data, favorites: { ...data.favorites } }

	if (action === "add") {
		updated.favorites[key] = { updatedAt: new Date() }
	} else {
		delete updated.favorites[key]
	}

	return updated
}

const updateSkippedOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = { ...data, skipped: { ...data.skipped } }

	if (action === "add") {
		updated.skipped[key] = { updatedAt: new Date() }
	} else {
		delete updated.skipped[key]
	}

	return updated
}

export const useScoreMutation = () => {
	const queryClient = useQueryClient()

	return useMutation<MutationResult, Error, UseScoreMutationParams, MutationContext>({
		mutationFn: async ({ mediaType, tmdbId, score, review }) => {
			const response = await fetch("/api/update-scores", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					score,
					review,
				}),
			})
			return await response.json()
		},
		onMutate: async ({ mediaType, tmdbId, score, review }) => {
			await queryClient.cancelQueries({ queryKey: queryKeyUserData })

			const previousData = queryClient.getQueryData<UserData>(
				queryKeyUserData,
			)

			queryClient.setQueryData<UserData>(queryKeyUserData, (old) =>
				updateScoreOptimistic(old, mediaType, tmdbId, score, review || null),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeyUserData, context.previousData)
			}
		},
	})
}

export const useWishlistMutation = () => {
	const queryClient = useQueryClient()

	return useMutation<MutationResult, Error, UseWishlistMutationParams, MutationContext>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			const response = await fetch("/api/update-wishlist", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			return await response.json()
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			await queryClient.cancelQueries({ queryKey: queryKeyUserData })

			const previousData = queryClient.getQueryData<UserData>(
				queryKeyUserData,
			)

			queryClient.setQueryData<UserData>(queryKeyUserData, (old) =>
				updateWishlistOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeyUserData, context.previousData)
			}
		},
	})
}

export const useWatchedMutation = () => {
	const queryClient = useQueryClient()

	return useMutation<MutationResult, Error, UseWatchedMutationParams, MutationContext>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			const response = await fetch("/api/update-watch-history", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			return await response.json()
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			await queryClient.cancelQueries({ queryKey: queryKeyUserData })

			const previousData = queryClient.getQueryData<UserData>(
				queryKeyUserData,
			)

			queryClient.setQueryData<UserData>(queryKeyUserData, (old) =>
				updateWatchedOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeyUserData, context.previousData)
			}
		},
	})
}

export const useFavoriteMutation = () => {
	const queryClient = useQueryClient()

	return useMutation<MutationResult, Error, UseFavoriteMutationParams, MutationContext>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			const response = await fetch("/api/update-favorite", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			return await response.json()
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			await queryClient.cancelQueries({ queryKey: queryKeyUserData })

			const previousData = queryClient.getQueryData<UserData>(
				queryKeyUserData,
			)

			queryClient.setQueryData<UserData>(queryKeyUserData, (old) =>
				updateFavoriteOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeyUserData, context.previousData)
			}
		},
	})
}

export const useSkippedMutation = () => {
	const queryClient = useQueryClient()

	return useMutation<MutationResult, Error, UseSkippedMutationParams, MutationContext>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			const response = await fetch("/api/update-skipped", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			return await response.json()
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			await queryClient.cancelQueries({ queryKey: queryKeyUserData })

			const previousData = queryClient.getQueryData<UserData>(
				queryKeyUserData,
			)

			queryClient.setQueryData<UserData>(queryKeyUserData, (old) =>
				updateSkippedOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(queryKeyUserData, context.previousData)
			}
		},
	})
}

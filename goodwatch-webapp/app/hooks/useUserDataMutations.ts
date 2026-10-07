import { updateGuestInteraction } from "~/utils/guest-progress"
import { useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { afterScore, afterSeenPress } from "~/domain/member-data-updates"
import type { UserData, MediaType, MediaKey } from "~/types/user-data"
import { createMediaKey } from "~/types/user-data"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import { useUser } from "~/utils/auth"

interface MutationResult {
	status: "success" | "failed"
}

interface UseScoreMutationParams {
	mediaType: MediaType
	tmdbId: number
	score: Score | null
	review?: string
	/**
	 * False for a score the taste quiz gives. A score given by hand on a show that is Not started opens "Have you
	 * seen all of it?" on the server; the quiz's scores never do.
	 */
	byHand?: boolean
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

type UseNotInterestedMutationParams = UseSkippedMutationParams

interface MutationContext {
	previousData?: UserData
}

const updateWishlistOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = { ...data, wishlist: { ...data.wishlist }, notInterested: { ...data.notInterested } }

	if (action === "add") {
		delete updated.notInterested[key]
		const now = new Date()
		updated.wishlist[key] = { createdAt: now, updatedAt: now }
	} else {
		delete updated.wishlist[key]
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

const updateNotInterestedOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = { ...data, notInterested: { ...data.notInterested }, wishlist: { ...data.wishlist } }

	if (action === "add") {
		updated.notInterested[key] ??= { updatedAt: new Date() }
		delete updated.wishlist[key]
	} else {
		delete updated.notInterested[key]
	}

	return updated
}

export const useScoreMutation = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userDataQueryKey = getQueryKeyUserData(user?.id)

	return useMutation<
		MutationResult,
		Error,
		UseScoreMutationParams,
		MutationContext
	>({
		mutationFn: async ({ mediaType, tmdbId, score, review, byHand }) => {
			if (!user) {
				updateGuestInteraction(
					mediaType,
					tmdbId,
					"score",
					score,
					score === null,
				)
				return { status: "success" }
			}
			const response = await fetch("/api/update-scores", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					score,
					review,
					...(byHand === false ? { by_hand: false } : {}),
				}),
			})
			return await response.json()
		},
		onMutate: async ({ mediaType, tmdbId, score, review }) => {
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const previousData = queryClient.getQueryData<UserData>(userDataQueryKey)

			// A rated movie is Seen: the server records the watch its score owns with the score.
			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				afterScore(old, mediaType, tmdbId, score, review || null, new Date()),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(userDataQueryKey, context.previousData)
			}
		},
		onSettled: (_, __, { mediaType, score }) => {
			// Whether a movie stays Seen without its score depends on its watch log, which the map only sums up.
			if (user && mediaType === "movie" && score === null)
				void queryClient.invalidateQueries({ queryKey: userDataQueryKey })
		},
	})
}

export const useWishlistMutation = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userDataQueryKey = getQueryKeyUserData(user?.id)

	return useMutation<
		MutationResult,
		Error,
		UseWishlistMutationParams,
		MutationContext
	>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			if (!user) {
				updateGuestInteraction(
					mediaType,
					tmdbId,
					"plan",
					undefined,
					action === "remove",
				)
				return { status: "success" }
			}
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
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const previousData = queryClient.getQueryData<UserData>(userDataQueryKey)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateWishlistOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(userDataQueryKey, context.previousData)
			}
		},
	})
}

export const useWatchedMutation = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userDataQueryKey = getQueryKeyUserData(user?.id)

	return useMutation<
		MutationResult,
		Error,
		UseWatchedMutationParams,
		MutationContext
	>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			const response = await fetch("/api/update-watch-history", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
					// Names the watch (or a show's Seen press), so a request that is sent twice records once.
					action_id:
						action === "add" ? globalThis.crypto?.randomUUID?.() : undefined,
				}),
			})
			return await response.json()
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const previousData = queryClient.getQueryData<UserData>(userDataQueryKey)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				afterSeenPress(old, mediaType, tmdbId, action, new Date()),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(userDataQueryKey, context.previousData)
			}
		},
		// The map can't say which episodes a show's press ticked, or which state taking it back returns to.
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: userDataQueryKey })
		},
	})
}

export const useFavoriteMutation = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userDataQueryKey = getQueryKeyUserData(user?.id)

	return useMutation<
		MutationResult,
		Error,
		UseFavoriteMutationParams,
		MutationContext
	>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			const response = await fetch("/api/update-favorites", {
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
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const previousData = queryClient.getQueryData<UserData>(userDataQueryKey)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateFavoriteOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(userDataQueryKey, context.previousData)
			}
		},
	})
}

export const useSkippedMutation = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userDataQueryKey = getQueryKeyUserData(user?.id)

	return useMutation<
		MutationResult,
		Error,
		UseSkippedMutationParams,
		MutationContext
	>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			if (!user) {
				updateGuestInteraction(
					mediaType,
					tmdbId,
					"skip",
					undefined,
					action === "remove",
				)
				return { status: "success" }
			}
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
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const previousData = queryClient.getQueryData<UserData>(userDataQueryKey)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateSkippedOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(userDataQueryKey, context.previousData)
			}
		},
	})
}

export const useNotInterestedMutation = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const userDataQueryKey = getQueryKeyUserData(user?.id)

	return useMutation<
		MutationResult,
		Error,
		UseNotInterestedMutationParams,
		MutationContext
	>({
		mutationFn: async ({ mediaType, tmdbId, action }) => {
			if (!user) {
				updateGuestInteraction(
					mediaType,
					tmdbId,
					"not-interested",
					undefined,
					action === "remove",
				)
				return { status: "success" }
			}
			const response = await fetch("/api/update-not-interested", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			const result: MutationResult = await response.json()
			if (!response.ok || result.status !== "success") throw new Error("Updating Not interested failed")
			return result
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const previousData = queryClient.getQueryData<UserData>(userDataQueryKey)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateNotInterestedOptimistic(old, mediaType, tmdbId, action),
			)

			return { previousData }
		},
		onError: (_, __, context) => {
			if (context?.previousData) {
				queryClient.setQueryData(userDataQueryKey, context.previousData)
			}
		},
	})
}

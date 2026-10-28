import { productAnalyticsFetch } from "~/telemetry/product-analytics"
import { updateGuestInteraction } from "~/utils/guest-progress"
import { useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
	LISTS_CHANGED,
	type TitleEntries,
	afterScore,
	afterSeenPress,
	restoreTitle,
	titleEntries,
} from "~/domain/member-data-updates"
import type { UserData, MediaType, MediaKey } from "~/types/user-data"
import { createMediaKey } from "~/types/user-data"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import { useUser } from "~/utils/auth"

interface MutationResult {
	status: "success" | "failed"
}

interface UseScoreMutationParams extends Batched {
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

interface UseWishlistMutationParams extends Batched {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

interface UseWatchedMutationParams extends Batched {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

interface UseFavoriteMutationParams extends Batched {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

interface UseSkippedMutationParams extends Batched {
	mediaType: MediaType
	tmdbId: number
	action: "add" | "remove"
}

type UseNotInterestedMutationParams = UseSkippedMutationParams

/**
 * The server's answer to a write, or a rejection when it didn't save: a failed request, or an answer that says
 * `failed` (an expired session, a write the server turned down). Rejecting runs the mutation's rollback, so no
 * optimistic mark stays on screen for a write that never happened.
 */
async function savedResult(response: Response, what: string): Promise<MutationResult> {
	const result = (await response.json().catch(() => null)) as MutationResult | null
	if (!response.ok || result?.status !== "success")
		throw new Error(`Saving ${what} failed`)
	return result
}

/**
 * The title's entries before the mutation's guess. A write that isn't saved puts back these alone, so another title's
 * guess made while it was on its way stays (member-data-updates.ts, `restoreTitle`).
 */
interface MutationContext {
	before?: TitleEntries
}

/**
 * For a write that is one of many: it doesn't read the member data again when it settles, so the caller reads it
 * once after all of them settled (Quick list's bulk answers and their undo).
 */
interface Batched {
	deferSync?: boolean
}

const updateWishlistOptimistic = (
	data: UserData | undefined,
	mediaType: MediaType,
	tmdbId: number,
	action: "add" | "remove",
): UserData | undefined => {
	if (!data) return data

	const key = createMediaKey(mediaType, tmdbId)
	const updated = {
		...data,
		wishlist: { ...data.wishlist },
		notInterested: { ...data.notInterested },
	}

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
	const updated = {
		...data,
		notInterested: { ...data.notInterested },
		wishlist: { ...data.wishlist },
	}

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
				// Over the guest limit nothing is saved (and the limit prompt opens): a rejection, not a success.
				if (
					!updateGuestInteraction(
						mediaType,
						tmdbId,
						"score",
						score,
						score === null,
					)
				)
					throw new Error("Over the guest limit")
				return { status: "success" }
			}
			const response = await productAnalyticsFetch("/api/update-scores", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					score,
					review,
					...(byHand === false ? { by_hand: false } : {}),
				}),
			})
			return savedResult(response, "the score")
		},
		onMutate: async ({ mediaType, tmdbId, score, review }) => {
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const before = titleEntries(
				queryClient.getQueryData<UserData>(userDataQueryKey),
				mediaType,
				tmdbId,
				LISTS_CHANGED.score,
			)

			// A rated movie is Seen: the server records the watch its score owns with the score.
			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				afterScore(old, mediaType, tmdbId, score, review || null, new Date()),
			)

			return { before }
		},
		onError: (_, { mediaType, tmdbId }, context) => {
			if (context?.before)
				queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
					restoreTitle(old, mediaType, tmdbId, context.before),
				)
		},
		onSettled: (_, __, { mediaType, tmdbId, score, deferSync }) => {
			if (!user || mediaType !== "movie") return
			// Whether a movie stays Seen without its score depends on its watch log, which the map only sums up.
			if (score === null && !deferSync)
				void queryClient.invalidateQueries({ queryKey: userDataQueryKey })
			// A score adds or removes the watch it owns, so a log that was read before is read again when it next
			// opens. The key is `watchLogKey` of ui/watch-log/useWatchLog.ts, whose code loads with the log.
			void queryClient.invalidateQueries({
				queryKey: ["watch-log", user.id, tmdbId],
			})
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
			const response = await productAnalyticsFetch("/api/update-wishlist", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			return savedResult(response, "Want to See")
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const before = titleEntries(
				queryClient.getQueryData<UserData>(userDataQueryKey),
				mediaType,
				tmdbId,
				LISTS_CHANGED.wishlist,
			)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateWishlistOptimistic(old, mediaType, tmdbId, action),
			)

			return { before }
		},
		onError: (_, { mediaType, tmdbId }, context) => {
			if (context?.before)
				queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
					restoreTitle(old, mediaType, tmdbId, context.before),
				)
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
			const response = await productAnalyticsFetch(
				"/api/update-watch-history",
				{
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
					// Names the watch (or a show's Seen press), so a request that is sent twice records once.
					action_id:
						action === "add" ? globalThis.crypto?.randomUUID?.() : undefined,
				}),
			},
			)
			return savedResult(response, "the watch")
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const before = titleEntries(
				queryClient.getQueryData<UserData>(userDataQueryKey),
				mediaType,
				tmdbId,
				LISTS_CHANGED.watched,
			)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				afterSeenPress(old, mediaType, tmdbId, action, new Date()),
			)

			return { before }
		},
		onError: (_, { mediaType, tmdbId }, context) => {
			if (context?.before)
				queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
					restoreTitle(old, mediaType, tmdbId, context.before),
				)
		},
		// The map can't say which episodes a show's press ticked, or which state taking it back returns to.
		onSettled: (_, __, { mediaType, tmdbId, deferSync }) => {
			if (!deferSync) void queryClient.invalidateQueries({ queryKey: userDataQueryKey })
			// A movie's watches changed: its log is read again when it next opens (`watchLogKey` of useWatchLog.ts).
			if (user && mediaType === "movie")
				void queryClient.invalidateQueries({
				queryKey: ["watch-log", user.id, tmdbId],
			})
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
			const response = await productAnalyticsFetch("/api/update-favorites", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			return savedResult(response, "the favorite")
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const before = titleEntries(
				queryClient.getQueryData<UserData>(userDataQueryKey),
				mediaType,
				tmdbId,
				LISTS_CHANGED.favorite,
			)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateFavoriteOptimistic(old, mediaType, tmdbId, action),
			)

			return { before }
		},
		onError: (_, { mediaType, tmdbId }, context) => {
			if (context?.before)
				queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
					restoreTitle(old, mediaType, tmdbId, context.before),
				)
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
			const response = await productAnalyticsFetch("/api/update-skipped", {
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			})
			return savedResult(response, "Haven't seen it")
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const before = titleEntries(
				queryClient.getQueryData<UserData>(userDataQueryKey),
				mediaType,
				tmdbId,
				LISTS_CHANGED.skipped,
			)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateSkippedOptimistic(old, mediaType, tmdbId, action),
			)

			return { before }
		},
		onError: (_, { mediaType, tmdbId }, context) => {
			if (context?.before)
				queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
					restoreTitle(old, mediaType, tmdbId, context.before),
				)
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
			const response = await productAnalyticsFetch(
				"/api/update-not-interested",
				{
				method: "POST",
				body: JSON.stringify({
					tmdb_id: tmdbId,
					media_type: mediaType,
					action,
				}),
			},
			)
			return savedResult(response, "Not interested")
		},
		onMutate: async ({ mediaType, tmdbId, action }) => {
			if (!user) return {}
			await queryClient.cancelQueries({ queryKey: userDataQueryKey })

			const before = titleEntries(
				queryClient.getQueryData<UserData>(userDataQueryKey),
				mediaType,
				tmdbId,
				LISTS_CHANGED.notInterested,
			)

			queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
				updateNotInterestedOptimistic(old, mediaType, tmdbId, action),
			)

			return { before }
		},
		onError: (_, { mediaType, tmdbId }, context) => {
			if (context?.before)
				queryClient.setQueryData<UserData>(userDataQueryKey, (old) =>
					restoreTitle(old, mediaType, tmdbId, context.before),
				)
		},
	})
}

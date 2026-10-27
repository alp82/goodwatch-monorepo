import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"
import { queryKeyUserData } from "~/routes/api.user-data"
import {
	useNotInterestedMutation,
	useScoreMutation,
	useSkippedMutation,
	useWishlistMutation,
} from "~/hooks/useUserDataMutations"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "~/ui/scoring/types"
import {
	clearGuestProgress,
	readGuestInteractions,
	updateGuestInteraction,
	useGuestInteractions,
} from "~/utils/guest-progress"
import { FIRST_UNLOCK_COUNT_KEY } from "../constants"
import type { TasteInteraction } from "../types"
import { useRatingsCount } from "./useRatingsCount"

interface UseTasteScoringProps {
	isAuthenticated: boolean
}

export const useTasteScoring = ({ isAuthenticated }: UseTasteScoringProps) => {
	const guestInteractions = useGuestInteractions()
	const [memberInteractions, setInteractions] = useState<TasteInteraction[]>([])
	const interactions = isAuthenticated ? memberInteractions : guestInteractions

	const [confirmedRatings, setConfirmedRatings] = useState<string[]>([])
	const [hasScored, setHasScored] = useState(false)
	useEffect(() => {
		if (!isAuthenticated)
			setConfirmedRatings(
				readGuestInteractions()
					.filter((i) => i.type === "score")
					.map((i) => `${i.media_type}-${i.tmdb_id}`),
			)
	}, [isAuthenticated])
	const noteScoreSaved = useCallback((media: ScoringMedia) => {
		const key = `${media.media_type}-${media.tmdb_id}`
		setConfirmedRatings((previous) =>
			previous.includes(key) ? previous : [...previous, key],
		)
		setHasScored(true)
	}, [])
	const queryClient = useQueryClient()
	const scoreMutation = useScoreMutation()
	const skippedMutation = useSkippedMutation()
	const wishlistMutation = useWishlistMutation()
	const notInterestedMutation = useNotInterestedMutation()

	const updateInteractions = useCallback(
		(media: ScoringMedia, interaction: Omit<TasteInteraction, "timestamp">) => {
			if (!isAuthenticated) {
				updateGuestInteraction(
					media.media_type,
					media.tmdb_id,
					interaction.type,
					interaction.score,
				)
				return
			}
			const fullInteraction: TasteInteraction = {
				...interaction,
				timestamp: Date.now(),
			}

			setInteractions((prev) => {
				const existingIndex = prev.findIndex(
					(i) =>
						i.tmdb_id === media.tmdb_id && i.media_type === media.media_type,
				)
				let next: TasteInteraction[]
				if (existingIndex >= 0) {
					next = [...prev]
					next[existingIndex] = fullInteraction
				} else {
					next = [...prev, fullInteraction]
				}
				return next
			})
		},
		[isAuthenticated],
	)

	const addScore = useCallback(
		(media: ScoringMedia, score: Score): number | undefined => {
			if (!isAuthenticated) {
				if (
					updateGuestInteraction(
						media.media_type,
						media.tmdb_id,
						"score",
						score,
					)
				)
					noteScoreSaved(media)
				return readGuestInteractions().filter((i) => i.type === "score").length
			}
			if (isAuthenticated) {
				void scoreMutation
					.mutateAsync({
						mediaType: media.media_type,
						tmdbId: media.tmdb_id,
						score,
						// A quiz score on a show never asks "Have you seen all of it?".
						byHand: false,
					})
					.then(
						(result) => {
							if (result.status === "success") noteScoreSaved(media)
						},
						() => {},
					)
			}

			let newCount: number | undefined
			setInteractions((prev) => {
				const interaction: TasteInteraction = {
					tmdb_id: media.tmdb_id,
					media_type: media.media_type,
					type: "score",
					score,
					timestamp: Date.now(),
				}
				const existingIndex = prev.findIndex(
					(i) =>
						i.tmdb_id === media.tmdb_id && i.media_type === media.media_type,
				)
				let next: TasteInteraction[]
				if (existingIndex >= 0) {
					next = [...prev]
					next[existingIndex] = interaction
				} else {
					next = [...prev, interaction]
				}
				newCount = next.filter((i) => i.type === "score").length
				return next
			})
			return newCount
		},
		[isAuthenticated, scoreMutation, noteScoreSaved],
	)

	const addSkip = useCallback(
		(media: ScoringMedia) => {
			if (isAuthenticated) {
				skippedMutation.mutate({
					mediaType: media.media_type,
					tmdbId: media.tmdb_id,
					action: "add",
				})
			}

			updateInteractions(media, {
				tmdb_id: media.tmdb_id,
				media_type: media.media_type,
				type: "skip",
			})
		},
		[isAuthenticated, skippedMutation, updateInteractions],
	)

	const addPlanToWatch = useCallback(
		(media: ScoringMedia) => {
			if (isAuthenticated) {
				wishlistMutation.mutate({
					mediaType: media.media_type,
					tmdbId: media.tmdb_id,
					action: "add",
				})
			}

			updateInteractions(media, {
				tmdb_id: media.tmdb_id,
				media_type: media.media_type,
				type: "plan",
			})
		},
		[isAuthenticated, wishlistMutation, updateInteractions],
	)

	/** Puts an answer in this visit's list, after it was saved. */
	const record = useCallback(
		(
			media: ScoringMedia,
			type: "score" | "skip" | "not-interested",
			score?: Score,
		) =>
			setInteractions((prev) => [
				...prev.filter(
					(i) =>
						!(i.tmdb_id === media.tmdb_id && i.media_type === media.media_type),
				),
				{
					tmdb_id: media.tmdb_id,
					media_type: media.media_type,
					type,
					...(type === "score" ? { score } : {}),
					timestamp: Date.now(),
				},
			]),
		[],
	)
	/** A write the server answered without saving: the person's marks are read again, so none stays half-done. */
	const refused = useCallback((): never => {
		void queryClient.invalidateQueries({ queryKey: queryKeyUserData })
		throw new Error("The answer was not saved")
	}, [queryClient])

	/**
	 * Saves a score and settles when it is saved: in the browser for a guest (it fails over the guest limit, which
	 * raises its prompt), on the account for a member. Only a saved score joins this visit's list. Rejects when it
	 * isn't saved, so a page that waits for it can keep the title (ui/scoring/score-ack.ts).
	 */
	const saveScore = useCallback(
		async (media: ScoringMedia, score: Score) => {
			if (!isAuthenticated) {
				if (
					!updateGuestInteraction(media.media_type, media.tmdb_id, "score", score)
				)
					throw new Error("Over the guest limit")
				noteScoreSaved(media)
				return
			}
			const result = await scoreMutation
				.mutateAsync({
					mediaType: media.media_type,
					tmdbId: media.tmdb_id,
					score,
					// A quiz score on a show never asks "Have you seen all of it?".
					byHand: false,
				})
				.catch(refused)
			if (result.status !== "success") refused()
			noteScoreSaved(media)
			record(media, "score", score)
		},
		[isAuthenticated, scoreMutation, noteScoreSaved, record, refused],
	)

	/** Saves "Haven't seen it" (skipped in the taste quiz) and settles when it is saved, as `saveScore` does. */
	const saveSkip = useCallback(
		async (media: ScoringMedia) => {
			if (!isAuthenticated) {
				updateGuestInteraction(media.media_type, media.tmdb_id, "skip")
				return
			}
			const result = await skippedMutation
				.mutateAsync({
					mediaType: media.media_type,
					tmdbId: media.tmdb_id,
					action: "add",
				})
				.catch(refused)
			if (result.status !== "success") refused()
			record(media, "skip")
		},
		[isAuthenticated, skippedMutation, record, refused],
	)

	/** Saves "Not interested" (never recommend it) and settles when it is saved, as `saveScore` does. */
	const saveNotInterested = useCallback(
		async (media: ScoringMedia) => {
			if (!isAuthenticated) {
				updateGuestInteraction(media.media_type, media.tmdb_id, "not-interested")
				return
			}
			const result = await notInterestedMutation
				.mutateAsync({
					mediaType: media.media_type,
					tmdbId: media.tmdb_id,
					action: "add",
				})
				.catch(refused)
			if (result.status !== "success") refused()
			record(media, "not-interested")
		},
		[isAuthenticated, notInterestedMutation, record, refused],
	)

	const clearInteractions = useCallback(() => {
		if (!isAuthenticated) {
			setInteractions([])
			clearGuestProgress()
			localStorage.removeItem(FIRST_UNLOCK_COUNT_KEY)
		}
	}, [isAuthenticated])

	const ratingsCount = useRatingsCount({ isAuthenticated, interactions })

	return {
		interactions,
		confirmedRatingCount: confirmedRatings.length,
		hasScored,
		addScore,
		addSkip,
		saveScore,
		saveSkip,
		saveNotInterested,
		addPlanToWatch,
		clearInteractions,
		ratingsCount,
		isSubmitting:
			scoreMutation.isPending ||
			skippedMutation.isPending ||
			wishlistMutation.isPending ||
			notInterestedMutation.isPending,
	}
}

import { useCallback, useState } from "react"
import {
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

	const scoreMutation = useScoreMutation()
	const skippedMutation = useSkippedMutation()
	const wishlistMutation = useWishlistMutation()

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
				updateGuestInteraction(media.media_type, media.tmdb_id, "score", score)
				return readGuestInteractions().filter((i) => i.type === "score").length
			}
			if (isAuthenticated) {
				scoreMutation.mutate({
					mediaType: media.media_type,
					tmdbId: media.tmdb_id,
					score,
					// A quiz score on a show never asks "Have you seen all of it?".
					byHand: false,
				})
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
		[isAuthenticated, scoreMutation],
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
		addScore,
		addSkip,
		addPlanToWatch,
		clearInteractions,
		ratingsCount,
		isSubmitting:
			scoreMutation.isPending ||
			skippedMutation.isPending ||
			wishlistMutation.isPending,
	}
}

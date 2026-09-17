import { useState, useEffect, useCallback } from "react"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { TasteInteraction } from "../types"
import { ONBOARDING_RATINGS_KEY, FIRST_UNLOCK_COUNT_KEY } from "../constants"
import { GUEST_LIMITS } from "../features"
import { useRatingsCount } from "./useRatingsCount"
import { useScoreMutation, useSkippedMutation, useWishlistMutation } from "~/hooks/useUserDataMutations"

interface UseTasteScoringProps {
	isAuthenticated: boolean
	prototype?: boolean
}

export const useTasteScoring = ({ isAuthenticated, prototype = false }: UseTasteScoringProps) => {
	const ratingsKey = prototype ? "prototype_journey_ratings" : ONBOARDING_RATINGS_KEY
	const unlockKey = prototype ? "prototype_journey_unlock" : FIRST_UNLOCK_COUNT_KEY
	const [interactions, setInteractions] = useState<TasteInteraction[]>([])
	const [firstUnlockCount, setFirstUnlockCount] = useState<number | null>(null)
	
	const scoreMutation = useScoreMutation()
	const skippedMutation = useSkippedMutation()
	const wishlistMutation = useWishlistMutation()

	useEffect(() => {
		if (!isAuthenticated) {
			const stored = localStorage.getItem(ratingsKey)
			if (stored) {
				try {
					const parsed = JSON.parse(stored)
					setInteractions(parsed)
				} catch (e) {
					console.error("Failed to parse stored interactions", e)
				}
			}
			const storedUnlockCount = localStorage.getItem(unlockKey)
			if (storedUnlockCount) {
				setFirstUnlockCount(Number.parseInt(storedUnlockCount, 10))
			}
		}
	}, [isAuthenticated, ratingsKey, unlockKey])

	useEffect(() => {
		if (!isAuthenticated && interactions.length > 0) {
			localStorage.setItem(ratingsKey, JSON.stringify(interactions))
		}
	}, [interactions, isAuthenticated, ratingsKey])

	const updateInteractions = useCallback((media: ScoringMedia, interaction: Omit<TasteInteraction, 'timestamp'>) => {
		const fullInteraction: TasteInteraction = {
			...interaction,
			...(prototype ? { media } : {}),
			timestamp: Date.now(),
		}

		setInteractions(prev => {
			const existingIndex = prev.findIndex(
				i => i.tmdb_id === media.tmdb_id && i.media_type === media.media_type
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
	}, [prototype])

	const addScore = useCallback((media: ScoringMedia, score: Score): number | undefined => {
		if (isAuthenticated) {
			scoreMutation.mutate({
				mediaType: media.media_type,
				tmdbId: media.tmdb_id,
				score,
			})
		}

		let newCount: number | undefined
		setInteractions(prev => {
			const interaction: TasteInteraction = {
				...(prototype ? { media } : {}),
				tmdb_id: media.tmdb_id,
				media_type: media.media_type,
				type: 'score',
				score,
				timestamp: Date.now(),
			}
			const existingIndex = prev.findIndex(
				i => i.tmdb_id === media.tmdb_id && i.media_type === media.media_type
			)
			let next: TasteInteraction[]
			if (existingIndex >= 0) {
				next = [...prev]
				next[existingIndex] = interaction
			} else {
				next = [...prev, interaction]
			}
			newCount = next.filter(i => i.type === 'score').length
			return next
		})
		return newCount
	}, [isAuthenticated, scoreMutation, prototype])

	const addSkip = useCallback((media: ScoringMedia) => {
		if (isAuthenticated) {
			skippedMutation.mutate({
				mediaType: media.media_type,
				tmdbId: media.tmdb_id,
				action: 'add',
			})
		}

		updateInteractions(media, {
			tmdb_id: media.tmdb_id,
			media_type: media.media_type,
			type: 'skip',
		})
	}, [isAuthenticated, skippedMutation, updateInteractions])

	const addPlanToWatch = useCallback((media: ScoringMedia) => {
		if (isAuthenticated) {
			wishlistMutation.mutate({
				mediaType: media.media_type,
				tmdbId: media.tmdb_id,
				action: 'add',
			})
		}

		updateInteractions(media, {
			tmdb_id: media.tmdb_id,
			media_type: media.media_type,
			type: 'plan',
		})
	}, [isAuthenticated, wishlistMutation, updateInteractions])

	const clearInteractions = useCallback(() => {
		if (!isAuthenticated) {
			setInteractions([])
			setFirstUnlockCount(null)
			localStorage.removeItem(ratingsKey)
			localStorage.removeItem(unlockKey)
		}
	}, [isAuthenticated, ratingsKey, unlockKey])

	const ratingsCount = useRatingsCount({ isAuthenticated, interactions })
	
	const positiveRatingsCount = interactions.filter(i => i.type === 'score' && i.score && i.score >= 6).length

	useEffect(() => {
		if (!isAuthenticated && positiveRatingsCount >= GUEST_LIMITS.FIRST_UNLOCK && firstUnlockCount === null) {
			const count = interactions.filter(i => i.type === 'score').length
			setFirstUnlockCount(count)
			localStorage.setItem(unlockKey, String(count))
		}
	}, [isAuthenticated, positiveRatingsCount, firstUnlockCount, interactions, unlockKey])

	return {
		interactions,
		addScore,
		addSkip,
		addPlanToWatch,
		clearInteractions,
		ratingsCount,
		positiveRatingsCount,
		firstUnlockCount,
		isSubmitting: scoreMutation.isPending || skippedMutation.isPending || wishlistMutation.isPending,
	}
}

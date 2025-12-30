import { useState, useEffect, useMemo } from "react"
import { getUnlockedFeatures } from "../features"
import { TASTE_PROFILE_FEATURES_KEY } from "../constants"

interface UseFeatureActivationProps {
	isAuthenticated: boolean
	ratingsCount: number
}

/**
 * Lightweight hook that manages feature activation:
 * - Authenticated users: Features derived from ratingsCount (database)
 * - Guest users: Features stored in localStorage and manually activated
 */
export const useFeatureActivation = ({ isAuthenticated, ratingsCount }: UseFeatureActivationProps) => {
	const [guestActivatedFeatures, setGuestActivatedFeatures] = useState<Set<string>>(new Set())

	// Load guest features from localStorage on mount
	useEffect(() => {
		if (!isAuthenticated) {
			const stored = localStorage.getItem(TASTE_PROFILE_FEATURES_KEY)
			if (stored) {
				try {
					const features = JSON.parse(stored) as string[]
					setGuestActivatedFeatures(new Set(features))
				} catch (e) {
					console.error("Failed to parse activated features:", e)
				}
			}
		}
	}, [isAuthenticated])

	// Save guest features to localStorage
	useEffect(() => {
		if (!isAuthenticated) {
			localStorage.setItem(
				TASTE_PROFILE_FEATURES_KEY,
				JSON.stringify(Array.from(guestActivatedFeatures))
			)
		}
	}, [guestActivatedFeatures, isAuthenticated])

	// Get activated features based on user type
	const activatedFeatures = useMemo(() => {
		if (isAuthenticated) {
			// Authenticated: derive from ratingsCount
			const unlocked = getUnlockedFeatures(ratingsCount)
			return new Set(unlocked.map(f => f.id))
		}
		// Guest: use manually activated features
		return guestActivatedFeatures
	}, [isAuthenticated, ratingsCount, guestActivatedFeatures])

	const activateFeature = (featureId: string) => {
		if (!isAuthenticated) {
			setGuestActivatedFeatures(prev => new Set([...prev, featureId]))
		}
		// For authenticated users, features are auto-activated based on ratingsCount
	}

	const clearFeatures = () => {
		if (!isAuthenticated) {
			setGuestActivatedFeatures(new Set())
			localStorage.removeItem(TASTE_PROFILE_FEATURES_KEY)
		}
	}

	return {
		activatedFeatures,
		activateFeature,
		clearFeatures,
	}
}

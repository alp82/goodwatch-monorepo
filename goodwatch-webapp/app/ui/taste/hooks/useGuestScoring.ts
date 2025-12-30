import { useCallback } from "react"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "~/ui/scoring/types"
import { getCurrentLevel, FEATURES } from "../features"
import type { GuestRating, TasteInteraction } from "../types"

interface UseGuestScoringProps {
	interactions: TasteInteraction[]
	ratingsCount: number
	activatedFeatures: Set<string>
	addScore: (media: ScoringMedia, score: Score) => number | null | undefined
	addSkip: (media: ScoringMedia) => void
	addPlanToWatch: (media: ScoringMedia) => void
	activateFeature: (featureId: string) => void
	onComplete?: (ratings: GuestRating[]) => void
	nextTitle: () => void
}

export function useGuestScoring({
	interactions,
	ratingsCount,
	activatedFeatures,
	addScore,
	addSkip,
	addPlanToWatch,
	activateFeature,
	onComplete,
	nextTitle
}: UseGuestScoringProps) {
	
	const handleScore = useCallback((currentMedia: ScoringMedia, score: Score) => {
		// Guests: derive new count from interactions via addScore
		// Users: rely on ratingsCount from userData (updated via optimistic mutations in action components)
		const newScoreCount = addScore(currentMedia, score) ?? ratingsCount + 1

		const currentLevelNum = getCurrentLevel(newScoreCount - 1).level
		const newLevelNum = getCurrentLevel(newScoreCount).level
		const leveledUp = newLevelNum > currentLevelNum

		const newlyUnlocked = FEATURES.find(
			f => f.unlockAt === newScoreCount && !activatedFeatures.has(f.id)
		)
		
		// Silently activate newly unlocked features without disrupting the flow
		if (newlyUnlocked) {
			activateFeature(newlyUnlocked.id)
		}
		
		// Don't call onComplete for level ups or feature unlocks to prevent blank screens
		// The parent component should handle completion logic differently
		
		// Always continue to next title - ensure we stay in rating state
		nextTitle()
	}, [addScore, ratingsCount, activatedFeatures, activateFeature, nextTitle])

	const handleSkip = useCallback((currentMedia: ScoringMedia) => {
		addSkip(currentMedia)
		nextTitle()
	}, [addSkip, nextTitle])

	const handlePlanToWatch = useCallback((currentMedia: ScoringMedia) => {
		addPlanToWatch(currentMedia)
		nextTitle()
	}, [addPlanToWatch, nextTitle])

	return {
		handleScore,
		handleSkip,
		handlePlanToWatch
	}
}

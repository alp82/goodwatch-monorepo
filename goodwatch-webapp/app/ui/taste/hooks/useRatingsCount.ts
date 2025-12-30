import { useMemo } from "react"
import { useScoresCount } from "~/hooks/useUserDataAccessors"
import type { TasteInteraction } from "../types"

interface UseRatingsCountProps {
	isAuthenticated: boolean
	interactions: TasteInteraction[]
}

/**
 * Lightweight hook that provides ratings count from the appropriate source:
 * - Authenticated users: Count from userData (database)
 * - Guest users: Count from interactions (localStorage)
 */
export const useRatingsCount = ({ isAuthenticated, interactions }: UseRatingsCountProps) => {
	const scoresCount = useScoresCount()

	return useMemo(() => {
		if (isAuthenticated) {
			return scoresCount
		}
		
		// Guest: count from interactions
		return interactions.filter(i => i.type === 'score').length
	}, [isAuthenticated, scoresCount, interactions])
}

import { useCallback } from "react"
import { useScoreMutation } from "~/hooks/useUserDataMutations"
import type { Score } from "~/server/scores.server"
import type { MediaType } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import { canGuestRate, guestLimitEvent } from "~/utils/guest-progress"

/** What scoring needs to know about a title; MovieResult and ShowResult have it. */
export interface ScoredMedia {
	mediaType: MediaType
	details: { tmdb_id: number; title: string }
}

/**
 * Scoring a title, with everything that goes with it: a guest at the rating limit gets the sign-up prompt instead.
 * The server records what a score means for Seen with the score itself: a rated movie is Seen through the watch its
 * score owns, and a show's score records no watch. `rate` answers whether the score was sent.
 */
export function useScoreAction(media: ScoredMedia) {
	const { user } = useUser()
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id

	const { mutate: updateScore, isPending } = useScoreMutation()

	const rate = useCallback(
		(score: Score | null) => {
			if (!user && score !== null && !canGuestRate(mediaType, tmdbId)) {
				window.dispatchEvent(new Event(guestLimitEvent))
				return false
			}
			updateScore({ mediaType, tmdbId, score })
			return true
		},
		[user, mediaType, tmdbId, updateScore],
	)

	return { rate, isPending }
}

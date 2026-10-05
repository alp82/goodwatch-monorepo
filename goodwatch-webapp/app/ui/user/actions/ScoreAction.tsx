import { useCallback } from "react"
import { useScoreMutation, useWatchedMutation } from "~/hooks/useUserDataMutations"
import type { Score } from "~/server/scores.server"
import type { MediaType } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import { canGuestRate, guestLimitEvent } from "~/utils/guest-progress"

/** What scoring needs to know about a title; MovieResult and ShowResult have it. */
export interface ScoredMedia {
	mediaType: MediaType
	details: { tmdb_id: number; title: string }
}

export interface ScoreActionOptions {
	/** Also records (or, when clearing, removes) the watch. Off where the caller has recorded the watch itself. */
	recordWatch?: boolean
}

/**
 * Scoring a title, with everything that goes with it: a guest at the rating limit gets the sign-up prompt instead, and
 * a member's score also records the watch (clearing the score removes it). `rate` answers whether the score was sent.
 */
export function useScoreAction(media: ScoredMedia, { recordWatch = true }: ScoreActionOptions = {}) {
	const { user } = useUser()
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id

	const { mutate: updateScore, isPending: isScorePending } = useScoreMutation()
	const { mutate: updateWatched, isPending: isWatchedPending } = useWatchedMutation()

	const rate = useCallback(
		(score: Score | null) => {
			if (!user && score !== null && !canGuestRate(mediaType, tmdbId)) {
				window.dispatchEvent(new Event(guestLimitEvent))
				return false
			}
			updateScore({ mediaType, tmdbId, score })
			if (user && recordWatch)
				updateWatched({ mediaType, tmdbId, action: score === null ? "remove" : "add" })
			return true
		},
		[user, mediaType, tmdbId, recordWatch, updateScore, updateWatched],
	)

	return { rate, isPending: isScorePending || isWatchedPending }
}

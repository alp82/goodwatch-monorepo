// Today's Seen button for one title: one press marks it Seen, one more takes that back.
import { useCallback } from "react"
import { toast } from "react-toastify"
import { useUserScore, useWatchState } from "~/hooks/useUserDataAccessors"
import { useWatchedMutation } from "~/hooks/useUserDataMutations"
import type { MediaType } from "~/types/user-data"

/** Why one more press does nothing on a rated movie: the watch its score owns keeps it Seen. */
export const RATED_SO_SEEN = "It counts as Seen because you rated it. Clear your score to change that."

export function useSeenToggle(mediaType: MediaType, tmdbId: number) {
	const entry = useWatchState(mediaType, tmdbId)
	const rated = useUserScore(mediaType, tmdbId) !== null
	const { mutate, isPending } = useWatchedMutation()
	/** The state Seen. A rated show that was never marked counts as Seen in filters and still reads off here. */
	const seen = entry?.state === "seen"

	/**
	 * Members only: wrap the button in UserAction so a guest gets the sign-in prompt instead. Answers whether the
	 * press was sent.
	 */
	const toggle = useCallback(
		(to?: "add" | "remove"): boolean => {
			const action = to ?? (seen ? "remove" : "add")
			if (action === "remove" && mediaType === "movie" && rated) {
				toast.info(RATED_SO_SEEN)
				return false
			}
			mutate({ mediaType, tmdbId, action })
			return true
		},
		[mutate, mediaType, tmdbId, seen, rated],
	)

	return { seen, tracked: entry !== null, toggle, isPending }
}

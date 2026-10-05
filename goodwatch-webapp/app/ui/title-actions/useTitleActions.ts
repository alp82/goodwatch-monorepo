// One title's marks (score, Want to See, Seen, Not interested) and the actions that change them, for every surface
// that shows the title action set.
import { useCallback } from "react"
import { toast } from "react-toastify"
import { useIsNotInterested, useIsOnWishlist, useIsWatched, useUserScore } from "~/hooks/useUserDataAccessors"
import { useNotInterestedMutation, useWatchedMutation, useWishlistMutation } from "~/hooks/useUserDataMutations"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"

export const SEEN_INSTRUCTIONS = "Your history shows every title you ever have watched."
/** Why Not interested is off for a title the person has seen or scored. */
export const SEEN_SO_NOT_HIDEABLE = "You've seen it. Not interested is for titles you haven't seen."

export function useTitleActions(media: ScoredMedia) {
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id
	const title = media.details.title

	const score = useUserScore(mediaType, tmdbId)?.score ?? null
	const want = useIsOnWishlist(mediaType, tmdbId)
	const seen = useIsWatched(mediaType, tmdbId)
	const hidden = useIsNotInterested(mediaType, tmdbId)

	const { mutate: updateWishlist, isPending: wantPending } = useWishlistMutation()
	const { mutate: updateWatched, isPending: seenPending } = useWatchedMutation()
	const { mutate: updateNotInterested, isPending: hidePending } = useNotInterestedMutation()

	const toggleWant = useCallback(
		() => updateWishlist({ mediaType, tmdbId, action: want ? "remove" : "add" }),
		[updateWishlist, mediaType, tmdbId, want],
	)
	/** Members only: wrap the button in UserAction so a guest gets the sign-in prompt instead. */
	const toggleSeen = useCallback(
		() => updateWatched({ mediaType, tmdbId, action: seen ? "remove" : "add" }),
		[updateWatched, mediaType, tmdbId, seen],
	)

	const unhide = useCallback(
		() =>
			updateNotInterested(
				{ mediaType, tmdbId, action: "remove" },
				{ onError: () => toast.error(`Couldn't bring ${title} back. Please try again.`) },
			),
		[updateNotInterested, mediaType, tmdbId, title],
	)

	/**
	 * Marks the title Not interested, which also takes it off the Wishlist. Returns the undo: it brings the title back,
	 * onto the Wishlist again if it was there (adding Want to See clears Not interested).
	 */
	const hide = useCallback(() => {
		const wasWanted = want
		updateNotInterested(
			{ mediaType, tmdbId, action: "add" },
			// The mutation has already put the title back.
			{ onError: () => toast.error(`Couldn't hide ${title}. Please try again.`) },
		)
		return () => {
			if (wasWanted) updateWishlist({ mediaType, tmdbId, action: "add" })
			else unhide()
		}
	}, [updateNotInterested, updateWishlist, unhide, mediaType, tmdbId, title, want])

	return {
		score,
		want,
		seen,
		hidden,
		/** Not interested means "haven't seen it, don't want to": not offered once the title is seen or scored. */
		canHide: hidden || (!seen && score == null),
		toggleWant,
		toggleSeen,
		hide,
		unhide,
		wantPending,
		seenPending,
		hidePending,
	}
}

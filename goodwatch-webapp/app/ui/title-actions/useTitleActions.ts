// One title's marks (score, Want to See, Seen, Not interested) and the actions that change them, for every surface
// that shows the title action set.
import { useCallback } from "react"
import { toast } from "react-toastify"
import { useFeature } from "~/hooks/useFeature"
import { useSeenToggle } from "~/hooks/useSeenToggle"
import { useIsNotInterested, useIsOnWishlist, useUserScore } from "~/hooks/useUserDataAccessors"
import { useNotInterestedMutation, useWishlistMutation } from "~/hooks/useUserDataMutations"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { pressSeen, warmWatchLog } from "~/ui/watch-log/WatchLogHost"

export const SEEN_INSTRUCTIONS = "Your history shows every title you ever have watched."
/** Why Not interested is off for a title the person has seen or scored. */
export const SEEN_SO_NOT_HIDEABLE = "You've seen it. Not interested is for titles you haven't seen."

export function useTitleActions(media: ScoredMedia) {
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id
	const title = media.details.title

	const score = useUserScore(mediaType, tmdbId)?.score ?? null
	const want = useIsOnWishlist(mediaType, tmdbId)
	// The Seen button shows the state Seen, which is what one more press takes back.
	const { seen, tracked, watches, toggle, isPending: seenPending } = useSeenToggle(mediaType, tmdbId)
	const hidden = useIsNotInterested(mediaType, tmdbId)
	// The movie watch log (REC_TRACKING): the press goes to the log's host, which records a watch for now or, once the
	// movie is Seen, opens the log. A show's button stays the toggle.
	const logged = useFeature("tracking") && mediaType === "movie"

	const { mutate: updateWishlist, isPending: wantPending } = useWishlistMutation()
	const { mutate: updateNotInterested, isPending: hidePending } = useNotInterestedMutation()

	const toggleWant = useCallback(
		() => updateWishlist({ mediaType, tmdbId, action: want ? "remove" : "add" }),
		[updateWishlist, mediaType, tmdbId, want],
	)
	/**
	 * Members only: wrap the button in UserAction so a guest gets the sign-in prompt instead. Answers whether the
	 * press toggled Seen here. With the movie watch log it did not: the log's host takes the press and says what it
	 * did. Pass the click, so the log opens beside the button.
	 */
	const toggleSeen = useCallback(
		(event?: { currentTarget: EventTarget | null }): boolean => {
			if (!logged) return toggle()
			const anchor = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null
			pressSeen({ movie: { tmdbId, title }, anchor, seen })
			return false
		},
		[toggle, logged, tmdbId, title, seen],
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
		/**
		 * Not interested means "haven't seen it, don't want to": offered only while the title is Not started and has
		 * no score.
		 */
		canHide: hidden || (!tracked && score == null),
		/**
		 * What the Seen button gains with the movie watch log, to spread on it: the count from two watches on, that it
		 * opens the log once the movie is Seen, and the fetch of the log's code when the pointer or the focus arrives.
		 */
		seenLog: logged
			? {
					count: watches >= 2 ? `${watches}×` : null,
					opensLog: seen,
					onPointerEnter: warmWatchLog,
					onFocus: warmWatchLog,
				}
			: null,
		toggleWant,
		toggleSeen,
		hide,
		unhide,
		wantPending,
		seenPending,
		hidePending,
	}
}

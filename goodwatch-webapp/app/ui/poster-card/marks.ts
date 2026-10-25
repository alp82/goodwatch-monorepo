// What a poster says about the viewer's own standing with a title: their score, Wishlist, the watch state (a show's
// status, or Seen), and Not interested. Read from the member data; a guest's local actions land there too.
import {
	useIsNotInterested,
	useIsOnWishlist,
	useUserScore,
	useWatchState,
} from "~/hooks/useUserDataAccessors"
import type { TitleMarks } from "./pill-mark"

export {
	type PillMark,
	type TitleMarks,
	type WatchStatus,
	pillMark,
} from "./pill-mark"

export function useTitleMarks(
	mediaType: "movie" | "show",
	tmdbId: number,
): TitleMarks {
	const score = useUserScore(mediaType, tmdbId)?.score ?? null
	const want = useIsOnWishlist(mediaType, tmdbId)
	const status = useWatchState(mediaType, tmdbId)?.state ?? null
	const hidden = useIsNotInterested(mediaType, tmdbId)
	return { score, want, status, hidden }
}

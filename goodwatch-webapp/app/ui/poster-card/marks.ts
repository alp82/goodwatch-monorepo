// What a poster says about the viewer's own standing with a title: their score, Wishlist, the watch state (a show's
// status, or Seen), and Not interested. Read from the member data; a guest's local actions land there too.
import { useUserData } from "~/routes/api.user-data"
import { createMediaKey } from "~/types/user-data"
import type { TitleMarks } from "./pill-mark"

export { type PillMark, type TitleMarks, type WatchStatus, pillMark } from "./pill-mark"

export function useTitleMarks(mediaType: "movie" | "show", tmdbId: number): TitleMarks {
	const { data } = useUserData()
	const key = createMediaKey(mediaType, tmdbId)
	return {
		score: data?.scores[key]?.score ?? null,
		want: data ? key in data.wishlist : false,
		status: data?.watchState[key]?.state ?? null,
		hidden: data ? key in data.notInterested : false,
	}
}

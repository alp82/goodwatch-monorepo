// Watch's counts (the views, the statuses and Seen), from the member data the root loader already read. Null for
// guests: their lists live in the browser, or need an account.
import { useMemo } from "react"
import { type LibraryData, libraryKeys } from "~/domain/my-library"
import { useUserData } from "~/routes/api.user-data"
import { useUser } from "~/utils/auth"
import type { WatchViewCounts } from "./watch-views"

const isShow = (key: string) => key.startsWith("show-")

export function watchCounts(data: LibraryData): WatchViewCounts {
	const want = libraryKeys(data, "want")
	const seen = libraryKeys(data, "seen")
	const seenShows = seen.filter(isShow).length
	return {
		chips: {
			"not-started": want.filter(isShow).length,
			watching: libraryKeys(data, "watching").length,
			"on-hold": libraryKeys(data, "on_hold").length,
			dropped: libraryKeys(data, "dropped").length,
			wishlist: want.length,
		},
		seenShows,
		seenMovies: seen.length - seenShows,
	}
}

export function useWatchCounts(): WatchViewCounts | null {
	const { user } = useUser()
	const { data } = useUserData()
	return useMemo(
		() =>
			user && data?.wishlist && data.watchState && data.scores
				? watchCounts(data)
				: null,
		[user, data],
	)
}

// Watch: what you watch next and what you watched. The layout draws the area's three two-line tabs (Up next /
// My shows, Ready to watch / My movies, Recommendations / For you), sticky under the header, then the "To watch |
// Seen" switch and the chips under To watch, all chosen from the path, then the page. It has no loader: the counts
// come from the member data the root loader already read, the new-episodes badge from the navigation's own read.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Outlet, useLocation } from "@remix-run/react"
import { useMemo } from "react"
import { type LibraryData, libraryKeys } from "~/domain/my-library"
import { useUserData } from "~/routes/api.user-data"
import { AreaTabs, ChipRow, ChoiceSwitch } from "~/ui/navigation/AreaTabs"
import {
	type WatchChipKey,
	seenSwitch,
	watchChips,
	watchPlaceOf,
	watchTabs,
} from "~/ui/navigation/areas"
import { useNewEpisodes } from "~/ui/navigation/useNewEpisodes"
import { useUser } from "~/utils/auth"

interface WatchCounts {
	chips: Partial<Record<WatchChipKey, number>>
	seenShows: number
	seenMovies: number
}

const isShow = (key: string) => key.startsWith("show-")

/** The chip and Seen counts, from the member's data alone. */
function watchCounts(data: LibraryData): WatchCounts {
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

const PLACE_NAME: Record<string, string> = {
	"next-episodes": "Next episodes",
	"not-started": "Not started",
	watching: "Watching",
	"on-hold": "On hold",
	dropped: "Dropped",
	tonight: "Tonight",
	wishlist: "Whole Wishlist",
	recent: "Recently added",
}

export default function WatchLayout() {
	const { pathname } = useLocation()
	const { user } = useUser()
	const { data } = useUserData()
	const fresh = useNewEpisodes()
	// Guests get no counts: their lists live in the browser, or need an account.
	const counts = useMemo(
		() =>
			user && data?.wishlist && data.watchState && data.scores
				? watchCounts(data)
				: null,
		[user, data],
	)
	const place = watchPlaceOf(pathname)
	const tabs = watchTabs(pathname).map((tab) =>
		tab.key === "up-next" && fresh
			? { ...tab, news: { badge: fresh.badge, label: fresh.door } }
			: tab,
	)
	const seen = seenSwitch(
		pathname,
		counts
			? place?.tab === "up-next"
				? counts.seenShows
				: counts.seenMovies
			: undefined,
	)
	const chips = watchChips(pathname, counts?.chips)
	const here = tabs.find((tab) => tab.here)
	const name =
		place?.side === "seen"
			? "Seen"
			: place?.chip
				? PLACE_NAME[place.chip]
				: null
	return (
		<>
			<AreaTabs label="Watch" icon={PlayIcon} tabs={tabs} />
			<h1 className="sr-only">
				{[here ? `${here.label}: ${here.sub}` : "Watch", name]
					.filter(Boolean)
					.join(", ")}
			</h1>
			{(seen || chips) && (
				<div className="pt-4" data-watch-choices>
					{seen && <ChoiceSwitch choices={seen} />}
					{chips && <ChipRow choices={chips} />}
				</div>
			)}
			<Outlet />
		</>
	)
}

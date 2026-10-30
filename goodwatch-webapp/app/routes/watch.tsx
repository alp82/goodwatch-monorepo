// Watch: what you watch next and what you watched. The layout draws the area's two-line tabs (Up next / My shows,
// Ready to watch / My movies, Recommendations / For you), sticky under the header, then the way to the tab's views,
// all chosen from the path, then the page. Where Seen sits is a round 8 option (ui/watch/watch-views.ts): a last chip
// (seen=chip), a fourth tab (seen=tab), or one view picker (seen=picker). It has no loader: the counts come from the
// member data the root loader already read, the new-episodes badge from the navigation's own read.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Outlet, useLocation } from "@remix-run/react"
import { useMemo } from "react"
import { type LibraryData, libraryKeys } from "~/domain/my-library"
import { useUserData } from "~/routes/api.user-data"
import { AreaTabs, ChipRow } from "~/ui/navigation/AreaTabs"
import { useNavOptions } from "~/ui/navigation/nav-options"
import { useNewEpisodes } from "~/ui/navigation/useNewEpisodes"
import { ViewPicker } from "~/ui/watch/ViewPicker"
import { WatchChips } from "~/ui/watch/WatchChips"
import {
	type WatchViewCounts,
	seenTab,
	watchTabsFor,
	watchViews,
} from "~/ui/watch/watch-views"
import { useUser } from "~/utils/auth"

const isShow = (key: string) => key.startsWith("show-")

/** The chip and Seen counts, from the member's data alone. */
function watchCounts(data: LibraryData): WatchViewCounts {
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

export default function WatchLayout() {
	const { pathname } = useLocation()
	const { user } = useUser()
	const { data } = useUserData()
	const fresh = useNewEpisodes()
	const { seen: option } = useNavOptions()
	// Guests get no counts: their lists live in the browser, or need an account.
	const counts = useMemo(
		() =>
			user && data?.wishlist && data.watchState && data.scores
				? watchCounts(data)
				: null,
		[user, data],
	)
	const tabs = watchTabsFor(pathname, option).map((tab) =>
		tab.key === "up-next" && fresh
			? { ...tab, news: { badge: fresh.badge, label: fresh.door } }
			: tab,
	)
	// OPTION seen=tab: Seen is the fourth tab, set a little apart at the row's end.
	const history = option === "tab" ? seenTab(pathname, option) : null
	const views = watchViews(pathname, option, counts)
	const here = history?.here ? history : tabs.find((tab) => tab.here)
	const name = here === history ? null : views?.current.label
	return (
		<>
			{history ? (
				// The trailing tab sits right after the three, not at the far end (`ml-auto` off): a little apart.
				<div className="contents [&>nav>div>span.ml-auto]:ml-0">
					<AreaTabs
						label="Watch"
						icon={PlayIcon}
						tabs={tabs}
						trailing={[history]}
					/>
				</div>
			) : (
				<AreaTabs label="Watch" icon={PlayIcon} tabs={tabs} />
			)}
			<h1 className="sr-only">
				{[here ? `${here.label}: ${here.sub}` : "Watch", name]
					.filter(Boolean)
					.join(", ")}
			</h1>
			{views && option === "chip" && (
				// OPTION seen=chip
				<div className="pt-4" data-watch-choices>
					<WatchChips views={views} />
				</div>
			)}
			{views && option === "tab" && (
				// OPTION seen=tab: the to-watch chips alone.
				<div className="pt-4" data-watch-choices>
					<ChipRow
						choices={{
							label:
								views.tab === "up-next" ? "Shows to watch" : "Movies to watch",
							choices: views.toWatch,
						}}
					/>
				</div>
			)}
			{/* OPTION seen=picker */}
			{views && option === "picker" && <ViewPicker views={views} />}
			{history?.here && <div className="pt-4" aria-hidden />}
			<Outlet />
		</>
	)
}

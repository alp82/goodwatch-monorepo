// Watch: what you watch next and what you watched. The layout draws the area's two-line tabs (My shows / Up next,
// My movies / Ready to watch, Recommendations / Curated For You, and Seen / History at the row's end on desktop), sticky under
// the header, then the tab's third level, all chosen from the path, then the page:
// - Ready to watch: SubNav with Tonight · Whole Wishlist · Recently added.
// - Seen: SubNav with All · Movies · Shows (`?type=` on /watch/seen).
// - Up next: SubNav with Next episodes | All shows (the status pages, each with a status filter).
// It has no loader: the counts come from the member data the root loader already read, the new-episodes badge from
// the navigation's own read.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Outlet, useLocation } from "@remix-run/react"
import { AreaTabs } from "~/ui/navigation/AreaTabs"
import { SubNav } from "~/ui/navigation/SubNav"
import { useNewEpisodes } from "~/ui/navigation/useNewEpisodes"
import { useWatchCounts } from "~/ui/watch/useWatchCounts"
import {
	readyViews,
	seenKinds,
	seenTab,
	upNextSplit,
	upNextViews,
	watchTabsFor,
} from "~/ui/watch/watch-views"

export default function WatchLayout() {
	const { pathname, search } = useLocation()
	const fresh = useNewEpisodes()
	const counts = useWatchCounts()
	const tabs = watchTabsFor(pathname).map((tab) =>
		tab.key === "up-next" && fresh
			? { ...tab, news: { badge: fresh.badge, label: fresh.door } }
			: tab,
	)
	const history = seenTab(pathname)
	const upNext = upNextViews(pathname, counts)
	const ready = readyViews(pathname, counts)
	const sub = history.here
		? { label: "Seen: movies or shows", items: seenKinds(search, counts) }
		: ready
			? { label: "Movies to watch", items: ready }
			: upNext
				? { label: "Your shows", items: upNextSplit(upNext) }
				: null
	const here = history.here ? history : tabs.find((tab) => tab.here)
	const view = sub?.items.find((item) => item.here)?.label
	return (
		<>
			<AreaTabs
				label="Watch"
				icon={PlayIcon}
				area="watch"
				tabs={tabs}
				trailing={[history]}
				trailingEnd="desktop"
			/>
			<h1 className="sr-only">
				{[here ? `${here.label}: ${here.sub}` : "Watch", view]
					.filter(Boolean)
					.join(", ")}
			</h1>
			{sub && <SubNav label={sub.label} items={sub.items} under="two" />}
			<div className="pt-4" aria-hidden />
			<Outlet />
		</>
	)
}

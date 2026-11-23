// Watch: what you watch next and what you watched. The layout draws the area's two-line tabs (My shows / Up next,
// My movies / Ready to watch, Recommendations / Curated For You, and Seen / History at the row's end on desktop), sticky under
// the header, then the tab's third level, all chosen from the path, then the page:
// - Ready to watch: SubNav with Next Movie · Want to Watch.
// - Seen: Movies & Shows switch (`?type=` on /watch/seen).
// - Up next: SubNav with Next episodes | All shows (the status pages, each with a status filter).
// It has no loader: the counts come from the member data the root loader already read, the new-episodes badge from
// the navigation's own read.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Outlet, useLocation } from "@remix-run/react"
import { KindControl } from "~/ui/browse/KindControl"
import { STICKY_SUBBAR } from "~/ui/layers"
import { SUBNAV_BAR } from "~/ui/navigation/bar-layers"
import { AreaTabs, UNDER_TABS } from "~/ui/navigation/AreaTabs"
import { SubNav } from "~/ui/navigation/SubNav"
import { useWatchNews } from "~/ui/navigation/useWhatsNew"
import { withWatchNews } from "~/ui/navigation/watch-news"
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
	const news = useWatchNews()
	const counts = useWatchCounts()
	const tabs = withWatchNews(watchTabsFor(pathname), news)
	const history = seenTab(pathname)
	const upNext = upNextViews(pathname, counts, news.shows)
	const ready = readyViews(pathname, counts, news.movies)
	const kinds = history.here ? seenKinds(search, counts) : null
	const sub = ready
		? { label: "Movies to watch", items: ready }
		: upNext
			? { label: "Your shows", items: upNextSplit(upNext) }
			: null
	const here = history.here ? history : tabs.find((tab) => tab.here)
	const view = (kinds ?? sub?.items)?.find((item) => item.here)?.label
	return (
		<>
			<AreaTabs
				label="Watch"
				icon={PlayIcon}
				tabs={tabs}
				trailing={[history]}
				trailingEnd="desktop"
			/>
			<h1 className="sr-only">
				{[here ? `${here.label}: ${here.sub}` : "Watch", view].filter(Boolean).join(", ")}
			</h1>
			{kinds && (
				<div className={`lg:sticky ${UNDER_TABS.two} ${STICKY_SUBBAR} ${SUBNAV_BAR}`}>
					<div className="mx-auto flex h-11 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
						<KindControl
							kinds={kinds.map((k) => ({
								kind: k.key,
								label: k.label,
								href: k.href,
								on: k.here,
								count: k.count,
							}))}
						/>
					</div>
				</div>
			)}
			{!kinds && sub && (
				<SubNav
					label={sub.label}
					items={sub.items}
					under="two"
					phoneItems={upNext && !history.here && !ready ? upNext : undefined}
				/>
			)}
			<div className="pt-4" aria-hidden />
			<Outlet />
		</>
	)
}

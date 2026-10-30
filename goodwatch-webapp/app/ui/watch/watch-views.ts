// Watch's views and where Seen sits among them (member nav round 8, PROTOTYPE OPTIONS seen=chip|tab|picker). Pure:
// app/routes/watch.tsx and the components in this folder read from here.
//
// A view is one page of a Watch tab: Up next has Next episodes, Not started, Watching, On hold, Dropped and Seen;
// Ready to watch has Tonight, Whole Wishlist, Recently added and Seen. The options differ only in how Seen is reached:
// - chip: one chip row, the to-watch chips, a thin divider, then Seen. Seen pages keep the row with Seen lit.
// - tab: Seen is a fourth Watch tab, /watch/seen, with every title you watched. The kind filter on that page picks
//   Movies or Shows (`?type=`); /watch/movies/seen goes to /watch/seen?type=movie.
// - picker: no chips. One "Showing [view]" menu lists the to-watch views, then Seen.
import { ClockIcon } from "@heroicons/react/24/outline"
import { WATCH_PATHS, watchSeenPath } from "../../domain/member-paths.ts"
import {
	type AreaTab,
	type NavChoice,
	type WatchChipKey,
	type WatchTabKey,
	watchChips,
	watchPlaceOf,
	watchTabs,
} from "../navigation/areas.ts"

export type SeenOption = "chip" | "tab" | "picker"

/** Counts for the views, from the member's data. Guests have none. */
export interface WatchViewCounts {
	chips: Partial<Record<WatchChipKey, number>>
	seenShows: number
	seenMovies: number
}

/** One tab's views: the to-watch ones, then Seen. */
export interface WatchViews {
	tab: "up-next" | "ready"
	/** What screen readers hear for the group. */
	label: string
	toWatch: NavChoice[]
	seen: NavChoice
	/** The view the page shows. */
	current: NavChoice
}

const trim = (pathname: string) =>
	pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname

/** True on the Seen tab's page (seen=tab): /watch/seen. */
export const onSeenTab = (pathname: string, option: SeenOption) =>
	option === "tab" && trim(pathname) === WATCH_PATHS.showsSeen

/** The Watch tab a page belongs to under an option: on seen=tab, /watch/seen is the Seen tab, not Up next. */
export function watchTabOf(
	pathname: string,
	option: SeenOption,
): WatchTabKey | "seen" | null {
	if (onSeenTab(pathname, option)) return "seen"
	return watchPlaceOf(pathname)?.tab ?? null
}

/** The fourth tab (seen=tab): "Seen" over "History", with a clock, every title you watched. */
export function seenTab(pathname: string, option: SeenOption): AreaTab {
	return {
		key: "seen",
		label: "Seen",
		icon: ClockIcon,
		sub: "History",
		href: WATCH_PATHS.showsSeen,
		here: onSeenTab(pathname, option),
	}
}

/** Watch's tabs under an option: on the Seen tab's page, none of the three is current. */
export function watchTabsFor(pathname: string, option: SeenOption): AreaTab[] {
	const tabs = watchTabs(pathname)
	return onSeenTab(pathname, option)
		? tabs.map((tab) => ({ ...tab, here: false }))
		: tabs
}

/**
 * The current tab's views, with the page's view current. Null on For you, outside Watch, and on the Seen tab's page.
 * Leave `counts` out for guests.
 */
export function watchViews(
	pathname: string,
	option: SeenOption,
	counts?: WatchViewCounts | null,
): WatchViews | null {
	if (onSeenTab(pathname, option)) return null
	const place = watchPlaceOf(pathname)
	if (!place || place.side === null) return null
	const shows = place.tab === "up-next"
	const path = trim(pathname)
	const all = watchChips(
		shows ? WATCH_PATHS.nextEpisodes : WATCH_PATHS.tonight,
		counts?.chips,
	)
	const toWatch = (all?.choices ?? []).map((choice) => ({
		...choice,
		here: choice.href === path,
	}))
	const seenHref = watchSeenPath(shows ? "show" : "movie")
	const seen: NavChoice = {
		key: "seen",
		label: "Seen",
		href: seenHref,
		here: path === seenHref,
		count: counts ? (shows ? counts.seenShows : counts.seenMovies) : undefined,
	}
	const current = seen.here ? seen : (toWatch.find((c) => c.here) ?? toWatch[0])
	return {
		tab: place.tab as "up-next" | "ready",
		label: shows ? "Your shows" : "Your movies",
		toWatch,
		seen,
		current,
	}
}

/**
 * Where /watch/movies/seen goes under seen=tab: the Seen tab with Movies picked, the rest of the query kept. Null
 * under the other options, where the page stays.
 */
export function moviesSeenMove(
	search: string,
	option: SeenOption,
): string | null {
	if (option !== "tab") return null
	const params = new URLSearchParams(search)
	params.set("type", "movie")
	return `${WATCH_PATHS.showsSeen}?${params}`
}

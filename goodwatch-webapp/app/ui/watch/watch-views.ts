// Watch's tabs and the views under them. Pure: app/routes/watch.tsx and the components in this
// folder read from here.
//
// Four tabs: Up next, Ready to watch, Recommendations, and Seen (/watch/seen, every title you watched, set at the row's
// end on desktop). Ready to watch's views (Next Movie · Want to Watch) and Seen's kinds (All · Movies · Shows) are
// SubNav rows. Up next's SubNav is Next episodes | All shows; All shows is the status pages (Watching · Start ·
// On hold · Dropped, /watch/shows/watching first), each with a status filter in the list's controls.
import { ClockIcon } from "@heroicons/react/24/outline"
import { WATCH_PATHS } from "../../domain/member-paths.ts"
import {
	type AreaTab,
	type NavChoice,
	type WatchChipKey,
	type WatchTabKey,
	watchChips,
	watchPlaceOf,
	watchTabs,
} from "../navigation/areas.ts"

/** Counts for the views, from the member's data. Guests have none. */
export interface WatchViewCounts {
	chips: Partial<Record<WatchChipKey, number>>
	seenShows: number
	seenMovies: number
}

const trim = (pathname: string) =>
	pathname.length > 1 && pathname.endsWith("/")
		? pathname.slice(0, -1)
		: pathname

/** True on the Seen tab's page: /watch/seen. */
export const onSeenTab = (pathname: string) =>
	trim(pathname) === WATCH_PATHS.showsSeen

/** The Watch tab a page belongs to: /watch/seen is the Seen tab. */
export function watchTabOf(pathname: string): WatchTabKey | "seen" | null {
	if (onSeenTab(pathname)) return "seen"
	return watchPlaceOf(pathname)?.tab ?? null
}

/** The fourth tab: "Seen" over "History", with a clock, every title you watched. */
export function seenTab(pathname: string): AreaTab {
	return {
		key: "seen",
		label: "Seen",
		icon: ClockIcon,
		sub: "History",
		href: WATCH_PATHS.showsSeen,
		here: onSeenTab(pathname),
	}
}

/** Watch's first three tabs: on the Seen tab's page, none of them is current. */
export function watchTabsFor(pathname: string): AreaTab[] {
	const tabs = watchTabs(pathname)
	return onSeenTab(pathname)
		? tabs.map((tab) => ({ ...tab, here: false }))
		: tabs
}

/** Up next's views: Next episodes, then the four statuses, with the page's view current. Null off Up next. */
export function upNextViews(
	pathname: string,
	counts?: WatchViewCounts | null,
): NavChoice[] | null {
	if (watchTabOf(pathname) !== "up-next") return null
	return (
		watchChips(WATCH_PATHS.nextEpisodes, counts?.chips)?.choices ?? []
	).map((choice) => ({ ...choice, here: choice.href === trim(pathname) }))
}

/** Ready to watch's views (Next Movie · Want to Watch). Null off Ready to watch. */
export function readyViews(
	pathname: string,
	counts?: WatchViewCounts | null,
): NavChoice[] | null {
	if (watchTabOf(pathname) !== "ready") return null
	return (watchChips(WATCH_PATHS.tonight, counts?.chips)?.choices ?? []).map(
		(choice) => ({ ...choice, here: choice.href === trim(pathname) }),
	)
}

/** The status pages All shows covers: every Up next view but Next episodes. */
export const statusViews = (views: NavChoice[]) =>
	views.filter((view) => view.key !== "next-episodes")

/** All shows' address: Watching, the status a member opens most. */
export const ALL_SHOWS_PATH = WATCH_PATHS.watching

/** Up next's SubNav: Next episodes | All shows, All shows current on every status page. */
export function upNextSplit(views: NavChoice[]): NavChoice[] {
	const statuses = statusViews(views)
	const counted = statuses.every((view) => view.count != null)
	return [
		views[0],
		{
			key: "all-shows",
			label: "All shows",
			href: ALL_SHOWS_PATH,
			here: statuses.some((view) => view.here),
			count: counted
				? statuses.reduce((sum, view) => sum + (view.count ?? 0), 0)
				: undefined,
		},
	]
}

/** The Seen tab's kinds: All · Movies · Shows as `?type=` on /watch/seen, the rest of the query kept. */
export function seenKinds(
	search: string,
	counts?: WatchViewCounts | null,
): NavChoice[] {
	const params = new URLSearchParams(search)
	const type = params.get("type")
	const here = type === "movie" || type === "show" ? type : "all"
	const href = (kind: "all" | "movie" | "show") => {
		const next = new URLSearchParams(params)
		if (kind === "all") next.delete("type")
		else next.set("type", kind)
		const query = next.toString()
		return query ? `${WATCH_PATHS.showsSeen}?${query}` : WATCH_PATHS.showsSeen
	}
	return [
		{
			key: "all",
			label: "All",
			href: href("all"),
			here: here === "all",
			count: counts ? counts.seenMovies + counts.seenShows : undefined,
		},
		{
			key: "movie",
			label: "Movies",
			href: href("movie"),
			here: here === "movie",
			count: counts?.seenMovies,
		},
		{
			key: "show",
			label: "Shows",
			href: href("show"),
			here: here === "show",
			count: counts?.seenShows,
		},
	]
}

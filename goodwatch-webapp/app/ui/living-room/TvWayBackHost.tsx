// The way back to the TV, as far as every page has to carry it. A person who left the living room through its TV
// (tv-transition.ts) gets a TV button only on the page it opened: on the desktop in a tab under
// the header, on a phone in the dock in place of its left part. All a first view loads of that is this file: a
// look into sessionStorage after hydration. The button itself (TvWayBack.tsx) is fetched when a person leaves
// through the TV, or on the reload of a page they reached that way.
import { useLocation } from "@remix-run/react"
import { Suspense, lazy, useEffect, useState } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { TRIP_KEY, type TvTrip, pagesFromTv, parseTrip, wayBackShows } from "./tv-way-back"

const loadWayBack = reloadOnStaleChunk(() => import("./TvWayBack"))
const TvWayBackBar = lazy(() => loadWayBack().then((module) => ({ default: module.TvWayBackBar })))
const TvBackKey = lazy(() => loadWayBack().then((module) => ({ default: module.TvBackKey })))

/** Fetches the TV button's code ahead of the page it will stand on. Called when a person leaves through the TV. */
export function warmTvWayBack() {
	void loadWayBack().catch(() => {})
}

export type TvWayBack = { trip: TvTrip; pages: number }

/**
 * The trip and how many pages the person is from the TV, while the TV button shows; `null` everywhere else, on the
 * server and before hydration, so the server's markup is the same for everyone.
 */
export function useTvWayBack(): TvWayBack | null {
	const { key, pathname } = useLocation()
	const [wayBack, setWayBack] = useState<TvWayBack | null>(null)
	// `key`: it changes with every history entry, also on the same path.
	useEffect(() => {
		let trip: TvTrip | null = null
		try {
			trip = parseTrip(sessionStorage.getItem(TRIP_KEY))
			const pages = pagesFromTv(trip, (window.history.state as { idx?: number } | null)?.idx ?? 0, pathname)
			// The browser's Forward leads onto these pages again after a return: the room must know on the next Back.
			if (trip && pages >= 1 && !trip.out) sessionStorage.setItem(TRIP_KEY, JSON.stringify({ ...trip, out: true }))
			setWayBack(trip && wayBackShows(pages) ? { trip, pages } : null)
		} catch {
			setWayBack(null)
		}
	}, [key, pathname])
	return wayBack
}

/** In the app shell: the desktop's tab under the header, and the keys that lead back (Escape, the browser's Back). */
export function TvWayBackHost() {
	const wayBack = useTvWayBack()
	if (!wayBack) return null
	return (
		<Suspense fallback={null}>
			<TvWayBackBar pages={wayBack.pages} art={wayBack.trip.art} />
		</Suspense>
	)
}

/** In the phone's dock, in place of its left part. The place is kept while the button's code arrives. */
export function TvBackDockKey({ wayBack }: { wayBack: TvWayBack }) {
	return (
		<Suspense fallback={null}>
			<TvBackKey pages={wayBack.pages} art={wayBack.trip.art} />
		</Suspense>
	)
}

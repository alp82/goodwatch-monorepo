// A sub-page's way back to its title page. When the history entry before it is the title page it opened from, Back
// is a step back in the history, so the title page comes back exactly as it was left (way-in.ts restores its place).
// On a direct load or a shared link it is a plain link to the title page. Either way, going back marks the
// transition's way out before the router replays it.
import { useLocation } from "@remix-run/react"
import { type MouseEvent, useEffect, useMemo } from "react"
import { useHydrated } from "~/utils/hydrated"
import {
	canAnimate,
	ensureTransitionCss,
	entryIdx,
	entryKey,
	markTransition,
	readTrip,
	unmarkTransition,
} from "./way-in"

export interface WayBack {
	/** The title page's address: where it was left, or its own path. */
	to: string
	/** Steps back in the history instead when the title page is the entry before this one. */
	onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/** Whether the entry before this one is the title page this sub-page opened from. */
export function openedFromTitlePage() {
	const trip = readTrip()
	return (
		!!trip &&
		trip.to === window.location.pathname &&
		trip.fromIdx === entryIdx() - 1
	)
}

export function useWayBack(titlePath: string): WayBack {
	const { pathname, key } = useLocation()
	// The server's HTML and its hydration link the title page's own path; where it was left counts from then on.
	const hydrated = useHydrated()

	useEffect(() => {
		ensureTransitionCss()
		const onPop = () => {
			const trip = readTrip()
			if (!trip || trip.to !== pathname || trip.fromKey !== entryKey()) return
			if (canAnimate()) markTransition("out")
			else unmarkTransition()
		}
		window.addEventListener("popstate", onPop)
		return () => window.removeEventListener("popstate", onPop)
	}, [pathname])

	return useMemo(() => {
		const trip = hydrated ? readTrip() : null
		const opened =
			trip && trip.to === pathname && trip.fromIdx === entryIdx() - 1
		return {
			to: opened ? trip.from : titlePath,
			onClick: (e: MouseEvent<HTMLAnchorElement>) => {
				if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
					return
				if (!openedFromTitlePage()) return
				e.preventDefault()
				window.history.back()
			},
		}
	}, [titlePath, pathname, key, hydrated])
}

import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect, useRef } from "react"
import {
	type Context,
	emptyContext,
	isDiscovery,
	offsetOf,
	remember,
	restoredEntry,
} from "~/ui/discovery-continuity"
import { TRIP_KEY, openedByTv, parseTrip } from "~/ui/living-room/tv-way-back"

const key = "goodwatch_discovery"
/** Scroll positions are written at most this often; `pagehide` and leaving the page write the last one. */
const SAVE_EVERY = 250

function read(): Context {
	try {
		const stored = JSON.parse(
			localStorage.getItem(key) || "null",
		) as Context | null
		return stored
			? {
					...stored,
					routes: stored.routes ?? {},
					positions: stored.positions ?? {},
				}
			: emptyContext()
	} catch {
		return emptyContext()
	}
}
/** This arrival is the page the living room's TV just opened (tv-way-back.ts): it starts at its top. */
function arrivedThroughTv(pathname: string) {
	try {
		return openedByTv(
			parseTrip(sessionStorage.getItem(TRIP_KEY)),
			(window.history.state as { idx?: number } | null)?.idx ?? 0,
			pathname,
		)
	} catch {
		return false
	}
}

export function DiscoveryContinuity() {
	const location = useLocation()
	const navigate = useNavigate()
	const previousPath = useRef<string | null>(null)
	// A followed link to a listing's entry point goes straight to its last filters. Resolving it at the click means one
	// page change and one loader run, and the unfiltered page never shows. The capture phase runs before the Link's own
	// handler, which skips a click whose default is prevented.
	useEffect(() => {
		const follow = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			)
				return
			const link = (event.target as Element | null)?.closest?.("a[href]")
			if (!(link instanceof HTMLAnchorElement)) return
			if (
				(link.target && link.target !== "_self") ||
				link.hasAttribute("download")
			)
				return
			if (link.origin !== window.location.origin || link.hash) return
			const target = restoredEntry(link.pathname, link.search, read())
			if (!target) return
			event.preventDefault()
			navigate(target)
		}
		document.addEventListener("click", follow, true)
		return () => document.removeEventListener("click", follow, true)
	}, [navigate])
	useEffect(() => {
		const entering = previousPath.current !== location.pathname
		previousPath.current = location.pathname
		if (!isDiscovery(location.pathname)) return
		const url = location.pathname + location.search
		const stored = read()
		// A page the TV opened starts at its top with what the TV sent, not where or how an earlier visit left it.
		const fromTv = entering && arrivedThroughTv(location.pathname)
		// An entry point that was not opened by a followed link (a document load, the back button, a navigate call)
		// still gets its last filters. A client-side replace keeps the document, so this costs one loader run, not a
		// reload of the whole page.
		const restored =
			entering && !fromTv
				? restoredEntry(location.pathname, location.search, stored)
				: null
		if (restored) {
			navigate(restored, { replace: true })
			return
		}
		// The start page keeps its own place: it moves between the living room and the section below it by its own
		// rules (ui/living-room/use-below-room.ts), and the TV changes the query on every step. A position restored
		// here would move the page under the Remote, or against the room's lock.
		const ownPlace = location.pathname === "/"
		const target = ownPlace || fromTv ? 0 : stored.positions[url] || 0
		let restoring = target > 0
		let frame = 0
		const started = performance.now()
		const restore = () => {
			if (!restoring) return
			window.scrollTo({ top: target, behavior: "instant" })
			if (
				Math.abs(window.scrollY - target) < 2 ||
				performance.now() - started > 5000
			)
				restoring = false
			else frame = requestAnimationFrame(restore)
		}
		frame = requestAnimationFrame(restore)
		let pending = 0
		// Every save reads the offset through this, the last one in the cleanup after a page change too.
		const offset = offsetOf(url, window)
		const save = () => {
			window.clearTimeout(pending)
			pending = 0
			const y = offset()
			if (restoring) return
			const next = remember(read(), location.pathname, url, ownPlace ? 0 : y)
			try {
				localStorage.setItem(key, JSON.stringify(next))
			} catch {}
		}
		// Reading and writing the whole history on every scroll event costs a frame on a slow phone.
		const scrolled = () => {
			offset()
			if (!pending) pending = window.setTimeout(save, SAVE_EVERY)
		}
		const cancelRestore = () => {
			restoring = false
		}
		const timer = window.setTimeout(save, 100)
		window.addEventListener("scroll", scrolled, { passive: true })
		window.addEventListener("pagehide", save)
		window.addEventListener("wheel", cancelRestore, { passive: true })
		window.addEventListener("touchstart", cancelRestore, { passive: true })
		return () => {
			save()
			clearTimeout(timer)
			cancelAnimationFrame(frame)
			window.removeEventListener("scroll", scrolled)
			window.removeEventListener("pagehide", save)
			window.removeEventListener("wheel", cancelRestore)
			window.removeEventListener("touchstart", cancelRestore)
		}
	}, [location.pathname, location.search, navigate])
	return null
}

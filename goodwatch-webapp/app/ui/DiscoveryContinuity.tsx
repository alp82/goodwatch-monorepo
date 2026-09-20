import { useEffect, useRef } from "react"
import { useLocation } from "@remix-run/react"

const key = "goodwatch_discovery"
type Visit = { url: string; y: number }
type Context = {
	last?: Visit
	routes: Record<string, Visit>
	positions: Record<string, number>
}
function read(): Context {
	try {
		return (
			JSON.parse(localStorage.getItem(key) || "null") || {
				routes: {},
				positions: {},
			}
		)
	} catch {
		return { routes: {}, positions: {} }
	}
}
// No auth/account screens: a failed login must not replace the discovery return target.
const isDiscovery = (path: string) =>
	path === "/" ||
	/^\/(taste|discover|wishlist|search|movie|show|movies|shows|explore|lists|categories)(\/|$)/.test(
		path,
	)
export function DiscoveryContinuity() {
	const location = useLocation()
	const previousPath = useRef<string | null>(null)
	useEffect(() => {
		const entering = previousPath.current !== location.pathname
		previousPath.current = location.pathname
		if (import.meta.env.DEV && new URLSearchParams(location.search).get("searchJourney") === "1") return
		if (!isDiscovery(location.pathname)) return
		const url = location.pathname + location.search
		const stored = read()
		const previous = stored.routes[location.pathname]
		// Restore a listing's last filters when revisiting its unqualified entry point.
		if (
			entering &&
			!location.pathname.startsWith("/taste") &&
			!location.search &&
			previous?.url.includes("?") &&
			!/^\/(movie|show)\//.test(location.pathname) &&
			location.pathname !== "/"
		) {
			window.location.replace(previous.url)
			return
		}
		const target = stored.positions[url] || 0
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
		const save = () => {
			if (restoring) return
			const context = read()
			const visit = { url, y: window.scrollY }
			context.last = visit
			context.routes[location.pathname] = visit
			context.positions[url] = visit.y
			// Bound snapshots to recent routes.
			context.positions = Object.fromEntries(
				Object.entries(context.positions).slice(-100),
			)
			try {
				localStorage.setItem(key, JSON.stringify(context))
			} catch {}
		}
		const cancelRestore = () => {
			restoring = false
		}
		const timer = window.setTimeout(save, 100)
		window.addEventListener("scroll", save, { passive: true })
		window.addEventListener("pagehide", save)
		window.addEventListener("wheel", cancelRestore, { passive: true })
		window.addEventListener("touchstart", cancelRestore, { passive: true })
		return () => {
			save()
			clearTimeout(timer)
			cancelAnimationFrame(frame)
			window.removeEventListener("scroll", save)
			window.removeEventListener("pagehide", save)
			window.removeEventListener("wheel", cancelRestore)
			window.removeEventListener("touchstart", cancelRestore)
		}
	}, [location.pathname, location.search])
	return null
}

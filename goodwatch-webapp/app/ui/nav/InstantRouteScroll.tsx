import { useLocation } from "@remix-run/react"
import { useContext, useEffect, useLayoutEffect, useRef } from "react"
import { UNSAFE_DataRouterStateContext } from "react-router-dom"

// React warns about a layout effect on the server, where it never runs anyway.
const useBeforePaint =
	typeof document === "undefined" ? useEffect : useLayoutEffect

/**
 * Make route resets and saved-position restoration jump instead of following the document's smooth scroll rule.
 * Query changes that preserve the current scroll need no root style writes; those writes invalidate the whole page.
 * Hash-only links remain smooth. Render before <ScrollRestoration /> so this layout effect precedes its scroll.
 */
export function InstantRouteScroll() {
	const location = useLocation()
	// React Router 6 exposes these committed flags only through its exported state context. useNavigation is already
	// idle when the new route commits, and useNavigationType cannot distinguish a scroll-preserving query replacement.
	const scroll = useContext(UNSAFE_DataRouterStateContext)
	const shown = useRef(location)
	useBeforePaint(() => {
		const previous = shown.current
		if (previous === location) return
		shown.current = location
		const saved = typeof scroll?.restoreScrollPosition === "number"
		const samePage =
			previous.pathname + previous.search ===
			location.pathname + location.search
		if (scroll?.restoreScrollPosition === false) return
		if (samePage && !saved) return
		if (
			previous.pathname === location.pathname &&
			scroll?.preventScrollReset === true &&
			!saved &&
			!location.hash
		)
			return

		const html = document.documentElement
		const before = html.style.getPropertyValue("scroll-behavior")
		const priority = html.style.getPropertyPriority("scroll-behavior")
		html.style.scrollBehavior = "auto"
		// Chrome can skip the style update for a scroll to (0, 0), so flush the override before restoration reads it.
		getComputedStyle(html).scrollBehavior
		let restored = false
		const restore = () => {
			if (restored) return
			restored = true
			// Another feature may have taken ownership while the route's effects ran.
			if (html.style.scrollBehavior !== "auto") return
			if (before) html.style.setProperty("scroll-behavior", before, priority)
			else html.style.removeProperty("scroll-behavior")
		}
		// The new page's own arrival effects can scroll too. Cancel both frames when another route supersedes it.
		let second = 0
		const first = requestAnimationFrame(() => {
			second = requestAnimationFrame(restore)
		})
		return () => {
			cancelAnimationFrame(first)
			cancelAnimationFrame(second)
			restore()
		}
	}, [location, scroll?.preventScrollReset, scroll?.restoreScrollPosition])
	return null
}

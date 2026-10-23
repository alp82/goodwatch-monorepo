import { useLocation } from "@remix-run/react"
import { useEffect, useLayoutEffect, useRef } from "react"

// React warns about a layout effect on the server, where it never runs anyway.
const useBeforePaint =
	typeof document === "undefined" ? useEffect : useLayoutEffect

/**
 * The document scrolls smoothly (`scroll-smooth` on <html>), which suits a link to a section of the same page. After
 * a page change, though, Remix's ScrollRestoration would slide the new page up from the old offset. For the commit
 * that shows another page this sets `scroll-behavior: auto` inline, so the scroll jumps, and takes it off two frames
 * later. A change of the hash alone keeps the smooth scroll.
 *
 * Render it before <ScrollRestoration />: sibling layout effects run in order, so this one runs before the scroll.
 */
export function InstantRouteScroll() {
	const { pathname, search } = useLocation()
	const page = pathname + search
	const shown = useRef(page)
	useBeforePaint(() => {
		if (shown.current === page) return
		shown.current = page
		const html = document.documentElement
		html.style.scrollBehavior = "auto"
		// Chrome skips the style update for a scroll to (0, 0) and would use the smooth value it has. Reading the style
		// brings it up to date. The new page's style is computed before its first paint anyway.
		getComputedStyle(html).scrollBehavior
		// Two frames: the new page's own effects that scroll on arrival (to a hash, a saved place) jump too.
		requestAnimationFrame(() =>
			requestAnimationFrame(() => html.style.removeProperty("scroll-behavior")),
		)
	}, [page])
	return null
}

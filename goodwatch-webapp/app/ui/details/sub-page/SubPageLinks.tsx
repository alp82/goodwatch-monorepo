// The title page's side of its sub-pages (way-in.ts): any click on a link to one of them, whoever rendered it, goes in
// through the transition and remembers the page's place (a capture listener on window takes it before the router's
// <Link> does), and Back to the title page lands where it was left, or on the section a sub-page's rail asked for.
import {
	Link,
	useLocation,
	useNavigate,
	useNavigationType,
} from "@remix-run/react"
import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react"
import { useBelowFold } from "~/ui/details/below-fold"
import { useHydrated } from "~/utils/hydrated"
import { subKindOf } from "./paths"
import {
	canAnimate,
	ensureTransitionCss,
	markTransition,
	readTrip,
	restoreAnchor,
	startTrip,
	takeJump,
} from "./way-in"

/** A link from the title page into one of its sub-pages. `id` names it for the scroll anchor. */
export function SubPageLink({
	to,
	id,
	className,
	children,
}: {
	to: string
	id: string
	className?: string
	children: ReactNode
}) {
	return (
		<Link to={to} id={id} prefetch="intent" className={className}>
			{children}
		</Link>
	)
}

/**
 * A link in the sticky rail never moves with the page, so the anchor is the page's first section (or At a glance row)
 * on screen below the bars.
 */
function flowAnchor(): HTMLElement | null {
	for (const el of document.querySelectorAll<HTMLElement>(
		"#overview section[id], #overview li[id]",
	)) {
		if (el.closest("aside")) continue
		const r = el.getBoundingClientRect()
		if (r.height && r.bottom > 128 && r.top < window.innerHeight) return el
	}
	return null
}

/** The scroll anchor: the link's own id, or the section or row around it. */
function anchorOf(link: HTMLElement): HTMLElement {
	if (link.closest("aside")) return flowAnchor() ?? link
	if (link.id) return link
	return (
		link.closest<HTMLElement>("li[id], section[id]") ??
		link.closest<HTMLElement>("[id]") ??
		link
	)
}

/** Takes a click on any link to a sub-page and goes in through the transition. */
function useSubPageClicks() {
	const navigate = useNavigate()
	const navigateRef = useRef(navigate)
	navigateRef.current = navigate
	useEffect(() => {
		const onClick = (e: MouseEvent) => {
			if (
				e.defaultPrevented ||
				e.button !== 0 ||
				e.metaKey ||
				e.ctrlKey ||
				e.shiftKey ||
				e.altKey
			)
				return
			const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>(
				"a[href]",
			)
			if (!link || link.target === "_blank") return
			const url = new URL(link.href, window.location.href)
			if (url.origin !== window.location.origin || !subKindOf(url.pathname))
				return
			e.preventDefault()
			const href = url.pathname + url.search + url.hash
			startTrip(href, anchorOf(link))
			const animate = canAnimate()
			if (animate) markTransition("in")
			navigateRef.current(href, { viewTransition: animate })
		}
		window.addEventListener("click", onClick, true)
		return () => window.removeEventListener("click", onClick, true)
	}, [])
}

/** On the title page: the way into its sub-pages, and the way back into the page as it was left. */
export function SubPageLinks() {
	const { key, pathname } = useLocation()
	const type = useNavigationType()
	const { layOutAll } = useBelowFold()
	// Read once per mount (an effect that runs twice must not fall back to the restore on its second run).
	const jumpRef = useRef<string | null | undefined>(undefined)
	// Only a page the app put up (not the server's HTML, not a reload) lands where it was left.
	const inApp = useRef(useHydrated())
	useSubPageClicks()
	useLayoutEffect(() => {
		ensureTransitionCss()
		// A sub-page's rail asked for one section: land there (its header under the bars), not where it was left.
		if (jumpRef.current === undefined) jumpRef.current = takeJump(pathname)
		const jumpId = jumpRef.current
		if (jumpId) {
			queueMicrotask(layOutAll)
			const el = document.getElementById(jumpId)
			if (el) {
				const top =
					Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 128
				restoreAnchor(jumpId, top, 0)
				window.history.replaceState(
					window.history.state,
					"",
					`${window.location.pathname}${window.location.search}#${jumpId}`,
				)
				return
			}
		}
		if (!inApp.current || type !== "POP") return
		const trip = readTrip()
		if (!trip || trip.fromKey !== key) return
		restoreAnchor(trip.anchorId, trip.anchorTop, trip.scrollY)
	}, [])
	return null
}

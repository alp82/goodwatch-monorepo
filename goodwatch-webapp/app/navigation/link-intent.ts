// When to prefetch a page: one set of listeners on the document for every internal link, so links without
// `<Link prefetch>` (the related map, the search palette, breadcrumbs, plain anchors) are covered too.
// - Mouse: a hover that rests HOVER_DELAY_MS, cancelled when the pointer leaves first. Keyboard: focus.
// - A press (pointer or touch down) starts at once: on a phone it's the first sign of a tap.
// - Phones (no hover): when scrolling stops for SCROLL_IDLE_MS, the title and person links fully on screen nearest
//   its center, up to VIEWPORT_LINKS.
// - Once the browser is idle after load (WARM_DELAY_MS at least), the code of the main page types.
import { VIEWPORT_LINK_SELECTOR, WARM_ROUTE_IDS } from "./cached-routes"
import {
	type PrefetchTrigger,
	cancelPrefetch,
	prefetchPage,
	prefetchableUrl,
	preloadRouteCode,
} from "./instant-navigation"
import { nearestLinks } from "./viewport-links"

export const HOVER_DELAY_MS = 60
export const SCROLL_IDLE_MS = 300
export const WARM_DELAY_MS = 2000

function linkOf(target: EventTarget | null): HTMLAnchorElement | null {
	const anchor = (target as Element | null)?.closest?.("a[href]")
	if (!(anchor instanceof HTMLAnchorElement)) return null
	if (
		anchor.hasAttribute("download") ||
		anchor.getAttribute("rel")?.includes("external")
	)
		return null
	if (anchor.target && anchor.target !== "_self") return null
	if (
		anchor.hasAttribute("reloaddocument") ||
		anchor.dataset.noPrefetch !== undefined
	)
		return null
	return anchor
}

function prefetchLink(anchor: HTMLAnchorElement, trigger: PrefetchTrigger) {
	const url = prefetchableUrl(anchor.href)
	if (url) prefetchPage(url, trigger)
}

function prefetchVisible() {
	const links = [
		...document.querySelectorAll<HTMLAnchorElement>(VIEWPORT_LINK_SELECTOR),
	]
		.filter((anchor) => linkOf(anchor) === anchor)
		.map((anchor) => ({
			href: anchor.href,
			rect: anchor.getBoundingClientRect(),
		}))
	const viewport = { width: window.innerWidth, height: window.innerHeight }
	for (const href of nearestLinks(links, viewport)) {
		const url = prefetchableUrl(href)
		if (url) prefetchPage(url, "viewport")
	}
}

// Safari has no requestIdleCallback.
const idle = (callback: () => void) => {
	if (typeof window.requestIdleCallback === "function")
		window.requestIdleCallback(callback, { timeout: 5000 })
	else setTimeout(callback, 200)
}

function afterLoad(callback: () => void) {
	if (document.readyState === "complete") callback()
	else window.addEventListener("load", callback, { once: true })
}

let installed = false

/** Installs the listeners. Call once, after hydration. */
export function installLinkIntent(): void {
	if (installed) return
	installed = true

	let hoverTimer: number | undefined
	let hovered: HTMLAnchorElement | null = null
	const stopHover = () => {
		window.clearTimeout(hoverTimer)
		if (hovered) {
			const url = prefetchableUrl(hovered.href)
			if (url) cancelPrefetch(url)
		}
		hovered = null
	}

	document.addEventListener(
		"pointerover",
		(event) => {
			if (event.pointerType !== "mouse") return
			const anchor = linkOf(event.target)
			if (!anchor || anchor === hovered) return
			stopHover()
			hovered = anchor
			hoverTimer = window.setTimeout(
				() => prefetchLink(anchor, "hover"),
				HOVER_DELAY_MS,
			)
		},
		{ passive: true },
	)
	document.addEventListener(
		"pointerout",
		(event) => {
			if (!hovered) return
			const to = event.relatedTarget as Node | null
			if (to && hovered.contains(to)) return
			stopHover()
		},
		{ passive: true },
	)
	document.addEventListener(
		"pointerdown",
		(event) => {
			if (event.button > 0) return
			const anchor = linkOf(event.target)
			if (anchor) prefetchLink(anchor, "press")
		},
		{ capture: true, passive: true },
	)
	document.addEventListener("focusin", (event) => {
		const anchor = linkOf(event.target)
		if (anchor) prefetchLink(anchor, "focus")
	})

	const phone = window.matchMedia?.("(hover: none)").matches
	if (phone) {
		let scrollTimer: number | undefined
		const schedule = () => {
			window.clearTimeout(scrollTimer)
			scrollTimer = window.setTimeout(prefetchVisible, SCROLL_IDLE_MS)
		}
		document.addEventListener("scroll", schedule, {
			capture: true,
			passive: true,
		})
	}

	// Never before the first paint: after load, then WARM_DELAY_MS, then an idle moment.
	afterLoad(() =>
		window.setTimeout(
			() =>
				idle(() => {
					for (const routeId of WARM_ROUTE_IDS) preloadRouteCode(routeId)
					if (phone) prefetchVisible()
				}),
			WARM_DELAY_MS,
		),
	)
}

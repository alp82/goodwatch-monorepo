// When to prefetch a page: one set of listeners on the document for every internal link, so links without
// `<Link prefetch>` (the related map, the search palette, breadcrumbs, plain anchors) are covered too.
// - Mouse: a hover that rests HOVER_DELAY_MS, cancelled when the pointer leaves first. Keyboard: focus.
// - A press (pointer or touch down) starts at once: on a phone it's the first sign of a tap.
// - Phones (no hover): when scrolling stops for SCROLL_IDLE_MS, the title and person links fully on screen nearest
//   its center, up to VIEWPORT_LINKS.
// - Phones also prefetch visible title/person data after load, and their page types' code once, at low priority.
import { VIEWPORT_LINK_SELECTOR } from "./cached-routes"
import {
	type PrefetchTrigger,
	cancelPrefetch,
	prefetchPage,
	prefetchableUrl,
} from "./instant-navigation"
import { nearestLinks } from "./viewport-links"

export const HOVER_DELAY_MS = 60
export const SCROLL_IDLE_MS = 300
export const WARM_DELAY_MS = 2000

type IntentElement = HTMLAnchorElement | HTMLButtonElement
const intentHref = (element: IntentElement) =>
	element instanceof HTMLAnchorElement
		? element.href
		: (element.dataset.prefetchHref ?? "")

function linkOf(target: EventTarget | null): IntentElement | null {
	const anchor = (target as Element | null)?.closest?.(
		"a[href], button[data-prefetch-href]",
	)
	// TV navigation keeps its button: the remote and View Transition still own the click.
	if (anchor instanceof HTMLButtonElement)
		return anchor.disabled ? null : anchor
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

function prefetchLink(anchor: IntentElement, trigger: PrefetchTrigger) {
	const url = prefetchableUrl(intentHref(anchor))
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
	let hovered: IntentElement | null = null
	const stopHover = () => {
		window.clearTimeout(hoverTimer)
		if (hovered) {
			const url = prefetchableUrl(intentHref(hovered))
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

	// Only what a phone shows is speculative: its data, and the code of those page types (instant-navigation.ts).
	// Warming every catalog route's code here competed with an active navigation and downloaded unrelated page
	// types on every landing page.
	if (phone) afterLoad(() =>
		window.setTimeout(() => idle(prefetchVisible), WARM_DELAY_MS),
	)
}

// The way from the header's match chip to the comparison on the Taste tab. On the Taste tab itself the chip asks the
// card to open in place (an event); from another tab it links to /u/:handle#compare and the card opens on arrival.
// Kept apart from taste/Compare.tsx, so the header chunk does not pull the comparison.

/** The expanded comparison's id. A Taste tab address with #compare opens it. */
export const COMPARE_ID = "compare"

const OPEN_EVENT = "gw:open-compare"

/** Asks the Taste tab's card to open the comparison and scroll to it. */
export function requestCompare() {
	window.history.replaceState(window.history.state, "", `#${COMPARE_ID}`)
	window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Calls `open` whenever the header's chip asks for the comparison on this page. */
export function onCompareRequest(open: () => void) {
	window.addEventListener(OPEN_EVENT, open)
	return () => window.removeEventListener(OPEN_EVENT, open)
}

/** How far down the page the sticky rows reach: the site header and the visitor bar (the tab row's own top) plus the
 * tab row. */
function coveredBy() {
	const row = document.querySelector<HTMLElement>("[data-tab-row]")
	if (!row) return 64
	return (Number.parseFloat(getComputedStyle(row).top) || 0) + row.offsetHeight
}

/** Scrolls `el` to just under the sticky rows, smoothly unless the viewer asks for reduced motion. */
export function scrollUnderRows(el: HTMLElement) {
	const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
	const top = el.getBoundingClientRect().top + window.scrollY - coveredBy() - 12
	window.scrollTo({
		top: Math.max(0, top),
		behavior: still ? "auto" : "smooth",
	})
}

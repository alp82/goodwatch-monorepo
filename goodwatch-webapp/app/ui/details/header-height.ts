// The height of a title page's sticky bars under the site bar: the title bar (and on a phone the section bar under
// it). Their heights are fixed per breakpoint, so CSS has them (`--details-header-guess` in app/main.css).

/** The sticky bars' height in CSS; 48px (the title bar) where that sheet is missing. */
export const HEADER_HEIGHT = "var(--details-header-guess, 48px)"

/** How tall the site bar above the sticky header is. */
export const SITE_BAR_HEIGHT = 64

/** A scroll margin that leaves a link target 16px under the site bar and the sticky header. */
export const UNDER_HEADERS = `calc(${HEADER_HEIGHT} + ${SITE_BAR_HEIGHT + 16}px)`

/**
 * How far down the viewport the site bar and the page's sticky bars reach, in pixels, for code that places by number:
 * the title bar while it shows, and the phone's section bar.
 */
export function stickyHeadersBottom(siteBarHeight: number): number {
	let bottom = siteBarHeight
	for (const el of document.querySelectorAll<HTMLElement>(
		'[data-details-header], [data-title-bar][aria-hidden="false"]',
	)) {
		const r = el.getBoundingClientRect()
		if (r.height > 0 && r.top <= bottom + 1) bottom = Math.max(bottom, r.bottom)
	}
	return bottom
}

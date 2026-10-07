// The height of a title page's sticky header (title, section links, and the explore or journey bar). It differs by
// viewport and by which bar shows, so it is measured in the browser.
//
// The height is a CSS custom property on the page's `main` element, not React state: a measured height that
// differs from the first guess then costs a style update of the few elements that use it, where state at the top
// of the page rendered every section again right after hydration.

/** The custom property with the header's measured height. */
export const HEADER_HEIGHT_PROPERTY = "--details-header-height"

/** The header's height in CSS, with the guess that the server's HTML and the time before the measurement use. */
export const HEADER_HEIGHT = `var(${HEADER_HEIGHT_PROPERTY}, 112px)`

/** Keeps the custom property at the header's height until the returned function is called. */
export function publishHeaderHeight(header: HTMLElement): () => void {
	const target = header.closest<HTMLElement>("main") ?? document.documentElement
	const measure = () =>
		target.style.setProperty(
			HEADER_HEIGHT_PROPERTY,
			`${header.getBoundingClientRect().height}px`,
		)
	measure()
	const observer = new ResizeObserver(measure)
	observer.observe(header)
	return () => {
		observer.disconnect()
		target.style.removeProperty(HEADER_HEIGHT_PROPERTY)
	}
}

/** How far down the viewport the site bar and the sticky header reach, in pixels. For code that places by number. */
export function stickyHeadersBottom(siteBarHeight: number): number {
	return (
		document
			.querySelector("[data-details-header]")
			?.getBoundingClientRect().bottom ?? siteBarHeight
	)
}

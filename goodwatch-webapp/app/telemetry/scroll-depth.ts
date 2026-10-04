// Scroll depth per page. PostHog attaches how far the visitor scrolled the previous page to the next page view and
// to the page leave (`$prev_pageview_max_scroll_percentage` and its siblings). posthog-js 1.295.0 never clears its
// scroll record on a page view: `resetContext` hands the record back and keeps it. That was invisible while a visit
// sent one page view. With page views for navigation inside the app, the deepest scroll of the first page would count
// for every later page of the visit. Later SDK versions clear the record; when the SDK is upgraded past that fix,
// this module and its use in posthog-browser.ts can go.

/** The scroll record in the shape PostHog reads. */
export interface ScrollRecord {
	maxScrollHeight?: number
	maxScrollY?: number
	lastScrollY?: number
	maxContentHeight?: number
	maxContentY?: number
	lastContentY?: number
}

/** What the page measures at a scroll or resize: the scroll position and the document's and the window's height. */
export interface ScrollMeasure {
	scrollY: number
	scrollHeight: number
	clientHeight: number
}

/**
 * Keeps the scroll record of the page the visitor is on, with PostHog's own arithmetic.
 *
 * A navigation scrolls the window back to the top, and the site scrolls smoothly, so the window passes through the
 * old page's positions while the new page is already shown. Those positions aren't the visitor's: after `reset`,
 * `update` is ignored until `settle` says that the scroll has come to rest.
 */
export function createScrollDepth() {
	let record: ScrollRecord | undefined
	let settling = false
	const write = ({ scrollY, scrollHeight, clientHeight }: ScrollMeasure) => {
		record ??= {}
		const contentY = scrollY + clientHeight
		record.lastScrollY = Math.ceil(scrollY)
		record.maxScrollY = Math.max(scrollY, record.maxScrollY ?? 0)
		record.maxScrollHeight = Math.max(
			Math.max(0, scrollHeight - clientHeight),
			record.maxScrollHeight ?? 0,
		)
		record.lastContentY = contentY
		record.maxContentY = Math.max(contentY, record.maxContentY ?? 0)
		record.maxContentHeight = Math.max(
			scrollHeight,
			record.maxContentHeight ?? 0,
		)
	}
	return {
		/** A scroll or resize. */
		update(measure: ScrollMeasure) {
			if (!settling) write(measure)
		},
		/** The scroll came to rest: the record of a new page starts here. */
		settle(measure: ScrollMeasure) {
			settling = false
			write(measure)
		},
		get: () => record,
		/** Starts a new page: returns the record of the page the visitor leaves, and forgets it. */
		reset() {
			const previous = record
			record = undefined
			settling = true
			return previous
		},
	}
}

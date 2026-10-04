// Page views for navigation inside the app. The browser loads one document per visit; every later page is a route
// change, and analytics only hears about it when the page reports it.
//
// The rule for what counts as a page view:
// - A change of the pathname is a new page: `/discover` to `/movie/603-the-matrix`, one title to the next, Back and
//   Forward between pages, and a redirect that ends on another path.
// - A change of only the query string or the hash is the same page in another state, and sends nothing: filters on
//   Discover and on person pages, the tabs and the country of a title page, the TV screens of the start page
//   (`?tv=picks`), the search text (`?q=`), the search dialog and the command palette (which change no path), and
//   anchors.
// PostHog's own `history_change` mode uses the same pathname rule, so the numbers match what its documentation
// describes for single-page apps. The page sends the events itself because PostHog loads late (see load-trigger.ts):
// a navigation made before it loaded is reported once it has, after the landing page view, with the time it happened.

/** How the visitor got to the page, in the words PostHog's own history capture uses. */
export type NavigationType = "pushState" | "replaceState" | "popstate"

/** A page the visitor opened by navigating inside the app. */
export interface PageView {
	/** The address of the page. */
	href: string
	/** The address the visitor came from: the previous page as it was when they left it. */
	referrer: string
	/** The document title after the route rendered. */
	title: string
	/** When the page was shown, in milliseconds since the epoch. */
	time: number
	navigationType: NavigationType
}

const pathnameOf = (href: string): string | null => {
	try {
		return new URL(href).pathname
	} catch {
		return null
	}
}

/** Whether going from one address to the other shows a new page. See the rule at the top of this file. */
export function isNewPage(previousHref: string, nextHref: string): boolean {
	const previous = pathnameOf(previousHref)
	const next = pathnameOf(nextHref)
	return previous !== null && next !== null && previous !== next
}

export interface PageViewTracker {
	/**
	 * Reports the address after a route change. Returns the page view to send, or `null` when the visitor is still on
	 * the same page.
	 */
	navigated: (to: {
		href: string
		title: string
		time: number
		navigationType: NavigationType
	}) => PageView | null
}

/** Follows the visitor from the page the browser loaded. That page's view is the landing page view, sent elsewhere. */
export function createPageViewTracker(landingHref: string): PageViewTracker {
	let currentHref = landingHref
	return {
		navigated({ href, title, time, navigationType }) {
			const previousHref = currentHref
			currentHref = href
			if (!isNewPage(previousHref, href)) return null
			return { href, referrer: previousHref, title, time, navigationType }
		},
	}
}

/**
 * A private property that carries values PostHog would overwrite. PostHog sets `title` from the document and
 * `$prev_pageview_pathname` from the address bar at the moment an event is captured, and both are wrong for a page view
 * that is reported later than it happened. `applyPageViewOverrides` puts the values in place and removes the property.
 */
export const PAGE_VIEW_OVERRIDES_KEY = "$gw_page_view"

interface PageViewOverrides {
	title?: string
	previousPathname?: string
}

/** The title to report with a `$pageview`, whatever the document's title is when the event is captured. */
export const pageViewTitle = (title: string): Record<string, unknown> => ({
	[PAGE_VIEW_OVERRIDES_KEY]: { title } satisfies PageViewOverrides,
})

/**
 * The properties of a `$pageview` for a navigation inside the app. They name the page explicitly, because PostHog
 * reads the address bar when it captures an event, and the visitor can be on a later page by then. The referrer is the
 * previous page of the visit, as PostHog reports it for single-page apps. Search text in either address is redacted by
 * the `before_send` step, like on every other event.
 */
export function navigationPageviewProperties(
	view: PageView,
): Record<string, unknown> {
	const url = new URL(view.href)
	const overrides: PageViewOverrides = { title: view.title }
	const properties: Record<string, unknown> = {
		$current_url: view.href,
		$host: url.host,
		$pathname: url.pathname,
		$referrer: view.referrer,
		navigation_type: view.navigationType,
	}
	try {
		const referrer = new URL(view.referrer)
		properties.$referring_domain = referrer.host
		overrides.previousPathname = referrer.pathname
	} catch {
		// A referrer that isn't a URL keeps PostHog's own values.
	}
	properties[PAGE_VIEW_OVERRIDES_KEY] = overrides
	return properties
}

interface TelemetryEvent {
	properties?: Record<string, unknown>
}

/**
 * A `before_send` step: moves the values of `PAGE_VIEW_OVERRIDES_KEY` to the properties they stand for. It answers
 * the same reference for an event without the key.
 */
export function applyPageViewOverrides<T>(input: T): T {
	const event = input as TelemetryEvent | null
	const overrides = event?.properties?.[PAGE_VIEW_OVERRIDES_KEY] as
		| PageViewOverrides
		| undefined
	if (!event?.properties || overrides === undefined) return input
	const { [PAGE_VIEW_OVERRIDES_KEY]: _, ...properties } = event.properties
	if (typeof overrides?.title === "string") properties.title = overrides.title
	// Only an event that names a previous page view gets its pathname corrected.
	if (
		typeof overrides?.previousPathname === "string" &&
		properties.$prev_pageview_id !== undefined
	)
		properties.$prev_pageview_pathname = overrides.previousPathname
	return { ...event, properties } as T
}

/** The most navigations kept while PostHog hasn't loaded. A visitor who opens more pages than this loses the oldest. */
export const MAX_PENDING_PAGE_VIEWS = 50

/** Holds page views until PostHog has loaded, oldest first. */
export function createPageViewQueue(max = MAX_PENDING_PAGE_VIEWS) {
	const pending: PageView[] = []
	return {
		add(view: PageView) {
			pending.push(view)
			if (pending.length > max) pending.shift()
		},
		/** Empties the queue and returns what it held, in the order the pages were opened. */
		drain: () => pending.splice(0, pending.length),
	}
}

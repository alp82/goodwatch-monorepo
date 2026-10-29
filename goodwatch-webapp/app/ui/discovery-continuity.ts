// What DiscoveryContinuity keeps between visits, as plain data, so the rules can be tested without a browser.

export type Visit = { url: string; y: number }
export type Context = {
	last?: Visit
	routes: Record<string, Visit>
	positions: Record<string, number>
}

/** How many paths and URLs the stored history keeps. Every visited title adds one of each. */
export const KEEP = 100

export const emptyContext = (): Context => ({ routes: {}, positions: {} })

// No auth/account screens: a failed login must not replace the discovery return target.
export const isDiscovery = (path: string) =>
	path === "/" ||
	/^\/(watch|u|taste|discover|wishlist|search|movie|show|movies|shows|explore|lists|categories)(\/|$)/.test(
		path,
	)

/**
 * The URL with the last filters of a listing, when someone opens its entry point without a query. Null when the
 * page opens as asked. Discover never restores: a plain /discover link opens fresh, not with the last search.
 */
export function restoredEntry(
	pathname: string,
	search: string,
	context: Context,
): string | null {
	if (search && search !== "?") return null
	if (!isDiscovery(pathname) || pathname === "/") return null
	if (
		pathname.startsWith("/taste") ||
		pathname.startsWith("/u/") ||
		/^\/(movie|show)\//.test(pathname) ||
		/^\/discover(\/|$)/.test(pathname)
	)
		return null
	const previous = context.routes?.[pathname]
	return previous?.url.includes("?") ? previous.url : null
}

/** Re-inserts a key so that it counts as the newest, then keeps the newest `KEEP` entries. */
function newest<T>(map: Record<string, T>, key: string, value: T) {
	delete map[key]
	map[key] = value
	return Object.fromEntries(Object.entries(map).slice(-KEEP))
}

/** The context after a visit to `url` (on `pathname`) at scroll offset `y`. */
export function remember(
	context: Context,
	pathname: string,
	url: string,
	y: number,
): Context {
	const visit = { url, y }
	return {
		last: visit,
		routes: newest({ ...context.routes }, pathname, visit),
		positions: newest({ ...context.positions }, url, y),
	}
}

/** The parts of the browser's window that `offsetOf` reads. */
export type ScrollWindow = {
	location: { pathname: string; search: string }
	scrollY: number
}

/**
 * Reads the scroll offset of the page at `url` while that page is the one in the address bar, and otherwise returns
 * the last offset it read. When the page's effect cleans up after a page change, the router already changed the
 * address and scrolled the window for the next page, so the live offset belongs to the next page.
 */
export function offsetOf(url: string, win: ScrollWindow): () => number {
	let y = 0
	return () => {
		if (win.location.pathname + win.location.search === url) y = win.scrollY
		return y
	}
}

// Tells a request sent by the site's own pages from one sent by another site's page or by a bare script, for the
// endpoints that spend money or write rows when they run (search, poster impressions, og image warming), and for
// the Sentry tunnel, which spends the error tracking quota.
//
// The public origin is configured, never derived from the request: Coolify terminates TLS, so remix-serve sees HTTP,
// and forwarded headers are supplied by the caller. Production defaults to https://goodwatch.app. Anywhere else the
// origin must be set with APP_ORIGIN, or no request counts as the site's: a dev server on the production .env stays
// a reader whatever port it runs on.
//
// These headers stop browsers on other sites, which can't forge them. A script can send any header it likes, so this
// is no limit on scripts: it only keeps a request without the headers a browser sends from running by default. The
// limit on scripts for search is search-runtime/rate-limit.server.ts.

/** The site's public origin, or null when none is configured outside production. */
export function siteOrigin(): string | null {
	if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN
	return process.env.NODE_ENV === "production" ? "https://goodwatch.app" : null
}

/** Whether the request's Origin header is exactly the site's origin. Poster impressions and og image warming. */
export function hasSiteOrigin(request: Request): boolean {
	const expected = siteOrigin()
	return expected !== null && request.headers.get("Origin") === expected
}

/**
 * Whether the request comes from the site's own pages, for a POST that a browser sends with `fetch`:
 * - Sec-Fetch-Site, when sent, must be same-origin (browsers since 2020 set it and pages can't change it).
 * - Origin, when sent, must be the site's origin. Every current browser sends it on a POST.
 * - Without Origin, Sec-Fetch-Site: same-origin is enough, and without both a Referer on the site's origin (older
 *   browsers that left Origin out of same-origin requests still sent the page's address).
 * - Nothing else passes: no header at all is a script, not a page.
 */
export function isSiteRequest(request: Request): boolean {
	const expected = siteOrigin()
	if (expected === null) return false
	const fetchSite = request.headers.get("Sec-Fetch-Site")
	if (fetchSite !== null && fetchSite !== "same-origin") return false
	const origin = request.headers.get("Origin")
	if (origin !== null) return origin === expected
	if (fetchSite === "same-origin") return true
	return refererOrigin(request.headers.get("Referer")) === expected
}

function refererOrigin(referer: string | null): string | null {
	if (!referer) return null
	try {
		return new URL(referer).origin
	} catch {
		return null
	}
}

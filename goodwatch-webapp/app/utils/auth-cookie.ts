// Shared with client-imported auth utilities. No server-module imports here.
export const PRIVATE_CACHE_CONTROL = "private, no-store"
export const SHARED_PAGE_CACHE_CONTROL =
	"public, max-age=0, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400"

// The page adds at most 20 seconds to the view cache's 20 seconds. See docs/page-cache.md.
export const SHARE_LIST_PAGE_CACHE_CONTROL =
	"public, max-age=0, s-maxage=10, stale-while-revalidate=10"

/** The configured project's base cookie name, or null for missing/invalid configuration. */
export function authCookieName(
	supabaseUrl = process.env.SUPABASE_URL,
): string | null {
	try {
		const ref = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : ""
		return ref ? `sb-${ref}-auth-token` : null
	} catch {
		return null
	}
}

export function createAuthCookieMatcher(
	supabaseUrl = process.env.SUPABASE_URL,
) {
	const name = authCookieName(supabaseUrl)
	const pattern = new RegExp(
		`(?:^|;)[ \\t]*${name ? name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "sb-[^=;\\s]+-auth-token"}(?:\\.[0-9]+)?=`,
	)
	return (cookieHeader: string | null | undefined): boolean =>
		pattern.test(cookieHeader ?? "")
}

let configuredUrl: string | undefined
let matcher: ReturnType<typeof createAuthCookieMatcher> | undefined
export function hasAuthCookie(
	cookieHeader: string | null | undefined,
): boolean {
	if (!matcher || configuredUrl !== process.env.SUPABASE_URL) {
		configuredUrl = process.env.SUPABASE_URL
		matcher = createAuthCookieMatcher(configuredUrl)
	}
	return matcher(cookieHeader)
}

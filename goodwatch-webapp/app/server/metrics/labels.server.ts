// Reduces request metadata to bounded labels without retaining paths or cookie values.
import type { RoutePatternMatcher } from "~/utils/route-pattern"

// Files from `public/` are served before any route gets the request, and a wide route such as `/:type` would also
// match `/favicon.ico`. The set of public file paths says which requests those are.
export function routeLabel(
	pathname: string,
	statusCode: number,
	matcher: RoutePatternMatcher,
	publicFiles?: ReadonlySet<string>,
): string {
	if (pathname.startsWith("/assets/") || publicFiles?.has(pathname))
		return "static"
	return matcher(pathname) ?? (statusCode < 400 ? "static" : "unmatched")
}

export function statusClass(statusCode: number): string {
	if (statusCode >= 500) return "5xx"
	if (statusCode >= 400) return "4xx"
	if (statusCode >= 300) return "3xx"
	if (statusCode >= 200) return "2xx"
	return "1xx"
}

export function createAudienceLabel(
	supabaseUrl?: string,
): (cookieHeader?: string) => "member" | "anon" {
	let project: string | undefined
	try {
		project = supabaseUrl
			? new URL(supabaseUrl).hostname.split(".")[0]
			: undefined
	} catch {
		/* Missing or invalid configuration uses the bounded fallback. */
	}
	const name = project
		? `sb-${project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-auth-token`
		: "sb-[^=;\\s]+-auth-token"
	const pattern = new RegExp(`(?:^|;)[ \\t]*${name}(?:\\.[0-9]+)?=`)
	return (cookieHeader) =>
		cookieHeader && pattern.test(cookieHeader) ? "member" : "anon"
}
export const audienceLabel = createAudienceLabel(process.env.SUPABASE_URL)

export function cacheControlLabel(
	headerValue: string | number | string[] | undefined,
): string {
	const value = String(headerValue ?? "")
	if (/(?:^|,)\s*(?:private|no-store|no-cache)\s*(?:=|,|$)/i.test(value))
		return "private"
	if (/(?:^|,)\s*(?:s-maxage|public)\s*(?:=|,|$)/i.test(value)) return "shared"
	return "none"
}

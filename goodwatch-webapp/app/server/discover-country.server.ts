import { requestLocale } from "./cache-identity.server.ts"

/**
 * The country whose streaming services the discover lists filter by: `?country=`, else a member's saved country, else
 * the request's country, which is US when nothing names one. Without a country the streaming filter is off, so a
 * crawler would get the same titles on every streaming list. The request's country is in a page's cache key, so a
 * stored page stays right for everyone who gets it. Nothing here is written to a cookie or to settings.
 */
export const discoverCountry = (request: Request, savedCountry?: string) =>
	new URL(request.url).searchParams.get("country") ||
	savedCountry ||
	requestLocale(request).country

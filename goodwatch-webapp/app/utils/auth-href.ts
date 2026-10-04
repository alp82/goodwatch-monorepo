import { useLocation } from "@remix-run/react"
import { authReturnQuery } from "./auth-return.ts"
import { useHydrated } from "./hydrated.ts"

/**
 * Builds the links to sign-in and sign-up that bring the person back: to `returnTo`, or to the page they're on.
 *
 * The return page is only in the link once the browser runs the page. The server's HTML has the bare `/sign-up`:
 * a link per page (`/sign-up?redirectTo=<this page>`) is an endless set of URLs, and crawlers follow every one of
 * them. Someone who clicks before the page's scripts run signs up without coming back.
 */
export function useAuthHref() {
	const location = useLocation()
	const hydrated = useHydrated()
	return (page: "sign-in" | "sign-up", returnTo?: string) => {
		if (!hydrated) return `/${page}`
		return `/${page}${
			returnTo == null
				? authReturnQuery(location)
				: `?redirectTo=${encodeURIComponent(returnTo)}`
		}`
	}
}

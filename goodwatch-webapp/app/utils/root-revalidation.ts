// When the root loader reruns on the client. Its data (the member, their user data, features, locale, env) doesn't
// depend on the URL, so a navigation never reloads it: Remix would rerun it for every navigation that changes the
// query string. It reruns for what can change that data:
// - a sign-in or sign-out, which the auth provider announces with requestRootRevalidation before it revalidates.
//   The request stays pending until the loader's new data arrives, so a navigation that is under way can't drop it.
// - a revalidation on the same URL (useRevalidator) and a form submission, as Remix decides.
// The member's user data stays fresh without it: mutations update the client query, and the query refetches
// /api/user-data when it is stale.
import type { ShouldRevalidateFunction } from "@remix-run/react"

let requested = false

/** Call before revalidating because the signed-in person changed. */
export function requestRootRevalidation(): void {
	requested = true
}

/** Call when the root loader's data arrived. */
export function rootRevalidated(): void {
	requested = false
}

export const shouldRevalidateRoot: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) => {
	if (requested) return true
	if (
		!formMethod &&
		(currentUrl.pathname !== nextUrl.pathname ||
			currentUrl.search !== nextUrl.search)
	)
		return false
	return defaultShouldRevalidate
}

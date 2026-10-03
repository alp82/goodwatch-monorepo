const AUTH_PAGE = /^\/(sign-in|sign-up)\/?$/

/**
 * The `?redirectTo=` query for a sign-in or sign-up link, so the person comes back to the page they're on.
 * On the sign-in and sign-up pages themselves it passes the existing return page on (or nothing): wrapping the
 * current URL there would nest one more level with every click.
 */
export function authReturnQuery({
	pathname,
	search,
	hash,
}: { pathname: string; search: string; hash: string }) {
	const returnTo = AUTH_PAGE.test(pathname)
		? new URLSearchParams(search).get("redirectTo")
		: pathname + search + hash
	return returnTo ? `?redirectTo=${encodeURIComponent(returnTo)}` : ""
}

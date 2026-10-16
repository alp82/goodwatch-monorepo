// The sign-in, sign-up and confirmation forms post, so that a press before the page has loaded never puts a password
// in the address. The browser does the signing in, so a post that reaches the server goes back to the same form,
// where the person can press again once the page has loaded, instead of ending on an error page.
export function backToForm(request: Request): Response {
	const url = new URL(request.url)
	return new Response(null, {
		status: 303,
		headers: { Location: url.pathname + url.search, "Cache-Control": "private, no-store" },
	})
}

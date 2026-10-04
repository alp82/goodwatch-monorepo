// The browser check used to be a page of its own, and filtered views redirected to it. The check is now served at the
// filtered URL itself (see ~/server/browser-gate.server), which also answers this path before Remix. This route stays
// so that requests for the old address keep their own name in the metrics.
export async function loader() {
	return new Response("Gone", {
		status: 410,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "private, no-store",
			"X-Robots-Tag": "noindex",
		},
	})
}

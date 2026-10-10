// The sitemap files are static files, answered before Remix (see ~/server/static-files.server). A request that
// arrives here names a sitemap file that was removed. It answers 410 so that a crawler drops the address, and so
// that it doesn't fall into the category routes.
export async function loader() {
	return new Response("Gone", {
		status: 410,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
			"X-Robots-Tag": "noindex",
		},
	})
}

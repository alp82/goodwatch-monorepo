// The sitemap files are static files, answered before Remix (see ~/server/static-files.server). Two kinds of request
// arrive here: the Browse sitemap, which is built from the loaded title snapshot (~/server/browse/sitemap.server),
// and a sitemap file that was removed, which answers 410 so that a crawler drops the address.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { browseSitemap } from "~/server/browse/sitemap.server"
import { PlacesNotReady } from "~/server/browse/places.server"

export async function loader({ params, request }: LoaderFunctionArgs) {
	if (params.file === "sitemap_browse.xml") {
		try {
			return new Response(await browseSitemap(request), {
				headers: {
					"Content-Type": "application/xml; charset=utf-8",
					"Cache-Control": "public, max-age=3600",
				},
			})
		} catch (error) {
			if (error instanceof PlacesNotReady)
				return new Response("Loading", {
					status: 503,
					headers: { "Retry-After": "30", "Cache-Control": "no-store" },
				})
			throw error
		}
	}
	return new Response("Gone", {
		status: 410,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
			"X-Robots-Tag": "noindex",
		},
	})
}

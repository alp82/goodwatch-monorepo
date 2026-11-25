import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { kindOfSeg } from "~/domain/browse/address"
import { loadGenrePanel } from "~/server/browse/genres.server"
import { PlacesNotReady, placesForContext } from "~/server/browse/places.server"
import { withMediaReadHealth } from "~/server/media-read-health.server"
import { getViewerContext } from "~/server/viewer.server"

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" }

/** The selected genre uses the same viewer and display language as its index. */
export async function loader({ request, params }: LoaderFunctionArgs) {
	const kind = kindOfSeg(params.type)
	const slug = params.slug
	if (!kind || !slug) return json({ panel: null }, { status: 404, headers })
	try {
		return await withMediaReadHealth(async () => {
			const atlas = await placesForContext(kind, "us", () =>
				getViewerContext(request, undefined, undefined, "page"),
			)
			const panel = await loadGenrePanel(atlas, slug)
			return json({ panel }, { status: panel ? 200 : 404, headers })
		})
	} catch (error) {
		if (!(error instanceof PlacesNotReady)) console.error("Browse genre panel read failed", error)
		return json({ panel: null }, { status: 503, headers: { ...headers, "Retry-After": "5" } })
	}
}

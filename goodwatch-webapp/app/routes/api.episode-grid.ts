// A show's whole episode grid, for a show page that rendered only its newest part (ui/details/episode-grid/window.ts).
// The same for every visitor and country; with `displayLanguage`, episode names in that language, as the page has
// them. Browsers and caches may keep it by its address.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { PUBLIC_DATA_CACHE_CONTROL } from "~/server/cache-identity.server"
import { getEpisodeGrid } from "~/server/episode-grid.server"
import { overlayAlignedGrid } from "~/server/episode-text-overlay.server"
import {
	apiDisplayLanguage,
	mediaApiCacheControl,
} from "~/server/media-payload.server"
import { withMediaReadHealth } from "~/server/media-read-health.server"
import { packEpisodeGrid } from "~/utils/episode-grid-wire"

const noStore = { "Cache-Control": "no-store" }

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const showId = new URL(request.url).searchParams.get("show") ?? ""
	if (!/^\d{1,9}$/.test(showId))
		throw new Response("Invalid parameters", { status: 400, headers: noStore })
	try {
		const grid = await getEpisodeGrid({ showId })
		if (!grid || !grid.seasons.length)
			throw new Response("Not found", { status: 404, headers: noStore })
		const language = apiDisplayLanguage(request)
		return json(
			packEpisodeGrid(
				language ? await overlayAlignedGrid(grid, language) : grid,
			),
			{
				headers: {
					"Cache-Control": mediaApiCacheControl(
						request,
						PUBLIC_DATA_CACHE_CONTROL,
					),
				},
			},
		)
	} catch (error) {
		if (error instanceof Response) throw error
		console.error("Episode grid read failed", { showId, error })
		return json(
			{ error: "Episode ratings temporarily unavailable" },
			{ status: 503, headers: { ...noStore, "Retry-After": "5" } },
		)
	}
}

export const loader = (args: LoaderFunctionArgs) =>
	withMediaReadHealth(() => canonicalLoader(args), { inheritFailure: true })

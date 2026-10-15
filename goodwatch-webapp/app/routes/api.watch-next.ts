import { presentCatalogLoader } from "~/server/media-payload.server"
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import {
	headers,
	invalid,
	parseWatchNextOptions,
	watchNextViewer,
} from "~/server/watch-next-request.server"
import { type WatchNext, getWatchNext } from "~/server/watch-next.server"

// Watch next: the hero, its Then column, the tiers, mood counts and pictures, and suggestions for a short Wishlist.
// - Members: GET /api/watch-next?sort=waiting&moods=funny,scary&services=all&notTonight=1000000000550
// - Guests: POST to the same URL with { guest: { interactions, country, services } }, the guest progress their
//   browser holds.
// Every parameter is optional: Best match (or Last added without taste), no moods, On my services.

async function respond(request: Request) {
	const viewer = await watchNextViewer(request)
	if ("response" in viewer) return viewer.response
	const options = parseWatchNextOptions(new URL(request.url), viewer.member)
	if (!options) return invalid("Pass up to 100 title keys as notTonight=1,2,3")
	return json<WatchNext>(await getWatchNext(viewer.ctx, options), { headers })
}

const canonicalLoader = ({ request }: LoaderFunctionArgs) => respond(request)

async function canonicalAction({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	return respond(request)
}

export const loader = presentCatalogLoader(canonicalLoader, { live: true })
export const action = presentCatalogLoader(canonicalAction, { live: true })

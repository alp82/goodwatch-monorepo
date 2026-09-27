import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { MAX_KEYS } from "~/server/title-cards.server"
import {
	headers,
	invalid,
	parseKeys,
	parseWatchNextOptions,
	watchNextViewer,
} from "~/server/watch-next-request.server"
import {
	type WatchNextTitle,
	getWatchNextTitles,
} from "~/server/watch-next.server"

// Cards for Watch next's later tiers as they scroll into view: up to 60 Wishlist titles by key, with the same
// options as /api/watch-next so each card says whether it fits.
// - Members: GET /api/watch-next/cards?keys=1000000000550,2000000001399&moods=funny
// - Guests: POST to the same URL with { guest: { interactions, country, services } }.

async function respond(request: Request) {
	const viewer = await watchNextViewer(request)
	if ("response" in viewer) return viewer.response
	const url = new URL(request.url)
	const keys = parseKeys(url.searchParams.get("keys"))
	const options = parseWatchNextOptions(url)
	if (!keys || keys.length > MAX_KEYS || !options)
		return invalid(`Pass up to ${MAX_KEYS} title keys as keys=1,2,3`)
	return json<{ titles: WatchNextTitle[] }>(
		{ titles: await getWatchNextTitles(viewer.ctx, keys, options) },
		{ headers },
	)
}

export const loader = ({ request }: LoaderFunctionArgs) => respond(request)

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	return respond(request)
}

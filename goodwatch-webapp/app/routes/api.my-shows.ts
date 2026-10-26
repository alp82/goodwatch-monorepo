// My shows for a guest: POST { guest: { interactions, country, services } }, the guest progress their browser holds.
// A guest has no watch state, so the page is the Wishlist's shows to start. A signed-in member's page comes with the
// page itself (routes/my-shows.tsx).
import { type ActionFunctionArgs, json } from "@remix-run/node"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { type MyShows, getGuestMyShows } from "~/server/my-shows.server"
import { loadTaste } from "~/server/taste/index.server"
import { headers, watchNextViewer } from "~/server/watch-next-request.server"
import { guestUserData } from "~/utils/guest-progress"

async function canonicalAction({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const viewer = await watchNextViewer(request)
	if ("response" in viewer) return viewer.response
	const { ctx } = viewer
	if (ctx.viewer.kind !== "guest")
		return json({ error: "Members read My shows" }, { status: 400, headers })
	const data = await getGuestMyShows(
		{
			language: ctx.language,
			country: ctx.country,
			services: ctx.services,
			taste: await loadTaste(ctx.viewer),
		},
		guestUserData(ctx.viewer.progress.interactions),
	)
	return json<{ data: MyShows; now: number }>(
		{ data, now: Date.now() },
		{ headers },
	)
}

export const action = presentCatalogLoader(canonicalAction, {
	live: true,
	hint: "show",
})

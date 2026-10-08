import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { type TonightsPick, getTonightsPick } from "~/server/tonight.server"
import { headers, watchNextViewer } from "~/server/watch-next-request.server"

// Tonight's pick, or null: the title the navigation dock and the Living room's TV put forward for tonight.
// - Members: GET /api/tonight
// - Guests: POST /api/tonight with { guest: { interactions, country, services } }.
// Not found while REC_WATCH_NEXT hides Watch next from the viewer: the pick opens Watch next.

async function respond(request: Request) {
	const viewer = await watchNextViewer(request)
	if ("response" in viewer) return viewer.response
	return json<{ pick: TonightsPick | null }>(
		{ pick: await getTonightsPick(viewer.ctx, viewer.tracking) },
		{ headers },
	)
}

export const loader = ({ request }: LoaderFunctionArgs) => respond(request)

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	return respond(request)
}

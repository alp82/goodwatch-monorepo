import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { signalOf } from "~/domain/newly-available"
import type { NewOnServices } from "~/domain/newly-available-signal"
import { getNewlyAvailable } from "~/server/newly-available.server"
import { type TonightsPick, getTonightsPick } from "~/server/tonight.server"
import { headers, watchNextViewer } from "~/server/watch-next-request.server"

// Tonight's pick, or null: the title the navigation dock and the Living room's TV put forward for tonight.
// - Members: GET /api/tonight
// - Guests: POST /api/tonight with { guest: { interactions, country, services } }.
//
// A member's answer also says which of their titles landed on one of their services (#456),
// `landed`, left out when none did. It rides along because the navigation asks for the pick on every page, and
// it is read from memory: no statement unless something landed.

async function respond(request: Request) {
	const viewer = await watchNextViewer(request)
	if ("response" in viewer) return viewer.response
	const [pick, landed] = await Promise.all([
		getTonightsPick(viewer.ctx),
		viewer.member
			? getNewlyAvailable(viewer.ctx)
					.then(signalOf)
					// The pick is the answer; what landed is an addition to it.
					.catch((error) => {
						console.error("Tonight: reading what landed failed:", error)
						return null
					})
			: null,
	])
	return json<{ pick: TonightsPick | null; landed?: NewOnServices }>(
		{ pick, ...(landed ? { landed } : {}) },
		{ headers },
	)
}

export const loader = ({ request }: LoaderFunctionArgs) => respond(request)

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	return respond(request)
}

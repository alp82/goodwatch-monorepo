import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { NOTHING_NEW, type NewEpisodes, summaryOf } from "~/domain/new-episodes"
import { isEnabled } from "~/server/features.server"
import { getNewShows, recordMyShowsVisit } from "~/server/new-episodes.server"
import { getUserIdFromRequest } from "~/utils/auth"

// What is new for the member's shows (#442): the signal on the Browse button, the dock's key, the My shows tile
// and home's Continue door.
//   GET  /api/new-episodes   how many shows have a Next episode that aired since the member last opened My shows,
//                            and the show when it is one
//   POST /api/new-episodes   the member has opened My shows: nothing is new any more
// For members: 401 for a guest, and not found while REC_TRACKING hides tracking from the viewer. The member is the
// session's; nothing in the request says whose shows they are.

const headers = { "Cache-Control": "private, no-store" }

async function member(request: Request) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!isEnabled("tracking", { userId }))
		return json({ error: "Not found" }, { status: 404, headers })
	if (!userId) return json({ error: "Sign in" }, { status: 401, headers })
	return userId
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await member(request)
	if (typeof userId !== "string") return userId
	const { shows } = await getNewShows(userId)
	return json<NewEpisodes>(summaryOf(shows), { headers })
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const userId = await member(request)
	if (typeof userId !== "string") return userId
	await recordMyShowsVisit(userId)
	return json<NewEpisodes>(NOTHING_NEW, { headers })
}

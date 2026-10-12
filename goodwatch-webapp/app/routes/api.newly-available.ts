import { type ActionFunctionArgs, json } from "@remix-run/node"
import { isEnabled } from "~/server/features.server"
import { recordMyMoviesVisit } from "~/server/newly-available.server"
import { getUserIdFromRequest } from "~/utils/auth"

// Newly available on a member's services (#456).
//   POST /api/newly-available   the member has opened My movies: the movies that landed are no longer news
// What landed is read with Tonight's pick (GET /api/tonight), and a visit of My shows is stored by
// POST /api/new-episodes, which clears the shows. For members: 401 for a guest, and not found while REC_TRACKING
// hides tracking from the viewer. The member is the session's.

const headers = { "Cache-Control": "private, no-store" }

export const loader = () =>
	json({ error: "Method not allowed" }, { status: 405, headers })

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!isEnabled("tracking", { userId }))
		return json({ error: "Not found" }, { status: 404, headers })
	if (!userId) return json({ error: "Sign in" }, { status: 401, headers })
	await recordMyMoviesVisit(userId)
	return json({ ok: true }, { headers })
}

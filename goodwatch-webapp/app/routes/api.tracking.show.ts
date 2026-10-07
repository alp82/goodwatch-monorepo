import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import type {
	ActionAnswer,
	ShowTrackingPage,
} from "~/domain/tracking/show-page"
import { isEnabled } from "~/server/features.server"
import {
	applyShowTrackingAction,
	getShowTrackingPage,
	parseShowAction,
} from "~/server/show-tracking.server"
import { TrackingConflictError } from "~/server/tracking.server"
import { getUserIdFromRequest } from "~/utils/auth"

// Episode tracking on the show page, for members (#384):
// - GET ?id=<show id> answers with the member's state row and watches of the show, and its episode list with air
//   dates and IMDb's ratings.
// - POST { id, event, actionId?, restore? } applies one action and answers with the show's state row, the stored
//   rows the action added or changed, the ids it removed, and what an Undo has to put back.
// Both are one member's data and are never cached. Not found while REC_TRACKING hides tracking from the viewer.

const headers = { "Cache-Control": "private, no-store" }
const fail = (error: string, status: number) =>
	json({ error }, { status, headers })

/** The member of a request, or the response to send instead. */
async function member(request: Request): Promise<string | Response> {
	const userId = await getUserIdFromRequest({ request })
	if (!isEnabled("tracking", { userId })) return fail("Not found", 404)
	if (!userId) return fail("Sign in to track episodes", 401)
	return userId
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await member(request)
	if (typeof userId !== "string") return userId
	const id = new URL(request.url).searchParams.get("id") ?? ""
	if (!/^[1-9]\d{0,9}$/.test(id)) return fail("Send ?id=<show id>", 400)
	return json<ShowTrackingPage>(await getShowTrackingPage(userId, Number(id)), {
		headers,
	})
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return fail("Method not allowed", 405)
	const userId = await member(request)
	if (typeof userId !== "string") return userId
	const body = parseShowAction(await request.json().catch(() => null))
	if (!body) return fail("Send { id, event, actionId }", 400)
	try {
		return json<ActionAnswer>(await applyShowTrackingAction(userId, body), {
			headers,
		})
	} catch (error) {
		// Other actions on the show kept getting in between. Nothing is lost: the same request can be sent again.
		if (error instanceof TrackingConflictError) return fail(error.message, 409)
		throw error
	}
}

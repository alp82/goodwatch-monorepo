import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { summaryOf } from "~/domain/new-episodes"
import type { NewEpisodes } from "~/domain/new-episodes-signal"
import { localizeApiTitlePayload } from "~/server/media-payload.server"
import { getNewShows, recordMyShowsVisit } from "~/server/new-episodes.server"
import { acknowledgeRelease } from "~/server/show-announcements.server"
import { getUserIdFromRequest } from "~/utils/auth"

// What is new for the member's shows (#442): the signal on the Browse button, the dock's key, the My shows tile
// and home's Continue door.
//   GET  /api/new-episodes   pending release announcements and their summary
//   POST /api/new-episodes   dismiss a displayed release, or record a visit for streaming-service news
// For members: 401 for a guest. The member is the session's; nothing in the request says whose shows they are.

const headers = { "Cache-Control": "private, no-store" }

async function member(request: Request) {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	if (!userId) return json({ error: "Sign in" }, { status: 401, headers })
	return userId
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await member(request)
	if (typeof userId !== "string") return userId
	const { shows } = await getNewShows(userId)
	const summary = summaryOf(shows)
	const presented =
		summary.only && shows[0]
			? await localizeApiTitlePayload(
					{ ...summary.only, media_type: "show", tmdb_id: shows[0].id },
					request,
				)
			: null
	return json<NewEpisodes>(
		{
			...summary,
			only: presented,
			announcements: await localizeApiTitlePayload(
				shows.map((show) => ({
					...show,
					media_type: "show",
					tmdb_id: show.id,
				})),
				request,
			),
		},
		{ headers },
	)
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const userId = await member(request)
	if (typeof userId !== "string") return userId
	const form = request.headers.get("content-type")
		? await request.formData()
		: new FormData()
	if (form.get("intent") === "dismiss") {
		const token = form.get("token")
		if (typeof token !== "string" || !(await acknowledgeRelease(userId, token)))
			return json({ error: "Unknown announcement" }, { status: 400, headers })
		return json({ ok: true }, { headers })
	}
	await recordMyShowsVisit(userId)
	return json({ ok: true }, { headers })
}

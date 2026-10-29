// GET /api/imports/ai-activity?since=<ms>: what the member's AI app changed through GoodWatch's MCP server since that
// moment, for the Imports page's "Your AI app" source. POST {intent: "undo", since} takes those changes back.
import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import {
	readAiActivity,
	sinceFrom,
	undoAiActivity,
} from "~/server/imports/ai-activity.server"
import { withMember } from "~/server/imports/http.server"
import { analyticsAction } from "~/telemetry/product-analytics.server"

export const loader = ({ request }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		// The first read starts the clock on the server, so the page never compares its own clock with the server's.
		const since = sinceFrom(new URL(request.url).searchParams.get("since"))
		const activity = await readAiActivity(request, userId, since)
		return json({ ...activity, since, now: Date.now() }, { headers })
	})

export const action = analyticsAction(({ request }: ActionFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		if (request.method !== "POST")
			return json({ error: "Method not allowed" }, { status: 405, headers })
		const body = (await request.json().catch(() => null)) as {
			intent?: unknown
			since?: unknown
		} | null
		if (body?.intent !== "undo")
			return json({ error: "Unknown request" }, { status: 400, headers })
		const since = sinceFrom(String(body.since ?? ""))
		const activity = await undoAiActivity(request, userId, since)
		return json({ ...activity, since, now: Date.now() }, { headers })
	}),
)

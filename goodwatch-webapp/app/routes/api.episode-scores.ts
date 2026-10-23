import { type ActionFunctionArgs, json } from "@remix-run/node"
import { answerEpisodeScoreRequest } from "~/server/episode-score-request.server"
import { analyticsAction } from "~/telemetry/product-analytics.server"
import { getUserIdFromRequest } from "~/utils/auth"

// A member's season, episode and part scores on the show page (#759): see server/episode-score-request.server.ts.
// One member's data, never cached. A score here never records a watch, changes a show's status, or touches taste.

const headers = { "Cache-Control": "private, no-store" }

async function productAction({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const userId = await getUserIdFromRequest({ request })
	const answer = await answerEpisodeScoreRequest(
		userId,
		await request.json().catch(() => null),
	)
	return json(answer.body, { status: answer.status, headers })
}

export const action = analyticsAction(productAction)

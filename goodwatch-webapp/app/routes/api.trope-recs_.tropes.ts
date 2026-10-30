// GET /api/trope-recs/tropes: the session member's top positive tropes ({ pending, tropes }), without recommendations.
// Read by the For you switch, the profile's "Picks with this trope" links and the title page's trope names.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { loadMemberTropes } from "~/server/trope-recs/index.server"
import { getUserIdFromRequest } from "~/utils/auth"

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" }
export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	if (!userId)
		return json({ error: "Authentication required" }, { status: 401, headers })
	const result = await loadMemberTropes(userId)
	return json(result, {
		status: result.pending ? 202 : 200,
		headers: {
			...headers,
			...(result.pending ? { "Retry-After": "2" } : {}),
		},
	})
}

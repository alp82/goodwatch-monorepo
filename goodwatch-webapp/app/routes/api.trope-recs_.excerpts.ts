import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getUserIdFromRequest } from "~/utils/auth"
import { excerptParams } from "~/server/profile/tropes-model"
import { loadRecommendationExcerpts } from "~/server/trope-recs/excerpts.server"

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" }
export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	if (!userId)
		return json({ error: "Authentication required" }, { status: 401, headers })
	const input = excerptParams(new URL(request.url).searchParams)
	if (!input)
		return json(
			{ error: "Invalid trope or title keys" },
			{ status: 400, headers },
		)
	try {
		const result = await loadRecommendationExcerpts(
			userId,
			input.trope,
			input.keys,
		)
		return json(result, { status: result.pending ? 202 : 200, headers })
	} catch (error) {
		if (error instanceof RangeError)
			return json({ error: error.message }, { status: 400, headers })
		throw error
	}
}

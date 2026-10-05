import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node"
import { updateNotInterested } from "~/server/not-interested.server"
import { getUserIdFromRequest } from "~/utils/auth"

export const action: ActionFunction = async ({
	request,
}: ActionFunctionArgs) => {
	if (request.method !== "POST") return new Response(null, { status: 405 })
	const params = await request.json().catch(() => null)
	if (!params || !Number.isSafeInteger(params.tmdb_id) || params.tmdb_id <= 0 ||
		!["movie", "show"].includes(params.media_type) || !["add", "remove"].includes(params.action))
		return Response.json({ status: "failed" }, { status: 400 })
	const user_id = await getUserIdFromRequest({ request })

	const result = await updateNotInterested({
		...params,
		user_id,
	})

	return result
}

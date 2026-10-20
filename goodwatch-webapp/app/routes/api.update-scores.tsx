import { analyticsAction } from "~/telemetry/product-analytics.server"
import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node"
import { updateScores } from "~/server/scores.server"
import { getUserIdFromRequest } from "~/utils/auth"

export const action: ActionFunction = analyticsAction(
	async ({ request }: ActionFunctionArgs) => {
	const params = await request.json()
	const user_id = await getUserIdFromRequest({ request })

	const result = await updateScores({
		...params,
		user_id,
	})

	return result
},
)

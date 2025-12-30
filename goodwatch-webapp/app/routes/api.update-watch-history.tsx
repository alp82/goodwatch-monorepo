import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node"
import { updateWatchHistory } from "~/server/watchHistory.server"
import { resetUserDataCache } from "~/server/userData.server"
import { getUserIdFromRequest } from "~/utils/auth"

export const action: ActionFunction = async ({
	request,
}: ActionFunctionArgs) => {
	const params = await request.json()
	const user_id = await getUserIdFromRequest({ request })

	const result = await updateWatchHistory({
		...params,
		user_id,
	})

	await resetUserDataCache({ user_id: user_id })

	return result
}

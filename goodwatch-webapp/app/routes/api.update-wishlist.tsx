import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node"
import { updateWishList } from "~/server/wishList.server"
import { resetUserDataCache } from "~/server/userData.server"
import { getUserIdFromRequest } from "~/utils/auth"

export const action: ActionFunction = async ({
	request,
}: ActionFunctionArgs) => {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 })
	}

	const params = await request.json()
	const user_id = await getUserIdFromRequest({ request })

	const result = await updateWishList({
		...params,
		user_id,
	})

	await resetUserDataCache({ user_id: user_id })

	return result
}

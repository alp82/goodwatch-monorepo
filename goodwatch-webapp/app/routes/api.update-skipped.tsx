import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node"
import { updateSkipped } from "~/server/skipped.server"
import { getUserIdFromRequest } from "~/utils/auth"

export const action: ActionFunction = async ({
	request,
}: ActionFunctionArgs) => {
	const params = await request.json()
	const user_id = await getUserIdFromRequest({ request })

	return await updateSkipped({
		...params,
		user_id,
	})
}

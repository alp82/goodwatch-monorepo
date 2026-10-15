import type { ActionFunctionArgs } from "@remix-run/node"
import {
	loader,
	action as productionAction,
} from "../../../../app/routes/api.auth.$.ts"
export { loader }
export async function action(args: ActionFunctionArgs) {
	const token = new URL(args.request.url).pathname.endsWith("/token")
	const grantType = token
		? new URLSearchParams(await args.request.clone().text()).get("grant_type")
		: undefined
	const response = await productionAction(args)
	if (token)
		console.log(
			JSON.stringify({
				event: "local-token",
				grantType,
				status: response.status,
			}),
		)
	return response
}

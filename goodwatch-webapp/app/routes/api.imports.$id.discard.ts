import { type ActionFunctionArgs, json } from "@remix-run/node"
import { importId, withMember } from "~/server/imports/http.server"
import { discardImport } from "~/server/imports/service.server"
import { WishlistMatchError } from "~/server/imports/wishlist-resolution.server"
export const action = ({ request, params }: ActionFunctionArgs) =>
	withMember(request, async (member, headers) => {
		if (request.method !== "POST")
			throw new WishlistMatchError(405, "method_not_allowed")
		return json(
			{ resolution: await discardImport(member, importId(params)) },
			{ headers },
		)
	})

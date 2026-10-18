import { type ActionFunctionArgs, json } from "@remix-run/node"
import { importId, withMember } from "~/server/imports/http.server"
import { resolveWishlistImport } from "~/server/imports/service.server"
import {
	WishlistMatchError,
	readWishlistResolutionBody,
} from "~/server/imports/wishlist-resolution.server"

export const action = ({ request, params }: ActionFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		if (request.method !== "POST")
			throw new WishlistMatchError(405, "method_not_allowed")
		return json(
			await resolveWishlistImport(
				userId,
				importId(params),
				await readWishlistResolutionBody(request),
			),
			{ status: 201, headers },
		)
	})

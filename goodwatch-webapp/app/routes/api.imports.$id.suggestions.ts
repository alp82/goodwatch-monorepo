import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { importId, withMember } from "~/server/imports/http.server"
import { getWishlistSuggestions } from "~/server/imports/service.server"
import { WishlistMatchError } from "~/server/imports/wishlist-resolution.server"

export const loader = ({ request, params }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		if (request.method !== "GET")
			throw new WishlistMatchError(405, "method_not_allowed")
		const query = new URL(request.url).searchParams
		const rawOffset = query.get("offset") ?? "0"
		const offset = Number(rawOffset)
		if (
			[...query.keys()].some((key) => key !== "offset") ||
			query.getAll("offset").length > 1 ||
			!/^\d+$/.test(rawOffset) ||
			!Number.isSafeInteger(offset) ||
			offset > 50_000
		)
			throw new WishlistMatchError(400, "wishlist_search_invalid")
		return json(
			await getWishlistSuggestions(
				userId,
				importId(params),
				offset,
				request.signal,
			),
			{ headers },
		)
	})

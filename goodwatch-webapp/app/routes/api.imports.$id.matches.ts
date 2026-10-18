import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { importId, withMember } from "~/server/imports/http.server"
import {
	getWishlistMatchGroup,
	getWishlistMatchingGroups,
	searchWishlistMatches,
} from "~/server/imports/service.server"
import { WishlistMatchError } from "~/server/imports/wishlist-resolution.server"

export const loader = ({ request, params }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		if (request.method !== "GET")
			throw new WishlistMatchError(405, "method_not_allowed")
		const query = new URL(request.url).searchParams
		const id = importId(params)
		if (query.has("entry")) {
			const entry = query.get("entry") ?? ""
			if (
				!/^\d+$/.test(entry) ||
				["q", "index", "offset", "type"].some((key) => query.has(key))
			)
				throw new WishlistMatchError(400, "wishlist_search_invalid")
			return json(await getWishlistMatchGroup(userId, id, Number(entry)), {
				headers,
			})
		}

		if (query.has("q") || query.has("index")) {
			const index = query.get("index")
			if (!index || !/^\d+$/.test(index) || !query.has("q"))
				throw new WishlistMatchError(400, "wishlist_search_invalid")
			return json(
				await searchWishlistMatches(userId, id, {
					index: Number(index),
					query: query.get("q"),
					...(query.has("type") ? { mediaType: query.get("type") } : {}),
				}),
				{ headers },
			)
		}
		const offset = query.get("offset") ?? "0"
		if (!/^\d+$/.test(offset))
			throw new WishlistMatchError(400, "wishlist_search_invalid")
		return json(await getWishlistMatchingGroups(userId, id, Number(offset)), {
			headers,
		})
	})

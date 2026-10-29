// Wishlist still has separate member and guest destinations.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { GUEST, member, oldToNew, moveResponse } from "~/domain/member-paths"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const userId = await getUserIdFromRequest({ request })
	const move = oldToNew(url.pathname, url.search, userId ? member(null) : GUEST)
	if (!move) throw new Response("Not found", { status: 404 })
	// The orchestrator explicitly chose a permanent move for guests.
	return moveResponse(userId ? move : { ...move, status: 301, private: false })
}

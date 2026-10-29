// Compatibility address: resolve the session viewer only when the move depends on them.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { GUEST, member, oldToNew, moveResponse } from "~/domain/member-paths"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const shared = oldToNew(url.pathname, url.search, GUEST)
	if (!shared) throw new Response("Not found", { status: 404 })
	if (!shared.private) return moveResponse(shared)
	const userId = await getUserIdFromRequest({ request })
	const profile = userId ? await getCachedProfileByUserId(userId) : null
	const viewer = userId ? member(profile?.handle ?? null) : GUEST
	const move = oldToNew(url.pathname, url.search, viewer)
	if (!move) throw new Response("Not found", { status: 404 })
	return moveResponse(move)
}

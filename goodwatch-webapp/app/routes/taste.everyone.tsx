import type { LoaderFunctionArgs } from "@remix-run/node"
import { GUEST, member, oldToNew, moveResponse } from "~/domain/member-paths"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { getUserIdFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const userId = await getUserIdFromRequest({ request })
	const profile = userId ? await getCachedProfileByUserId(userId) : null
	const move = oldToNew(
		url.pathname,
		url.search,
		userId ? member(profile?.handle ?? null) : GUEST,
	)
	if (!move) throw new Response("Not found", { status: 404 })
	return moveResponse(move)
}

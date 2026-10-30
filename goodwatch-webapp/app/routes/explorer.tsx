// Compatibility address: the shared map owns the destination and query handling.
import type { LoaderFunctionArgs } from "@remix-run/node"
import { GUEST, oldToNew, moveResponse } from "~/domain/member-paths"

export function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url)
	const move = oldToNew(url.pathname, url.search, GUEST)
	if (!move) throw new Response("Not found", { status: 404 })
	return moveResponse(move)
}

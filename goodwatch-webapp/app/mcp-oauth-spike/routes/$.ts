import type { LoaderFunctionArgs } from "@remix-run/node"
import { handleAuth } from "../auth.server"

// Better Auth serves issuer-inserted discovery outside /api/auth.
export const loader = ({ request }: LoaderFunctionArgs) => {
	if (!new URL(request.url).pathname.startsWith("/.well-known/"))
		return new Response("Not found", { status: 404 })
	return handleAuth(request)
}

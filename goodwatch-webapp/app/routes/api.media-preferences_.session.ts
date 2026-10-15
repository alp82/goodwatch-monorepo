import { json, type ActionFunctionArgs } from "@remix-run/node"
import { adoptMediaPreferencesAtSignIn } from "~/server/media-context.server"
import { getUserIdFromRequest } from "~/utils/auth"

/** APP_ORIGIN is authoritative; otherwise use the public address supplied by the request/proxy. */
function sessionOrigin(request: Request): string | null {
	if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN
	const url = new URL(request.url)
	const host =
		request.headers.get("X-Forwarded-Host")?.split(",")[0].trim() ||
		request.headers.get("Host") ||
		url.host
	const protocol =
		request.headers.get("X-Forwarded-Proto")?.split(",")[0].trim() ||
		url.protocol.slice(0, -1)
	if (!/^https?$/i.test(protocol)) return null
	try {
		const publicUrl = new URL(`${protocol}://${host}`)
		if (
			publicUrl.username ||
			publicUrl.password ||
			publicUrl.pathname !== "/" ||
			publicUrl.search ||
			publicUrl.hash
		)
			return null
		return publicUrl.origin
	} catch {
		return null
	}
}

/** Browser session establishment is the sole automatic account-adoption write boundary. */
export async function action({ request }: ActionFunctionArgs) {
	const headers = new Headers({ "Cache-Control": "private, no-store" })
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const origin = request.headers.get("Origin")
	const expectedOrigin = sessionOrigin(request)
	if (origin && origin !== expectedOrigin)
		return json({ error: "Origin mismatch" }, { status: 403, headers })
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return json({ error: "Sign in first" }, { status: 401, headers })
	const result = await adoptMediaPreferencesAtSignIn(request, userId)
	if (result.setCookie) headers.set("Set-Cookie", result.setCookie)
	return json({ changed: result.changed }, { headers })
}

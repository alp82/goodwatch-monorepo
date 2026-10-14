import { json, type ActionFunctionArgs } from "@remix-run/node"
import { adoptMediaPreferencesAtSignIn } from "~/server/media-context.server"
import { getUserIdFromRequest } from "~/utils/auth"

/** Browser session establishment is the sole automatic account-adoption write boundary. */
export async function action({ request }: ActionFunctionArgs) {
	const headers = new Headers({ "Cache-Control": "private, no-store" })
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const origin = request.headers.get("Origin")
	const expectedOrigin =
		process.env.APP_ORIGIN ||
		(process.env.NODE_ENV === "production"
			? "https://goodwatch.app"
			: new URL(request.url).origin)
	if (origin && origin !== expectedOrigin)
		return json({ error: "Origin mismatch" }, { status: 403, headers })
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return json({ error: "Sign in first" }, { status: 401, headers })
	const result = await adoptMediaPreferencesAtSignIn(request, userId)
	if (result.setCookie) headers.set("Set-Cookie", result.setCookie)
	return json({ changed: result.changed }, { headers })
}

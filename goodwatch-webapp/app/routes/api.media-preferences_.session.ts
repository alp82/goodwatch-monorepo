import { json, type ActionFunctionArgs } from "@remix-run/node"
import { adoptMediaPreferencesAtSignIn } from "~/server/media-context.server"
import { getUserIdFromRequest } from "~/utils/auth"

/** Browser session establishment is the sole automatic account-adoption write boundary. */
export async function action({ request }: ActionFunctionArgs) {
	const headers = new Headers({ "Cache-Control": "private, no-store" })
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return json({ error: "Sign in first" }, { status: 401, headers })
	const cookie = await adoptMediaPreferencesAtSignIn(request, userId)
	if (cookie) headers.set("Set-Cookie", cookie)
	return json({ ok: true }, { headers })
}

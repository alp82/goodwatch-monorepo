// The signed-in member's handle and profile picture for the account menu. Private, never cached by the browser
// beyond the menu's own query (5 minutes).
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getAccountSummary } from "~/server/account/summary.server"
import { getAuthFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	if (!user)
		return json(
			{ handle: null, avatar: { url: null, color: "amber" } },
			{ status: 401, headers },
		)
	const photo = user.user_metadata?.avatar_url
	const summary = await getAccountSummary(
		user.id,
		typeof photo === "string" && photo.startsWith("https://") ? photo : null,
	)
	return json(summary, { headers })
}

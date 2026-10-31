// How many lists the signed-in member has: the account menu's Lists count. The menu asks when it opens, so the count
// stays off the page's first load. Private, never cached.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { countListsByUser } from "~/server/share-lists/store.server"
import { getAuthFromRequest } from "~/utils/auth"

export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	if (!user) return json({ count: null }, { status: 401, headers })
	return json({ count: await countListsByUser(user.id) }, { headers })
}

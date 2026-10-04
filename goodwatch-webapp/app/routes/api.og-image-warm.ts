// Called by the browser when a list's owner shares it, so the list's card image is current by the time the link is
// pasted somewhere. A share list card takes about 20 seconds to render, too long for a link-preview bot to wait.
//
// Pages used to send this request after every page view, for every kind of page. Cards of other pages are drawn on
// their first request now, so any other path is answered and ignored: pages that were loaded before October 4, 2026
// still send it.
import type { ActionFunctionArgs } from "@remix-run/node"
import { warmShareCard } from "~/server/share-card/images.server"

const MAX_PATH_LENGTH = 512

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") return new Response(null, { status: 405 })
	// remix-serve sees HTTP behind TLS termination. Use the public origin without
	// trusting forwarded headers supplied by the caller.
	const expectedOrigin =
		process.env.APP_ORIGIN ||
		(process.env.NODE_ENV === "production"
			? "https://goodwatch.app"
			: "http://localhost:3003")
	if (request.headers.get("origin") !== expectedOrigin)
		return new Response(null, { status: 403 })

	const path = (await request.text()).trim()
	if (!path.startsWith("/") || path.length > MAX_PATH_LENGTH)
		return new Response(null, { status: 400 })

	const list = /^\/u\/[a-z][a-z0-9_]{2,29}\/lists\/([0-9A-Za-z]{10})$/.exec(
		path,
	)
	if (list) warmShareCard({ id: list[1] })
	return new Response(null, { status: 204 })
}

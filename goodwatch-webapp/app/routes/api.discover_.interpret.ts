import { json, type ActionFunctionArgs } from "@remix-run/node"
import { interpretDiscoverQuery } from "~/server/discover-query.server"
import { isSiteRequest } from "~/server/site-origin.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, 405)
	const local =
		process.env.NODE_ENV !== "production" &&
		request.headers.get("Origin") === new URL(request.url).origin
	if (!local && !isSiteRequest(request))
		return json({ error: "Invalid origin" }, 403)
	const text = await request.text()
	if (text.length > 8192) return json({ error: "Request too large" }, 413)
	let input: unknown
	try {
		input = JSON.parse(text)
	} catch {
		return json({ error: "Invalid JSON" }, 400)
	}
	if (
		!input ||
		typeof input !== "object" ||
		!("query" in input) ||
		typeof input.query !== "string" ||
		input.query.length > 512
	)
		return json({ error: "Invalid query" }, 400)
	const existing =
		"existing" in input && typeof input.existing === "string"
			? input.existing.slice(0, 4096)
			: ""
	return json(await interpretDiscoverQuery(input.query, existing), {
		headers: { "Cache-Control": "no-store" },
	})
}

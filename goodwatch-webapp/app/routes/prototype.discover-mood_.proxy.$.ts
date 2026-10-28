// PROTOTYPE - throwaway. Forwards the prototype's read-only API calls to the live site as a guest (no cookies), so the
// Discover mood prototype has real titles, search, and counts without a local snapshot or production settings.
// GET: any /api/ path. POST: only the read endpoints that take a guest body.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"

const LIVE = "https://goodwatch.app"
const POST_OK = [/^api\/discover\/results$/, /^api\/combined-search$/, /^api\/explorer\/[a-z]+$/]

async function forward(request: Request, splat: string | undefined) {
	const path = splat ?? ""
	if (!path.startsWith("api/")) return new Response("Not proxied", { status: 404 })
	// Telemetry writes: accepted and dropped.
	if (path === "api/poster-impressions") return new Response(null, { status: 204 })
	if (request.method !== "GET" && !POST_OK.some((re) => re.test(path)))
		return new Response("Writes are off in the prototype", { status: 403 })
	const url = new URL(request.url)
	const upstream = await fetch(`${LIVE}/${path}${url.search}`, {
		method: request.method,
		headers: {
			"content-type": request.headers.get("content-type") ?? "application/json",
			origin: LIVE,
			"accept-language": request.headers.get("accept-language") ?? "en",
			"user-agent": "goodwatch-prototype",
		},
		body: request.method === "GET" ? undefined : await request.text(),
	})
	const headers = new Headers()
	for (const name of ["content-type", "cache-control"]) {
		const value = upstream.headers.get(name)
		if (value) headers.set(name, value)
	}
	return new Response(upstream.body, { status: upstream.status, headers })
}

export const loader = ({ request, params }: LoaderFunctionArgs) => forward(request, params["*"])
export const action = ({ request, params }: ActionFunctionArgs) => forward(request, params["*"])

// PROTOTYPE - throwaway (#662). What one score does to a member's sides: ?as=<slot>&key=<title key>[&score=1..10]
// [&place=nearest|rebuild].
// Read-only. Dev only.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { momentView } from "~/server/prototype-rating-moment/index.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const key = Number(params.get("key"))
	const score = params.get("score") ? Number(params.get("score")) : null
	if (!Number.isSafeInteger(key)) throw new Response("key", { status: 400 })
	const placement = params.get("place") === "rebuild" ? "rebuild" : "nearest"
	const view = await momentView(request, params.get("as"), key, score && score >= 1 && score <= 10 ? score : null, placement)
	return json({ view }, { headers: { "Cache-Control": "private, no-store" } })
}

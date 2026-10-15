// PROTOTYPE - throwaway (#661). Dev-only JSON: where one title sits in a prototype member's Taste, for the title page
// variants. ?title=<title key>&as=owner|m1..m5. Read-only.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { sidesTitleView } from "~/server/prototype-sides-title/index.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const title = Number(params.get("title"))
	if (!Number.isSafeInteger(title)) return json({ view: null, error: "bad title" }, { status: 400 })
	const view = await sidesTitleView(request, title, params.get("as"))
	return json({ view, error: view ? null : "no snapshot yet" }, { headers: { "Cache-Control": "private, no-store" } })
}

// PROTOTYPE - throwaway. Read-only API for /prototype/rec-explorer-5 (#180, round 5): an island's fractal of closer
// titles, where a step toward a neighboring island lands, and round 4's map, region and reason answers.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { explorer5Api } from "~/server/prototype-rec-explorer-5.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await explorer5Api(request), {
		headers: { "Cache-Control": "private, no-store" },
	})
}

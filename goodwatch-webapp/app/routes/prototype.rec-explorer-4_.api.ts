// PROTOTYPE - throwaway. Read-only API for /prototype/rec-explorer-4 (#180, round 4): the map for a grouping, one
// region's titles, where each door from a title lands, a title's closest neighbors, and the close-up's reason.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { explorer4Api } from "~/server/prototype-rec-explorer-4.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await explorer4Api(request), {
		headers: { "Cache-Control": "private, no-store" },
	})
}

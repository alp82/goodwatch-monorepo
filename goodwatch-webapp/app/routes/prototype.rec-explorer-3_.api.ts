// PROTOTYPE - throwaway. Read-only API for /prototype/rec-explorer-3 (#180, round 3): the next few turns from where
// the person stands (roads, compass, doors, leap, lens), a level of the nested map, and the peek card's reason.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { explorer3Api } from "~/server/prototype-rec-explorer-3.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await explorer3Api(request), {
		headers: { "Cache-Control": "private, no-store" },
	})
}

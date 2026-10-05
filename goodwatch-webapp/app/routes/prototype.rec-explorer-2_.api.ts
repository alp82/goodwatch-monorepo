// PROTOTYPE - throwaway. Read-only streaming API for /prototype/rec-explorer-2 (#180, round 2): zoom-pyramid tiles,
// nearest titles, rooms in a direction, directors and their neighbors, and the peek card's reason. Nothing is written.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { explorer2Api } from "~/server/prototype-rec-explorer-2.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await explorer2Api(request), {
		headers: { "Cache-Control": "private, max-age=60" },
	})
}

// PROTOTYPE - throwaway. Read-only API for /prototype/rec-explorer-8 (#180, round 8): bridges of two or three islands
// (blend), what every pair of islands shares (pairs), and round 7's tree, door, map, region and reason answers.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { explorer8Api } from "~/server/prototype-rec-explorer-8.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await explorer8Api(request), {
		headers: { "Cache-Control": "private, no-store" },
	})
}

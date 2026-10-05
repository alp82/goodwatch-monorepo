// PROTOTYPE - throwaway. Read-only API for /prototype/rec-explorer-7 (#180, round 7): the titles two islands share
// (blend), and round 5's tree, door, map, region and reason answers.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { explorer7Api } from "~/server/prototype-rec-explorer-7.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(await explorer7Api(request), {
		headers: { "Cache-Control": "private, no-store" },
	})
}

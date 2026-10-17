// PROTOTYPE - throwaway (#662): the "may be forming" hint for a member, now and after a rating. Read-only.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { formingHint } from "~/server/prototype-forming-hint/index.server"

export async function loader({ request }: LoaderFunctionArgs) {
	// Other members' loved titles: development only.
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await formingHint(request), { headers: { "Cache-Control": "no-store" } })
}

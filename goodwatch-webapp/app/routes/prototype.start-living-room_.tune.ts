// PROTOTYPE - throwaway. Remote tuning: ranks a cached pool of titles by the attributes switched on and off.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { tune } from "~/server/prototype-start-living-room.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const p = new URL(request.url).searchParams
	const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean).slice(0, 8)
	try {
		return json(await tune(list("inc"), list("exc")))
	} catch (e) {
		console.error("[prototype living room] tune failed", e)
		return json({ error: "Tuning failed" }, { status: 503 })
	}
}

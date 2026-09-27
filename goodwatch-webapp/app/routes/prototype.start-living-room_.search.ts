// PROTOTYPE - throwaway. The search channel's canned searches, run once per process and kept.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { getCannedSearch } from "~/server/prototype-start-living-room.server"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const q = (new URL(request.url).searchParams.get("q") ?? "").trim().replace(/\s+/g, " ")
	// Canned queries run once per process. Round 2's remote also sends typed queries: each distinct one is a
	// real, paid reading, so they're capped in length and cached like the canned ones. Development only.
	if (q.length < 2 || q.length > 120) return json({ error: "Enter 2 to 120 characters" }, { status: 400 })
	try {
		return json(await getCannedSearch(q))
	} catch (e) {
		console.error("[prototype living room] search failed", e)
		return json({ error: "Search failed" }, { status: 503 })
	}
}

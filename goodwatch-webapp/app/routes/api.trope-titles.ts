// Other titles that carry one trope, for the Tropes sub-page's "Also in" posters and the trope cards' poster stacks.
// Read-only.
//   GET ?url=<TV Tropes page url>&type=movie|show&id=<tmdb id to skip>&n=<1-12>
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { tropePageUrl } from "~/server/profile/trope-pages"
import { loadAlsoIn } from "~/ui/details/tropes/also-in.server"

export async function loader({ request }: LoaderFunctionArgs) {
	const q = new URL(request.url).searchParams
	const url = q.get("url") ?? ""
	if (!url || tropePageUrl(url) !== url)
		return json({ error: "url=<TV Tropes page url>" }, { status: 400 })
	const type = q.get("type")
	const id = Number(q.get("id"))
	const skip =
		(type === "movie" || type === "show") && Number.isInteger(id) && id > 0
			? { type: type as "movie" | "show", id }
			: null
	const n = Math.min(12, Math.max(1, Number(q.get("n")) || 8))
	try {
		return json(await loadAlsoIn(url, skip, n), {
			headers: { "Cache-Control": "public, max-age=600" },
		})
	} catch (error) {
		console.error("Trope titles failed:", error)
		return json({ error: "Titles unavailable" }, { status: 503 })
	}
}

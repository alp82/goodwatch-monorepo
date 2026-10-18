import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getScoredTitleDetails } from "~/server/my-scores.server"
import { getUserIdFromRequest } from "~/utils/auth"

// What an opened row of Your scores (My library) shows beyond the table: the title's synopsis and tagline.
//   GET /api/my-scores/title?key=movie-603
// For members: 401 for a guest. The text is public; the endpoint is the page's, so it asks for a session too.

export async function loader({ request }: LoaderFunctionArgs) {
	if (!(await getUserIdFromRequest({ request })))
		return json({ error: "Sign in" }, { status: 401 })
	const match = /^(movie|show)-(\d+)$/.exec(new URL(request.url).searchParams.get("key") ?? "")
	if (!match) return json({ error: "Pass key=movie-603" }, { status: 400 })
	return json(await getScoredTitleDetails(match[1] as "movie" | "show", Number(match[2])), {
		headers: { "Cache-Control": "private, max-age=3600" },
	})
}

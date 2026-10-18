// PROTOTYPE - throwaway. What an opened row of the rescoring table shows: a title's synopsis, tagline and backdrop.
//   GET /prototype/my-library-rescore/title?key=movie-603
// A production build leaves the route out (PROTOTYPES in vite.config.js).
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { query } from "~/utils/crate"

export async function loader({ request }: LoaderFunctionArgs) {
	const key = new URL(request.url).searchParams.get("key") ?? ""
	const match = /^(movie|show)-(\d+)$/.exec(key)
	if (!match) return json({ error: "Pass key=movie-603" }, { status: 400 })
	const [rows] = await Promise.all([
		query<{ synopsis: string | null; tagline: string | null; backdrop_path: string | null }>(
			`SELECT synopsis, tagline, backdrop_path FROM ${match[1]} WHERE tmdb_id = ?`,
			[Number(match[2])],
		),
	])
	return json(rows[0] ?? null, { headers: { "Cache-Control": "private, max-age=3600" } })
}

import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { query } from "~/utils/crate"
import type { DiscoverResult } from "~/server/discover.server"

// Public title metadata only; account membership stays in /api/user-data.
export async function loader({ request }: LoaderFunctionArgs) {
	const keys = (new URL(request.url).searchParams.get("keys") || "").split(",")
	if (
		keys.length > 100 ||
		keys.some((key) => !/^(movie|show)-[1-9]\d*$/.test(key))
	)
		return json({ error: "Invalid title keys" }, { status: 400 })
	const groups = await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = keys
				.filter((key) => key.startsWith(`${type}-`))
				.map((key) => Number(key.split("-")[1]))
			if (!ids.length) return []
			return query<DiscoverResult>(
				`SELECT tmdb_id, title, poster_path, release_year, goodwatch_overall_score_normalized_percent, '${type}' AS media_type FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`,
				ids,
			)
		}),
	)
	return json({ titles: groups.flat() })
}

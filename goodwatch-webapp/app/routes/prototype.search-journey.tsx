// THROWAWAY: connected search; actual header and actual movie/show detail routes.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { query } from "~/utils/crate"
import { JourneyResultsPage } from "~/ui/prototype/SearchJourney"
export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const keys = new URL(request.url).searchParams.get("metadata")
	if (!keys) return json({})
	const list = keys.split(",")
	if (list.length > 40 || list.some((k) => !/^(movie|show):[1-9]\d*$/.test(k)))
		return json({ error: "Invalid title identities" }, { status: 400 })
	const groups = await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = list
				.filter((k) => k.startsWith(`${type}:`))
				.map((k) => Number(k.split(":")[1]))
			if (!ids.length) return []
			return query(
				`SELECT tmdb_id, genres, adult, imdb_id, goodwatch_overall_score_voting_count, '${type}' AS media_type FROM ${type} WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`,
				ids,
			)
		}),
	)
	return json({ titles: groups.flat() })
}
export const meta = () => [
	{ title: "Connected search prototype · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]
export const shouldRevalidate = () => false
export default JourneyResultsPage

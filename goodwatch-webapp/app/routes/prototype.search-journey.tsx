// THROWAWAY: connected search; actual header and actual movie/show detail routes.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { query } from "~/utils/crate"
import { runCombinedDescription } from "~/server/prototype-combined-d4.server"
import { JourneyResultsPage } from "~/ui/prototype/SearchJourney"
export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const q = (params.get("q") ?? "").trim().slice(0, 500)
	const kind = params.get("kind")
	if (kind && q.length >= 2) {
		try {
			if (kind === "description")
				return json(await runCombinedDescription(q, false, 100))
			if (kind !== "titles")
				return json({ error: "Unknown search kind" }, { status: 400 })
			const fetchPage = async (page: number) => {
				const url = new URL("https://api.themoviedb.org/3/search/multi")
				url.search = new URLSearchParams({
					api_key: process.env.TMDB_API_KEY ?? "",
					query: q,
					language: "en-US",
					include_adult: "false",
					page: String(page),
				}).toString()
				const response = await fetch(url, {
					signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
				})
				if (!response.ok)
					throw new Error(`Catalog lookup failed (${response.status})`)
				return response.json()
			}
			const first = await fetchPage(1)
			const rest = await Promise.all(
				Array.from(
					{ length: Math.max(0, Math.min(5, first.total_pages ?? 1) - 1) },
					(_, i) => fetchPage(i + 2),
				),
			)
			return json({
				results: [first, ...rest]
					.flatMap((p) => p.results ?? [])
					.map((r) => ({
						id: r.id,
						title: r.title ?? r.name,
						original: r.original_title ?? r.original_name,
						type: r.media_type,
						year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
						poster: r.poster_path ?? r.profile_path,
						popularity: r.popularity,
						knownFor: (r.known_for ?? [])
							.map((t: { title?: string; name?: string }) => t.title ?? t.name)
							.join(", "),
					})),
			})
		} catch (error) {
			return json({ error: "Search temporarily unavailable" }, { status: 502 })
		}
	}
	const keys = params.get("metadata")
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

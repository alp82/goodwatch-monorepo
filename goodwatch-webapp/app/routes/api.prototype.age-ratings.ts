// PROTOTYPE (throwaway): what Crate knows about the age rating and content of a page of Discover titles, for the
// age-filter variants in ~/ui/discover/prototype-age-filter. Not a production route.
// GET /api/prototype/age-ratings?keys=<title keys>&country=DE
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { getViewerContext } from "~/server/viewer.server"
import type {
	AgeRatingsResponse,
	LadderRow,
	TitleRating,
} from "~/ui/discover/prototype-age-filter/ratings"
import { query } from "~/utils/crate"
import { parseTitleKey, titleKey } from "~/utils/title-key"

const MAX_KEYS = 60

interface Row {
	media_type: "movie" | "show"
	tmdb_id: number
	age_certifications: string[] | null
	content_advisories: string[] | null
	suitability_kids: boolean | null
	suitability_teens: boolean | null
	suitability_family: boolean | null
}

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const keys = (params.get("keys") ?? "")
		.split(",")
		.map(Number)
		.filter((key) => Number.isSafeInteger(key) && key > 0)
		.slice(0, MAX_KEYS)
	const country = (
		params.get("country") || (await getViewerContext(request)).country
	).toUpperCase()

	const movies: number[] = []
	const shows: number[] = []
	for (const key of keys) {
		const { mediaType, tmdbId } = parseTitleKey(key)
		;(mediaType === "movie" ? movies : shows).push(tmdbId)
	}
	const columns =
		"tmdb_id, age_certifications, content_advisories, suitability_kids, suitability_teens, suitability_family"
	const [rows, ladder] = await Promise.all([
		query<Row>(
			`SELECT 'movie' AS media_type, ${columns} FROM movie WHERE tmdb_id = ANY(?)
			 UNION ALL
			 SELECT 'show' AS media_type, ${columns} FROM show WHERE tmdb_id = ANY(?)`,
			[movies as never, shows as never],
		),
		query<LadderRow>(
			`SELECT certification_code AS code, media_type, meaning, order_default
			   FROM age_certification WHERE country_code = ?
			  ORDER BY media_type, order_default`,
			[country],
		),
	])

	const titles: Record<string, TitleRating> = {}
	for (const row of rows)
		titles[titleKey(row.media_type, row.tmdb_id)] = {
			certs: row.age_certifications ?? [],
			advisories: row.content_advisories ?? [],
			kids: row.suitability_kids,
			teens: row.suitability_teens,
			family: row.suitability_family,
		}
	return json<AgeRatingsResponse>({ country, ladder, titles })
}

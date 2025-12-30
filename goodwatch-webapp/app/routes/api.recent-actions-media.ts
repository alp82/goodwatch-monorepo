import type { LoaderFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { query } from "~/utils/crate"

interface MediaItem {
	tmdb_id: number
	media_type: "movie" | "show"
}

interface MediaMetadata {
	tmdb_id: number
	media_type: "movie" | "show"
	title: string
	poster_path: string | null
}

export const loader: LoaderFunction = async ({ request }) => {
	const url = new URL(request.url)
	const itemsParam = url.searchParams.get("items")

	if (!itemsParam) {
		return json({ error: "Missing items parameter" }, { status: 400 })
	}

	let items: MediaItem[]
	try {
		items = JSON.parse(itemsParam)
	} catch {
		return json({ error: "Invalid items parameter" }, { status: 400 })
	}

	if (!Array.isArray(items) || items.length === 0) {
		return json({ media: [] })
	}

	const movies = items.filter((i) => i.media_type === "movie")
	const shows = items.filter((i) => i.media_type === "show")

	const results: MediaMetadata[] = []

	if (movies.length > 0) {
		const movieIds = movies.map((m) => m.tmdb_id)
		const movieResults = await query<{
			tmdb_id: number
			title: string
			poster_path: string | null
		}>(
			`SELECT tmdb_id, title, poster_path, backdrop_path FROM movie WHERE tmdb_id IN (${movieIds.map(() => "?").join(", ")})`,
			movieIds
		)
		results.push(
			...movieResults.map((m) => ({
				...m,
				media_type: "movie" as const,
			}))
		)
	}

	if (shows.length > 0) {
		const showIds = shows.map((s) => s.tmdb_id)
		const showResults = await query<{
			tmdb_id: number
			title: string
			poster_path: string | null
		}>(
			`SELECT tmdb_id, title, poster_path, backdrop_path FROM show WHERE tmdb_id IN (${showIds.map(() => "?").join(", ")})`,
			showIds
		)
		results.push(
			...showResults.map((s) => ({
				...s,
				media_type: "show" as const,
			}))
		)
	}

	return json({ media: results })
}

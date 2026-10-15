import type { AuthPoster } from "~/ui/auth/PosterSpotlight"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

// Well-known, well-rated films and shows for the poster wall behind the sign-in, sign-up, and password pages.
// The wall is decoration: when the catalog can't answer, the pages show without it instead of failing.
export async function getAuthPosters(): Promise<AuthPoster[]> {
	try {
		return await cached<Record<string, never>, AuthPoster[]>({
			name: "auth-posters",
			target: loadAuthPosters,
			params: {},
			ttlMinutes: 60 * 24,
		})
	} catch (error) {
		console.error("Auth posters not loaded:", error)
		return []
	}
}

type Row = { tmdb_id: number; title: string; poster_path: string }

async function loadAuthPosters(): Promise<AuthPoster[]> {
	const select = (table: "movie" | "show", minVotes: number, limit: number) =>
		query<Row>(
			`SELECT tmdb_id, title, poster_path FROM ${table}
			 WHERE poster_path IS NOT NULL AND goodwatch_overall_score_voting_count >= ${minVotes}
			 AND goodwatch_overall_score_normalized_percent >= 72
			 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${limit}`,
		)
	const [movies, shows] = await Promise.all([select("movie", 30000, 80), select("show", 8000, 40)])
	const toPoster = (type: "movie" | "show") => (row: Row): AuthPoster => ({
		key: `${type}-${row.tmdb_id}`,
		title: row.title,
		posterPath: row.poster_path,
	})
	// Two films, then a show, so any stretch of the wall has a mix.
	const m = movies.map(toPoster("movie"))
	const s = shows.map(toPoster("show"))
	const posters: AuthPoster[] = []
	while (m.length || s.length) {
		posters.push(...m.splice(0, 2))
		const show = s.shift()
		if (show) posters.push(show)
	}
	return posters
}

// PROTOTYPE - throwaway. Read-only poster pool for the /sign-in redesign variants (?variant=).
// Loads well-known, high-scoring films and shows with poster and backdrop from Crate, cached in memory.
import type { SignInTitle } from "~/ui/prototype-sign-in/types"
import { query } from "~/utils/crate"

const TMDB = "https://image.tmdb.org/t/p"

type Row = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string
	backdrop_path: string
	score: number | null
}

const COLS = `tmdb_id, title, release_year, poster_path, backdrop_path, goodwatch_overall_score_normalized_percent AS score`

let cache: SignInTitle[] | null = null

export async function getSignInTitles(): Promise<SignInTitle[]> {
	if (cache) return cache
	const [movies, shows] = await Promise.all([
		query<Row>(
			`SELECT ${COLS} FROM movie WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL
			 AND goodwatch_overall_score_voting_count >= 30000 AND goodwatch_overall_score_normalized_percent >= 72
			 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 90`,
		),
		query<Row>(
			`SELECT ${COLS} FROM show WHERE poster_path IS NOT NULL AND backdrop_path IS NOT NULL
			 AND goodwatch_overall_score_voting_count >= 8000 AND goodwatch_overall_score_normalized_percent >= 72
			 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT 40`,
		),
	])
	const toTitle = (type: "movie" | "show") => (r: Row): SignInTitle => ({
		key: `${type}-${r.tmdb_id}`,
		type,
		title: r.title,
		year: r.release_year ?? 0,
		poster: `${TMDB}/w342${r.poster_path}`,
		backdrop: `${TMDB}/w1280${r.backdrop_path}`,
		score: Math.round(r.score ?? 0),
	})
	// Interleave shows into the movie list so every slice of the pool has a mix.
	const m = movies.map(toTitle("movie"))
	const s = shows.map(toTitle("show"))
	const out: SignInTitle[] = []
	while (m.length || s.length) {
		out.push(...m.splice(0, 2))
		if (s.length) out.push(s.shift() as SignInTitle)
	}
	cache = out
	return out
}

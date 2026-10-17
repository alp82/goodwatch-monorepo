// PROTOTYPE - throwaway. The intro's titles: the best-known good movies and shows (most votes, scored 70+), with no
// talk shows, news, reality, soaps or documentaries. Movies and shows alternate. Cached for the dev server's life.
import { loadLandingCards } from "~/server/prototype-landing.server"
import { query } from "~/utils/crate"
import type { LandingCard } from "~/server/prototype-landing.server"

const SKIP = ["Talk", "News", "Reality", "Soap", "Documentary", "Kids"]
const MOVIES = 34
const SHOWS = 24
/** The title that carries the hand-over from the pick to its attributes (chapters 3 and 4). */
export const HERO = { media_type: "movie" as const, tmdb_id: 157336 } // Interstellar

type Row = { tmdb_id: number; genres: string[] | null }

const top = async (table: "movie" | "show", n: number) => {
	const rows = (await query(
		`SELECT tmdb_id, genres FROM ${table}
		 WHERE goodwatch_overall_score_normalized_percent >= 70 AND release_year >= 1990
		 ORDER BY goodwatch_overall_score_voting_count DESC LIMIT ${n * 2}`,
	)) as Row[]
	return rows
		.filter((r) => !(r.genres ?? []).some((g) => SKIP.some((s) => g.includes(s))))
		.slice(0, n)
		.map((r) => ({ media_type: table, tmdb_id: r.tmdb_id }))
}

let cached: Promise<LandingCard[]> | null = null

export function loadPool(request: Request): Promise<LandingCard[]> {
	if (!cached) {
		cached = (async () => {
			const [movies, shows] = await Promise.all([top("movie", MOVIES), top("show", SHOWS)])
			const order: { media_type: "movie" | "show"; tmdb_id: number }[] = [HERO]
			for (let i = 0; i < Math.max(movies.length, shows.length); i++) {
				if (movies[i] && movies[i].tmdb_id !== HERO.tmdb_id) order.push(movies[i])
				if (shows[i]) order.push(shows[i])
			}
			const cards = await loadLandingCards(request, order.slice(0, 60) as never, 60)
			return cards
		})()
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}

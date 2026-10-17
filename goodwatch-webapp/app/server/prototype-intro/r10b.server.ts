// PROTOTYPE - throwaway. Round 10 "r10b": the "For you" pick now follows "How Interstellar feels", so it must land on
// another title. Real guest recommendations for two loved pool movies (Interstellar and Inception: the visitor has
// just seen Interstellar's feel), and the best-ranked famous pool movie among them, with its real match.
import { getGuestMovieRecommendations } from "~/server/guest-recommendations.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { loadPool } from "~/server/prototype-intro/pool.server"

export type R10bData = { loved: number[]; pick: number | null; match: number | null; rank: number | null }

let cached: Promise<R10bData> | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R10bData> {
	if (!cached) {
		cached = (async () => {
			const pool = await loadPool(request)
			const loved = [157336, 27205]
				.map((id) => pool.find((c) => c.media_type === "movie" && c.tmdb_id === id))
				.filter((c): c is LandingCard => Boolean(c))
			const recs = await getGuestMovieRecommendations({
				scored_items: loved.map((c) => ({ tmdb_id: c.tmdb_id, media_type: "movie" as const, score: 10 })),
				exclude_ids: loved.map((c) => ({ tmdb_id: c.tmdb_id, media_type: "movie" as const })),
				limit: 60,
			})
			const at = recs.findIndex((r) => pool.some((c) => c.media_type === "movie" && c.tmdb_id === r.tmdb_id && c.poster_path))
			const r = at >= 0 ? recs[at] : null
			const card = r ? pool.find((c) => c.media_type === "movie" && c.tmdb_id === r.tmdb_id) : null
			return {
				loved: loved.map((c) => c.key),
				pick: card?.key ?? null,
				match: r ? ((r as unknown as { match_percentage?: number }).match_percentage ?? null) : null,
				rank: at >= 0 ? at + 1 : null,
			}
		})()
		cached.catch(() => {
			cached = null
		})
	}
	return cached
}

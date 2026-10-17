// PROTOTYPE - throwaway. Data for the round 5 "One score" and "Picked for you" clips (IntroData.extra.r5score):
// - the five numbers behind the GoodWatch score (IMDb, Rotten Tomatoes critics and audience, Metacritic critics and
//   users) for the intro's pool titles;
// - a real guest pick: what the guest recommendations give for two loved pool titles, and the hero's match there.
// Kept in memory for the dev server's life.
import { getGuestMovieRecommendations } from "~/server/guest-recommendations.server"
import { loadPool } from "~/server/prototype-intro/pool.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { query } from "~/utils/crate"

export type FiveScores = {
	key: number
	imdb: number | null
	tomatometer: number | null
	rtAudience: number | null
	metacritic: number | null
	metacriticUser: number | null
}
export type R5ScoreData = {
	sources: FiveScores[]
	/** The loved titles the pick is made from, and the hero's place and match among the guest recommendations. */
	pick: { loved: number[]; heroRank: number | null; heroMatch: number | null; others: number[] }
}

let kept: Promise<R5ScoreData> | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R5ScoreData> {
	if (!kept) {
		kept = build(request)
		kept.catch(() => {
			kept = null
		})
	}
	return kept
}

async function build(request: Request): Promise<R5ScoreData> {
	const pool = (await loadPool(request)).slice(0, 30)
	const rows = async (table: "movie" | "show") => {
		const list = pool.filter((c) => c.media_type === table)
		if (!list.length) return []
		const found = await query<{ tmdb_id: number; imdb: number | null; mc: number | null; mcu: number | null; rt: number | null; rta: number | null }>(
			`SELECT tmdb_id, imdb_user_score_original AS imdb, metacritic_meta_score_original AS mc,
			        metacritic_user_score_original AS mcu, rotten_tomatoes_tomato_score_original AS rt,
			        rotten_tomatoes_audience_score_original AS rta
			   FROM ${table} WHERE tmdb_id IN (${list.map(() => "?").join(",")})`,
			list.map((c) => c.tmdb_id),
		)
		return found.map((r) => ({
			key: list.find((c) => c.tmdb_id === r.tmdb_id)?.key ?? 0,
			imdb: r.imdb,
			tomatometer: r.rt,
			rtAudience: r.rta,
			metacritic: r.mc,
			metacriticUser: r.mcu,
		}))
	}
	const sources = [...(await rows("movie")), ...(await rows("show"))]

	// The pick: two loved pool movies (Inception and The Dark Knight when the pool has them), the hero excluded from
	// nothing, so its real place among the recommendations shows.
	const hero = pool[0]
	const lovedCards = [27205, 155]
		.map((id) => pool.find((c) => c.media_type === "movie" && c.tmdb_id === id))
		.filter((c): c is LandingCard => Boolean(c))
	const loved = lovedCards.length === 2 ? lovedCards : pool.filter((c) => c.media_type === "movie" && c.key !== hero.key).slice(0, 2)
	let heroRank: number | null = null
	let heroMatch: number | null = null
	let others: number[] = []
	try {
		const recs = await getGuestMovieRecommendations({
			scored_items: loved.map((c) => ({ tmdb_id: c.tmdb_id, media_type: "movie" as const, score: 10 })),
			exclude_ids: loved.map((c) => ({ tmdb_id: c.tmdb_id, media_type: "movie" as const })),
			limit: 40,
		})
		const at = recs.findIndex((r) => r.tmdb_id === hero.tmdb_id)
		if (at >= 0) {
			heroRank = at + 1
			heroMatch = (recs[at] as unknown as { match_percentage?: number }).match_percentage ?? null
		}
		others = recs.filter((r) => r.tmdb_id !== hero.tmdb_id).slice(0, 6).map((r) => r.tmdb_id)
	} catch (e) {
		console.error("r5score pick", e)
	}
	return { sources, pick: { loved: loved.map((c) => c.key), heroRank, heroMatch, others } }
}

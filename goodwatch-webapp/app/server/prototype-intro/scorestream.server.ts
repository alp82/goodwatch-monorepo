// PROTOTYPE - throwaway. Extra data for the "scorestream" intro clips; lands in IntroData.extra["scorestream"]:
// the critic and audience numbers behind each start title's GoodWatch score, every offer of the first titles in
// Germany, the US and Britain, and the services that carry the most titles in Germany. Kept in memory for an hour.
import type { LandingCard } from "~/server/prototype-landing.server"
import { query } from "~/utils/crate"
import { ignoredProviders } from "~/utils/streaming-links"

export type SourceScores = {
	key: number
	imdb: number | null
	metacritic: number | null
	metacriticUser: number | null
	tomatometer: number | null
	rtAudience: number | null
}
export type Offer = { key: number; country: string; type: string; id: number; name: string; logo: string }
export type TopService = { id: number; name: string; logo: string; titles: number }
export type ScoreStreamData = { sources: SourceScores[]; offers: Offer[]; top: TopService[] }

let kept: { at: number; keys: string; data: ScoreStreamData } | null = null

export async function load(_request: Request, landing: LandingCard[]): Promise<ScoreStreamData> {
	const keys = landing.map((c) => c.key).join(",")
	if (kept && kept.keys === keys && Date.now() - kept.at < 3600_000) return kept.data
	const ids = (type: string) => landing.filter((c) => c.media_type === type).map((c) => c.tmdb_id)
	const sourceRows = async (table: string, type: string) => {
		const list = ids(type)
		if (!list.length) return []
		const rows = await query<{
			tmdb_id: number
			imdb: number | null
			mc: number | null
			mcu: number | null
			rt: number | null
			rta: number | null
		}>(
			`SELECT tmdb_id, imdb_user_score_original AS imdb, metacritic_meta_score_original AS mc,
			        metacritic_user_score_original AS mcu, rotten_tomatoes_tomato_score_original AS rt,
			        rotten_tomatoes_audience_score_original AS rta
			   FROM ${table} WHERE tmdb_id IN (${list.map(() => "?").join(",")})`,
			list,
		)
		return rows.map((r) => ({
			key: landing.find((c) => c.media_type === type && c.tmdb_id === r.tmdb_id)?.key ?? 0,
			imdb: r.imdb,
			metacritic: r.mc,
			metacriticUser: r.mcu,
			tomatometer: r.rt,
			rtAudience: r.rta,
		}))
	}
	const names = await query<{ id: number; name: string; logo: string }>(
		`SELECT tmdb_id AS id, name, logo_path AS logo FROM streaming_service
		  WHERE tmdb_id NOT IN (${ignoredProviders.join(",")}) AND logo_path IS NOT NULL`,
	)
	const byId = new Map(names.map((n) => [n.id, n]))
	const first = landing.slice(0, 8)
	const offerRows = first.length
		? await query<{ media_type: string; media_tmdb_id: number; country_code: string; streaming_type: string; streaming_service_id: number }>(
				`SELECT media_type, media_tmdb_id, country_code, streaming_type, streaming_service_id
				   FROM streaming_availability
				  WHERE country_code IN ('DE', 'US', 'GB') AND media_tmdb_id IN (${first.map(() => "?").join(",")})
				  LIMIT 2000`,
				first.map((c) => c.tmdb_id),
			)
		: []
	const offers: Offer[] = offerRows.flatMap((r) => {
		const card = first.find((c) => c.tmdb_id === r.media_tmdb_id && c.media_type === r.media_type)
		const service = byId.get(r.streaming_service_id)
		if (!card || !service) return []
		return [{ key: card.key, country: r.country_code, type: r.streaming_type, id: service.id, name: service.name, logo: service.logo }]
	})
	const topRows = await query<{ id: number; titles: number }>(
		`SELECT streaming_service_id AS id, count(*) AS titles FROM streaming_availability
		  WHERE country_code = 'DE' AND streaming_type = 'flatrate'
		  GROUP BY streaming_service_id ORDER BY titles DESC LIMIT 40`,
	).catch(() => [])
	const top = topRows.flatMap((r) => {
		const s = byId.get(r.id)
		return s ? [{ id: s.id, name: s.name, logo: s.logo, titles: r.titles }] : []
	})
	const data = { sources: [...(await sourceRows("movie", "movie")), ...(await sourceRows("show", "show"))], offers, top }
	kept = { at: Date.now(), keys, data }
	return data
}

// PROTOTYPE - throwaway. Round 8 data for the "r8map" intro clips; lands in IntroData.extra["r8map"]. The owner on the
// streaming chapter: "use netflix instead of a not so well known one". So: the most famous pool title that streams on
// Netflix where the visitor lives (real availability), with its services in a few other countries, the big brands
// first in every row. Kept for an hour.
import { loadPool } from "~/server/prototype-intro/pool.server"
import type { CountryOffers, Service, Where } from "~/server/prototype-intro/r5map.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { getViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { ignoredProviders } from "~/utils/streaming-links"

export type R8MapData = {
	home: string
	/** Famous titles on Netflix where the visitor lives, most famous first; the visitor's country is the last row. */
	netflix: Where[]
	/** Netflix itself, with its logo. */
	service: Service | null
}

const NETFLIX = 8
/** The brands every visitor knows, in this order (TMDB provider ids; several where the catalog has had more than one). */
const BRANDS = [[8], [9, 119], [337], [1899, 384], [531, 2303], [15], [386, 387], [350], [283]]
const COUNTRIES = ["US", "GB", "DE", "FR", "ES", "BR", "IN", "JP", "CA", "AU", "IT", "MX"]
const brand = (name: string) =>
	name
		.toLowerCase()
		.replace(/\b(standard with ads|with ads|basic|premium|essential|plus|hbo)\b/g, "")
		.replace(/[^a-z]/g, "")

let kept: { at: number; data: Promise<R8MapData> } | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R8MapData> {
	if (!kept || Date.now() - kept.at > 3600_000) {
		kept = { at: Date.now(), data: build(request) }
		kept.data.catch(() => {
			kept = null
		})
	}
	return kept.data
}

async function build(request: Request): Promise<R8MapData> {
	const [ctx, pool] = await Promise.all([getViewerContext(request), loadPool(request).catch(() => [] as LandingCard[])])
	const home = ctx.country.toUpperCase()
	const services = (
		await query<{ id: number; name: string; logo: string }>(
			`SELECT tmdb_id AS id, name, logo_path AS logo FROM streaming_service
			  WHERE tmdb_id NOT IN (${ignoredProviders.filter((id) => id !== 119).join(",")}) AND logo_path IS NOT NULL`,
		)
	).filter((s) => !/channel/i.test(s.name))
	const byId = new Map(services.map((s) => [s.id, s]))
	// A service's rank: a big brand by its place in BRANDS, everything else after.
	const rank = (id: number) => {
		const k = BRANDS.findIndex((ids) => ids.includes(id))
		return k < 0 ? 99 : k
	}
	const want = [...new Set([home, ...COUNTRIES])]
	const rows = pool.length
		? await query<{ media_type: string; media_tmdb_id: number; country_code: string; streaming_service_id: number }>(
				`SELECT media_type, media_tmdb_id, country_code, streaming_service_id FROM streaming_availability
				  WHERE streaming_type = 'flatrate' AND country_code IN (${want.map(() => "?").join(",")})
				    AND media_tmdb_id IN (${pool.map(() => "?").join(",")})
				  LIMIT 20000`,
				[...want, ...pool.map((c) => c.tmdb_id)],
			)
		: []
	const found: { fame: number; variety: number; where: Where }[] = []
	for (const c of pool) {
		const mine = rows.filter((r) => r.media_tmdb_id === c.tmdb_id && r.media_type === c.media_type)
		if (!mine.some((r) => r.country_code === home && r.streaming_service_id === NETFLIX)) continue
		const per: CountryOffers[] = want.flatMap((country) => {
			const seen = new Set<string>()
			const list = mine
				.filter((r) => r.country_code === country)
				.flatMap((r) => {
					const s = byId.get(r.streaming_service_id)
					if (!s || seen.has(brand(s.name))) return []
					seen.add(brand(s.name))
					return [s]
				})
				.sort((p, q) => rank(p.id) - rank(q.id))
			return list.length ? [{ country, services: list.slice(0, 4) }] : []
		})
		const here = per.find((x) => x.country === home)
		// Other countries whose row leads with a big brand, those that differ from home first ("country by country"
		// only says something when the rows differ); the visitor's own country last.
		const sig = (x: CountryOffers) => x.services.map((s) => s.id).join(",")
		const others = per
			.filter((x) => x.country !== home && rank(x.services[0].id) < 99)
			.sort((a, b) => Number(sig(a) === sig(here ?? a)) - Number(sig(b) === sig(here ?? b)))
			.slice(0, 4)
		if (!here || others.length < 3) continue
		const variety = new Set([...others, here].map((x) => x.services[0].id)).size
		found.push({ fame: found.length, variety, where: { key: Number(c.key), title: c.title, poster: c.poster_path, backdrop: c.backdrop_path, countries: [...others, here] } })
	}
	// The most famous title whose rows show at least three different leading services; otherwise the most famous.
	const ranked = [...found.filter((f) => f.variety >= 3), ...found.filter((f) => f.variety < 3)]
	return { home, netflix: ranked.slice(0, 3).map((f) => f.where), service: byId.get(NETFLIX) ?? null }
}

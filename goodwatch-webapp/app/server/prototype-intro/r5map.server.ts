// PROTOTYPE - throwaway. Round 5 data for the "r5map" intro clips (chapters 7 Explorer and 8 Streaming); lands in
// IntroData.extra["r5map"]. Everything is real: the Explorer's mood islands as a guest sees them, the island pairs
// whose shared titles are the most famous (most of them in the intro's pool), the big streaming brands and the long
// tail of services with logos, and where famous pool titles stream in several countries. Kept for an hour.
import type { ExplorerIsland, ExplorerTitle } from "~/domain/explorer"
import { getExplorerMap } from "~/server/explorer/index.server"
import { getCombination } from "~/server/explorer/world.server"
import { loadPool } from "~/server/prototype-intro/pool.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { getViewerContext } from "~/server/viewer.server"
import { query } from "~/utils/crate"
import { ignoredProviders } from "~/utils/streaming-links"

export type MapTitle = { key: number; title: string; poster: string; backdrop: string | null; score: number | null }
export type MapIsland = { id: string; name: string; color: string; count: number; x: number; y: number; apart: string; titles: MapTitle[] }
export type MapPair = { a: string; b: string; count: number; famous: number; titles: MapTitle[] }
export type Service = { id: number; name: string; logo: string }
export type CountryOffers = { country: string; services: Service[] }
export type Where = { key: number; title: string; poster: string | null; backdrop: string | null; countries: CountryOffers[] }
export type R5MapData = {
	islands: MapIsland[]
	/** Island pairs, the one whose shared titles are most famous first. */
	pairs: MapPair[]
	/** The big brands, in a fixed order, with their real logos. */
	popular: Service[]
	/** Every other service with a logo that carries titles somewhere, most titles first. */
	wall: Service[]
	/** How many services GoodWatch knows across all countries. */
	serviceCount: number
	/** How many countries those services cover. */
	countryCount: number
	/** The visitor's country (as guessed), and famous titles' subscription services there and elsewhere. */
	home: string
	/** The services with subscription or free titles in the visitor's country, most titles first. */
	homeServices: number[]
	where: Where[]
}

const slim = (t: ExplorerTitle): MapTitle => ({ key: Number(t.key), title: t.title, poster: t.poster, backdrop: t.backdrop, score: t.score })

/** The brands every visitor knows, by TMDB provider id (several ids where the catalog has had more than one). */
const BRANDS = [[8], [9, 119], [337], [1899, 384], [531, 2303], [15], [386, 387], [283]]
const COUNTRIES = ["US", "GB", "DE", "FR", "ES", "BR", "IN", "JP"]
const brand = (name: string) =>
	name
		.toLowerCase()
		.replace(/\b(standard with ads|with ads|basic|premium|essential|plus|hbo)\b/g, "")
		.replace(/[^a-z]/g, "")

let kept: { at: number; data: Promise<R5MapData> } | null = null

export function load(request: Request, _landing: LandingCard[]): Promise<R5MapData> {
	if (!kept || Date.now() - kept.at > 3600_000) {
		kept = { at: Date.now(), data: build(request) }
		kept.data.catch(() => {
			kept = null
		})
	}
	return kept.data
}

async function build(request: Request): Promise<R5MapData> {
	const [ctx, pool] = await Promise.all([getViewerContext(request), loadPool(request).catch(() => [] as LandingCard[])])
	const famous = new Map(pool.map((c, i) => [Number(c.key), i]))
	const [explorer, streaming] = await Promise.all([explorerData(ctx, famous), streamingData(ctx.country, pool)])
	return { ...explorer, ...streaming }
}

async function explorerData(ctx: Awaited<ReturnType<typeof getViewerContext>>, famous: Map<number, number>) {
	const query = { grouping: "mood", services: "all", unseen: "0" }
	const map = await getExplorerMap(ctx, query)
	// Famous first, then by score: the posters an island shows.
	const rank = (ts: ExplorerTitle[]) =>
		[...ts].sort((p, q) => (famous.get(Number(p.key)) ?? 999) - (famous.get(Number(q.key)) ?? 999) || (q.score ?? 0) - (p.score ?? 0))
	const islands: MapIsland[] = map.islands.map((i: ExplorerIsland) => ({
		id: i.id,
		name: i.name,
		color: i.color,
		count: i.count,
		x: i.x,
		y: i.y,
		apart: i.apart,
		titles: rank(i.titles).slice(0, 4).map(slim),
	}))
	const pairs: MapPair[] = []
	for (const a of map.islands)
		for (const b of map.islands) {
			if (a.id >= b.id) continue
			const combo = await getCombination(ctx, query, [
				{ grouping: "mood", id: a.id },
				{ grouping: "mood", id: b.id },
			]).catch(() => null)
			if (!combo || combo.titles.length < 4) continue
			const titles = rank(combo.titles)
			pairs.push({
				a: a.id,
				b: b.id,
				count: combo.count,
				famous: titles.filter((t) => famous.has(Number(t.key))).length,
				titles: titles.slice(0, 8).map(slim),
			})
		}
	// Grim pairs make a poor first impression: sad, dark and scary ones go last.
	const grim = new Set(["scary", "dark", "sad", "disturbing", "bleak"])
	const isGrim = (p: MapPair) => grim.has(p.a) || grim.has(p.b)
	pairs.sort((p, q) => Number(isGrim(p)) - Number(isGrim(q)) || q.famous - p.famous || q.count - p.count)
	return { islands, pairs: pairs.slice(0, 6) }
}

async function streamingData(home: string, pool: LandingCard[]) {
	// Add-on channels sold inside another service ("… Amazon Channel", "… Roku Premium Channel") are left out.
	const services = (
		await query<{ id: number; name: string; logo: string }>(
			`SELECT tmdb_id AS id, name, logo_path AS logo FROM streaming_service
			  WHERE tmdb_id NOT IN (${ignoredProviders.filter((id) => id !== 119).join(",")}) AND logo_path IS NOT NULL`,
		)
	).filter((s) => !/channel/i.test(s.name))
	const byId = new Map(services.map((s) => [s.id, s]))
	// Titles per service across every country, subscription and free.
	const counts = await query<{ id: number; titles: number }>(
		`SELECT streaming_service_id AS id, count(*) AS titles FROM streaming_availability
		  WHERE streaming_type IN ('flatrate', 'free', 'ads')
		  GROUP BY streaming_service_id ORDER BY titles DESC LIMIT 600`,
	)
	const countries = await query<{ n: number }>(
		`SELECT count(DISTINCT country_code) AS n FROM streaming_availability`,
	).catch(() => [{ n: 0 }])
	const seen = new Set<string>()
	const popular: Service[] = []
	for (const ids of BRANDS) {
		const s = ids.map((id) => byId.get(id)).find(Boolean)
		if (s && !seen.has(brand(s.name))) {
			seen.add(brand(s.name))
			popular.push(s)
		}
	}
	const wall: Service[] = []
	for (const c of counts) {
		const s = byId.get(c.id)
		if (!s || seen.has(brand(s.name))) continue
		seen.add(brand(s.name))
		wall.push(s)
	}
	const serviceCount = popular.length + wall.length

	// Where famous titles stream, in a few countries: the title whose services differ most between countries first.
	const candidates = pool.slice(0, 18)
	const where: Where[] = []
	if (candidates.length) {
		const want = [...new Set([home.toUpperCase(), ...COUNTRIES])].slice(0, 9)
		const rows = await query<{ media_type: string; media_tmdb_id: number; country_code: string; streaming_service_id: number }>(
			`SELECT media_type, media_tmdb_id, country_code, streaming_service_id FROM streaming_availability
			  WHERE streaming_type = 'flatrate' AND country_code IN (${want.map(() => "?").join(",")})
			    AND media_tmdb_id IN (${candidates.map(() => "?").join(",")})
			  LIMIT 5000`,
			[...want, ...candidates.map((c) => c.tmdb_id)],
		)
		for (const c of candidates) {
			const mine = rows.filter((r) => r.media_tmdb_id === c.tmdb_id && r.media_type === c.media_type)
			const per: CountryOffers[] = want.flatMap((country) => {
				const ids = new Set<string>()
				const list = mine
					.filter((r) => r.country_code === country)
					.flatMap((r) => {
						const s = byId.get(r.streaming_service_id)
						if (!s || ids.has(brand(s.name))) return []
						ids.add(brand(s.name))
						return [s]
					})
					// Known brands first.
					.sort((p, q) => Number(!popular.some((x) => x.id === q.id)) - Number(!popular.some((x) => x.id === p.id)))
				return list.length ? [{ country, services: list.slice(0, 4) }] : []
			})
			if (per.length >= 3) where.push({ key: Number(c.key), title: c.title, poster: c.poster_path, backdrop: c.backdrop_path, countries: per })
		}
		const variety = (w: Where) => new Set(w.countries.map((c) => c.services[0]?.id)).size + (w.countries.some((c) => c.country === home) ? 2 : 0)
		where.sort((p, q) => variety(q) - variety(p))
	}
	const homeRows = await query<{ id: number; titles: number }>(
		`SELECT streaming_service_id AS id, count(*) AS titles FROM streaming_availability
		  WHERE country_code = ? AND streaming_type IN ('flatrate', 'free', 'ads')
		  GROUP BY streaming_service_id ORDER BY titles DESC LIMIT 200`,
		[home.toUpperCase()],
	).catch(() => [])
	return {
		popular,
		wall,
		serviceCount,
		countryCount: countries[0]?.n ?? 0,
		home: home.toUpperCase(),
		homeServices: homeRows.map((r) => r.id),
		where: where.slice(0, 5),
	}
}

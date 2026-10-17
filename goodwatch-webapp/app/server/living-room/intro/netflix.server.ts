// The streaming chapter's title for a country (docs/implementation/home-intro.md): the best-known intro title that
// streams on Netflix there, with its subscription services in that country and a few others, the big brands first in
// every row. Netflix because every visitor knows it. One read of Crate per country, kept for six hours; null when no
// intro title is on Netflix in that country (the chapter then shows the snapshot's rows without a "You").
import type {
	IntroCard,
	NetflixData,
	Service,
	Where,
} from "~/ui/living-room/intro/data"
import { query } from "~/utils/crate"
import { ignoredProviders } from "~/utils/streaming-links"

type CountryOffers = Where["countries"][number]

const NETFLIX = 8
const KEEP_MS = 6 * 60 * 60 * 1000
/** The brands every visitor knows, in this order (TMDB provider ids; several where the catalog has had more than one). */
const BRANDS = [
	[8],
	[9, 119],
	[337],
	[1899, 384],
	[531, 2303],
	[15],
	[386, 387],
	[350],
	[283],
]
/** The countries a title's rows can visit before the visitor's own. */
const COUNTRIES = [
	"US",
	"GB",
	"DE",
	"FR",
	"ES",
	"BR",
	"IN",
	"JP",
	"CA",
	"AU",
	"IT",
	"MX",
]

/** One name per brand: "Netflix Standard with Ads" and "Netflix" are the same row entry. */
const brand = (name: string) =>
	name
		.toLowerCase()
		.replace(
			/\b(standard with ads|with ads|basic|premium|essential|plus|hbo)\b/g,
			"",
		)
		.replace(/[^a-z]/g, "")
const rank = (id: number) => {
	const k = BRANDS.findIndex((ids) => ids.includes(id))
	return k < 0 ? 99 : k
}

const kept = new Map<
	string,
	{ at: number; data: Promise<NetflixData | null> }
>()

export function netflixFor(
	country: string,
	cards: IntroCard[],
): Promise<NetflixData | null> {
	const home = country.toUpperCase()
	const now = Date.now()
	const hit = kept.get(home)
	if (hit && now - hit.at < KEEP_MS) return hit.data
	const data = build(home, cards).catch((error) => {
		console.error(
			`The intro: the streaming chapter's title for ${home} failed`,
			error,
		)
		kept.delete(home)
		return null
	})
	kept.set(home, { at: now, data })
	return data
}

async function build(
	home: string,
	cards: IntroCard[],
): Promise<NetflixData | null> {
	if (!cards.length) return null
	const services = (
		await query<{ id: number; name: string; logo: string }>(
			`SELECT tmdb_id AS id, name, logo_path AS logo FROM streaming_service
			  WHERE tmdb_id NOT IN (${ignoredProviders.filter((id) => id !== 119).join(",")}) AND logo_path IS NOT NULL`,
		)
	).filter((s) => !/channel/i.test(s.name))
	const byId = new Map<number, Service>(services.map((s) => [s.id, s]))
	const want = [...new Set([home, ...COUNTRIES])]
	const rows = await query<{
		media_type: string
		media_tmdb_id: number
		country_code: string
		streaming_service_id: number
	}>(
		`SELECT media_type, media_tmdb_id, country_code, streaming_service_id FROM streaming_availability
		  WHERE streaming_type = 'flatrate' AND country_code IN (${want.map(() => "?").join(",")})
		    AND media_tmdb_id IN (${cards.map(() => "?").join(",")})
		  LIMIT 20000`,
		[...want, ...cards.map((c) => c.tmdb_id)],
	)
	const found: { variety: number; where: Where }[] = []
	for (const card of cards) {
		const mine = rows.filter(
			(r) =>
				r.media_tmdb_id === card.tmdb_id && r.media_type === card.media_type,
		)
		if (
			!mine.some(
				(r) => r.country_code === home && r.streaming_service_id === NETFLIX,
			)
		)
			continue
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
		// Other countries whose row leads with a big brand, those that differ from home first: "country by country"
		// says something only when the rows differ. The visitor's own country comes last.
		const sig = (x: CountryOffers) => x.services.map((s) => s.id).join(",")
		const others = per
			.filter((x) => x.country !== home && rank(x.services[0].id) < 99)
			.sort(
				(a, b) =>
					Number(sig(a) === sig(here ?? a)) - Number(sig(b) === sig(here ?? b)),
			)
			.slice(0, 4)
		if (!here || others.length < 3) continue
		const variety = new Set([...others, here].map((x) => x.services[0].id)).size
		found.push({
			variety,
			where: {
				key: Number(card.key),
				title: card.title,
				poster: card.poster_path,
				backdrop: card.backdrop_path,
				countries: [...others, here],
			},
		})
	}
	// The best-known title whose rows show at least three different leading services; otherwise the best-known.
	const ranked = [
		...found.filter((f) => f.variety >= 3),
		...found.filter((f) => f.variety < 3),
	]
	const service = byId.get(NETFLIX) ?? null
	if (!ranked.length || !service) return null
	return { home, netflix: ranked.slice(0, 1).map((f) => f.where), service }
}

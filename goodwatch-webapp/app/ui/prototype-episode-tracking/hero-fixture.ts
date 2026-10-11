// HARNESS - development only. What the real hero (ui/details/hero/DetailsHero.tsx) reads of a title besides the
// member's marks, for the two harnesses that mount it: the scores of the sites, a trailer, and who streams it.
// The logos are TMDB's; the numbers are made up. `providers` picks how many services have the title.

// "one", "many" and "none" are what Germany has; other countries have the title too. "only" is "one" with no other
// country, "nowhere" is no offer in any country. "stale" is "one" in details cached before they carried the other
// countries: the country list then learns them from its own request.
export type HeroProviders = "one" | "many" | "none" | "only" | "nowhere" | "stale"

const SERVICES = [
	{ tmdb_id: 8, name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png" },
	{ tmdb_id: 9, name: "Amazon Prime Video", logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png" },
	{ tmdb_id: 531, name: "Paramount Plus", logo: "/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png" },
	{ tmdb_id: 538, name: "Plex", logo: "/blAEhvx3XX8sV0fFVFk88FFjubs.png" },
	{ tmdb_id: 192, name: "YouTube", logo: "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png" },
	{ tmdb_id: 2, name: "Apple TV Store", logo: "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png" },
	{ tmdb_id: 10, name: "Amazon Video", logo: "/jn6TLbtaTZntTRX9UYucHJvpQx1.png" },
	{ tmdb_id: 3, name: "Google Play Movies", logo: "/aZRENwYILujqs0RVOZutTh0BVGV.png" },
	{ tmdb_id: 7, name: "Fandango At Home", logo: "/wpOt6x0dRxTrIzuBosto4LGd7E9.png" },
	{ tmdb_id: 331, name: "FlixFling", logo: "/hkw2s2Su8EyifB9EbbQP64Fj1xA.png" },
	{ tmdb_id: 2285, name: "JustWatch TV", logo: "/aJXLTvX11u4fBLMPRVJZVKkLYHP.png" },
].map((service, index) => ({ ...service, order_default: index }))

const OFFERS: Record<HeroProviders, Record<"flatrate" | "rent" | "buy", number[]>> = {
	one: { flatrate: [8], rent: [], buy: [] },
	many: { flatrate: [8, 9, 531, 538, 192, 331, 2285], rent: [2, 10, 3, 192, 7, 331], buy: [2, 10, 3] },
	none: { flatrate: [], rent: [], buy: [] },
	only: { flatrate: [8], rent: [], buy: [] },
	nowhere: { flatrate: [], rent: [], buy: [] },
	stale: { flatrate: [8], rent: [], buy: [] },
}

// The other countries' offers, as the details carry them in short: services per tab (stream, rent, buy) for each
// country, and the four countries with most services per tab. The country list's stand-in server answers the rest.
const ELSEWHERE: Record<string, [number[], number[], number[]]> = {
	US: [[8, 9, 531, 538], [2, 3, 192], [2, 3]],
	GB: [[8, 9, 538], [2, 3], [2]],
	CA: [[8, 531], [2], []],
	FR: [[9, 531], [], [2]],
	AU: [[8, 9], [], []],
	NL: [[8], [], []],
	JP: [[9], [2], []],
	BR: [[531], [], []],
}
function countries(providers: HeroProviders) {
	if (providers === "nowhere") return {}
	const offers = OFFERS[providers]
	const here: [number[], number[], number[]] = [offers.flatrate, offers.rent, offers.buy]
	return { ...(providers === "only" ? {} : ELSEWHERE), ...(here.some((ids) => ids.length) ? { DE: here } : {}) }
}
function shortCountries(providers: HeroProviders) {
	const all = Object.entries(countries(providers))
	const top = (tab: number) =>
		all
			.filter(([, tabs]) => tabs[tab].length)
			.sort((a, b) => b[1][tab].length - a[1][tab].length || a[0].localeCompare(b[0]))
			.slice(0, 4)
			.map(([country_code, tabs]) => ({ country_code, ids: tabs[tab] }))
	return {
		counts: Object.fromEntries(all.map(([code, tabs]) => [code, tabs.map((ids) => ids.length)])),
		top: { flatrate: top(0), rent: top(1), buy: top(2) },
	}
}

/** The parts of a `MovieResult` or `ShowResult` the hero reads beyond the id and the title. */
export function heroParts(providers: HeroProviders, art: { poster_path?: string | null; backdrop_path?: string | null }) {
	const offers = OFFERS[providers]
	return {
		details: {
			poster_path: art.poster_path ?? null,
			backdrop_path: art.backdrop_path ?? null,
			goodwatch_overall_score_normalized_percent: 78,
			imdb_user_score_original: 7.8,
			imdb_url: "https://www.imdb.com/",
			metacritic_meta_score_original: null,
			metacritic_user_score_original: 7.8,
			metacritic_url: "https://www.metacritic.com/",
			rotten_tomatoes_tomato_score_original: 78,
			rotten_tomatoes_audience_score_original: 79,
			rotten_tomatoes_url: "https://www.rottentomatoes.com/",
			streaming_country_codes: ["DE", "US", "GB"],
		},
		videos: { trailers: [{ key: "49xWJJvpjzI" }] },
		streaming_services: SERVICES,
		streaming_countries: providers === "stale" ? undefined : shortCountries(providers),
		streaming_availabilities: (Object.keys(offers) as (keyof typeof offers)[]).flatMap((streaming_type) =>
			offers[streaming_type].map((streaming_service_id) => ({ streaming_service_id, streaming_type, stream_url: "#streaming" })),
		),
	}
}

/**
 * The member's settings, which the stand-in servers of the harnesses don't answer: Germany, and Netflix as their
 * one service, so that "yours" shows. Wrap the page's `fetch` in it.
 */
export function withMemberSettings(fetch: typeof window.fetch): typeof window.fetch {
	const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } })
	return async (input, init) => {
		const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin)
		if (url.origin === window.location.origin && url.pathname === "/api/user-settings/get") return json({ country_default: "DE", streaming_providers_default: "8" })
		if (url.origin === window.location.origin && url.pathname === "/api/countries")
			return json(["AT", "AU", "BR", "CA", "CH", "DE", "ES", "FR", "GB", "IT", "JP", "NL", "PL", "SE", "US"].map((code) => ({ code, name: new Intl.DisplayNames("en", { type: "region" }).of(code) })))
		if (url.origin === window.location.origin && url.pathname === "/api/streaming-countries")
			return json({ countries: countries((new URLSearchParams(window.location.search).get("providers") ?? "one") as HeroProviders), services: SERVICES })
		if (url.origin === window.location.origin && url.pathname === "/api/streaming-providers") return json([{ id: 8, name: "Netflix", logo_path: SERVICES[0].logo }])
		return fetch(input, init)
	}
}

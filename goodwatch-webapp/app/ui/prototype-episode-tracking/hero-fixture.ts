// HARNESS - development only. What the real hero (ui/details/hero/DetailsHero.tsx) reads of a title besides the
// member's marks, for the two harnesses that mount it: the scores of the sites, a trailer, and who streams it.
// The logos are TMDB's; the numbers are made up. `providers` picks how many services have the title.

export type HeroProviders = "one" | "many" | "none"

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
		if (url.origin === window.location.origin && url.pathname === "/api/streaming-providers") return json([{ id: 8, name: "Netflix", logo_path: SERVICES[0].logo }])
		return fetch(input, init)
	}
}

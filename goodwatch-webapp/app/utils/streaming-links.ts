export const duplicateProviders = [
	24, // Quickflix Store
	188, // YouTube Premium
	210, // Sky
	235, // YouTube Free
	380, // BritBox
	390, // Disney Plus
	524, // Discovery+
	1796, // Netflix basic with Ads
	2100, // Amazon Prime Video with Ads
]

export const duplicateProviderMapping: Record<number, number[]> = {
	2: [350], // Apple TV -> Apple TV Plus
	9: [10, 119], // Amazon Prime Video -> Amazon Video, Amazon Prime Video
}

export const ignoredProviders = [
	...duplicateProviders,
	10, // Amazon Video
	119, // Amazon Prime Video
	350, // Apple TV Plus
]

// JustWatch lists add-on channels and plan tiers separately; one entry per brand reads better.
export const brandName = (name: string) =>
	name
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Roku Premium Channel|Channel)$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")
		.replace(/\s+Plus$/i, "+")

export const getShorterProviderLabel = (label: string) => {
	switch (label) {
		case "Amazon Video":
		case "Amazon Prime Video":
		case "Amazon Prime Video with Ads":
			return "Prime"
		case "Apple TV Plus":
			return "Apple TV"
		default:
			return label
	}
}

/** The title's "where to watch" page on TMDB for a country, which lists every offer with its link. */
export const tmdbWatchUrl = (
	mediaType: "movie" | "show",
	tmdbId: number,
	country: string,
) =>
	`https://www.themoviedb.org/${mediaType === "movie" ? "movie" : "tv"}/${tmdbId}/watch?locale=${encodeURIComponent(country.toUpperCase())}`

/**
 * Where an offer's tile links to: the offer's own link, or the title's TMDB watch page when the offer has none.
 * About half of the offers come without a link of their own.
 */
export const getStreamingUrl = (
	offer: { stream_url?: string | null },
	details: { tmdb_id: number },
	country: string,
	mediaType: "movie" | "show",
) => offer.stream_url || tmdbWatchUrl(mediaType, details.tmdb_id, country)

/** The tabs of the where-to-watch block. Stream also lists the free offers. */
export type OfferTab = "flatrate" | "rent" | "buy"
export const OFFER_TABS: OfferTab[] = ["flatrate", "rent", "buy"]
export const TAB_TYPES: Record<OfferTab, string[]> = {
	flatrate: ["flatrate", "flatrate_and_buy", "free", "ads"],
	rent: ["rent"],
	buy: ["buy"],
}

/**
 * The services of these ids that the where-to-watch block shows: no ignored provider, one per brand, in the order of
 * the services of the current country. An id without a service in the catalog is left out.
 */
export function brandServices<
	S extends { tmdb_id: number; name: string; order_default?: number | null },
>(ids: Iterable<number>, catalog: ReadonlyMap<number, S>): S[] {
	const services = [...new Set(ids)]
		.filter((id) => !ignoredProviders.includes(id))
		.map((id) => catalog.get(id))
		.filter((s): s is S => s !== undefined)
		.sort(
			(a, b) =>
				(a.order_default ?? 999) - (b.order_default ?? 999) ||
				a.tmdb_id - b.tmdb_id,
		)
	const seen = new Set<string>()
	return services.filter((s) => {
		const brand = brandName(getShorterProviderLabel(s.name))
		if (seen.has(brand)) return false
		seen.add(brand)
		return true
	})
}

/**
 * Every country's services per tab (stream, rent, buy) as `brandServices` keeps them. A country whose offers all
 * fall away is left out.
 */
export function servicesByCountry<
	S extends { tmdb_id: number; name: string; order_default?: number | null },
>(
	offers: Iterable<{
		country_code: string
		streaming_type: string
		streaming_service_id: number
	}>,
	catalog: ReadonlyMap<number, S>,
): Map<string, [number[], number[], number[]]> {
	const byCountry = new Map<string, Set<number>[]>()
	for (const offer of offers) {
		const tab = OFFER_TABS.findIndex((t) =>
			TAB_TYPES[t].includes(offer.streaming_type),
		)
		if (tab < 0) continue
		const tabs =
			byCountry.get(offer.country_code) ??
			OFFER_TABS.map(() => new Set<number>())
		tabs[tab].add(offer.streaming_service_id)
		byCountry.set(offer.country_code, tabs)
	}
	const result = new Map<string, [number[], number[], number[]]>()
	for (const [code, tabs] of byCountry) {
		const lists = tabs.map((set) =>
			brandServices(set, catalog).map((s) => s.tmdb_id),
		) as [number[], number[], number[]]
		if (lists.some((list) => list.length > 0)) result.set(code, lists)
	}
	return result
}

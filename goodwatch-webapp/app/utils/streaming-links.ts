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

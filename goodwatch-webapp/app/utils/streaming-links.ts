import type {
	MovieDetails,
	StreamingLink,
	TVDetails,
} from "~/server/details.server"

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

export const getStreamingUrl = (
	link: StreamingLink,
	details: MovieDetails | TVDetails,
	country: string,
	mediaType: "movie" | "show",
) => {
	if (link.stream_url) return link.stream_url

	const { title, release_year } = details
	const titleAndYear = `${title}%20${release_year}`
	if (link.provider_name === "Apple TV") {
		return `https://tv.apple.com/search?term=${titleAndYear}`
	}
	if (link.provider_name === "Google Play Movies") {
		return `https://play.google.com/store/search?q=${titleAndYear}&c=movies&hl=en`
	}
	if (["Amazon Prime Video", "Amazon Video"].includes(link.provider_name)) {
		return `https://www.amazon.${country}/s?k=${title}&i=instant-video`
	}
	if (link.provider_name === "YouTube") {
		return `https://www.youtube.com/results?sp=mAEB&search_query=${titleAndYear}`
	}
	if (link.provider_name === "Netflix") {
		return `https://www.netflix.com/search?q=${title}`
	}
	if (link.provider_name === "Rakuten TV") {
		return `https://www.rakuten.tv/en/search?q=${title}`
	}
	if (link.provider_name === "Microsoft Store") {
		return `https://www.microsoft.com/en-us/search/explore?q=${title}`
	}
	if (link.provider_name === "maxdome Store") {
		return `https://store.maxdome.de/suche/${titleAndYear}`
	}
	if (link.provider_name === "MagentaTV") {
		return `https://store.maxdome.de/suche/${titleAndYear}`
	}
	if (link.provider_name === "MUBI") {
		return `https://mubi.com/en/search/films?query=${titleAndYear}`
	}
	if (link.provider_name === "RTL+") {
		return `https://plus.rtl.de/suche?term=${titleAndYear}&scopes=watch`
	}

	return link.tmdb_url
}

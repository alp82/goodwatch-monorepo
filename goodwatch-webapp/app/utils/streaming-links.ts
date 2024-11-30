import type {
	MovieDetails,
	StreamingLink,
	TVDetails,
} from "~/server/details.server";

export const getStreamingUrl = (
	link: StreamingLink,
	details: MovieDetails | TVDetails,
	media_type: "movie" | "tv",
) => {
	if (link.stream_url) return link.stream_url;

	const { title, release_year } = details;
	const titleAndYear = `${title}%20${release_year}`;
	if (link.provider_name === "Apple TV") {
		return `https://tv.apple.com/search?term=${titleAndYear}`;
	}
	if (link.provider_name === "Google Play Movies") {
		return `https://play.google.com/store/search?q=${titleAndYear}&c=movies&hl=en`;
	}
	if (["Amazon Prime Video", "Amazon Video"].includes(link.provider_name)) {
		return `https://www.amazon.de/s?k=Kill+Bill%3A+Vol.+1+2003&i=instant-video&__mk_de_DE=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=12QLBUQG12M85&sprefix=${titleAndYear}%2Cinstant-video%2C86&ref=nb_sb_noss`;
	}
	if (link.provider_name === "YouTube") {
		return `https://www.youtube.com/results?sp=mAEB&search_query=${titleAndYear}`;
	}
	if (link.provider_name === "Netflix") {
		return `https://www.netflix.com/search?q=${title}`;
	}
	if (link.provider_name === "Rakuten TV") {
		return `https://www.rakuten.tv/de/search?q=${title}`;
	}
	if (link.provider_name === "Microsoft Store") {
		return `https://www.microsoft.com/en-us/search/explore?q=${title}`;
	}
	if (link.provider_name === "maxdome Store") {
		return `https://store.maxdome.de/suche/${titleAndYear}`;
	}
	if (link.provider_name === "MagentaTV") {
		return `https://store.maxdome.de/suche/${titleAndYear}`;
	}
	if (link.provider_name === "MUBI") {
		return `https://mubi.com/en/search/films?query=${titleAndYear}`;
	}
	if (link.provider_name === "RTL+") {
		return `https://plus.rtl.de/suche?term=${titleAndYear}&scopes=watch`;
	}

	return link.tmdb_url;
};

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
];

export const duplicateProviderMapping = {
	2: [350], // Apple TV -> Apple TV Plus
	9: [10, 119], // Amazon Prime Video -> Amazon Video, Amazon Prime Video
};

export const ignoredProviders = [
	...duplicateProviders,
	10, // Amazon Video
	119, // Amazon Prime Video
	350, // Apple TV Plus
];

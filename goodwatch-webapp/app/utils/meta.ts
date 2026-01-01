import type { MovieDetails, TVDetails } from "~/server/details.server"

export interface PageMeta {
	title: string
	description: string
	url: string
	image: string
	alt: string
}

export type PageItem = MovieDetails | TVDetails

export interface MetaOptions {
	pageMeta: PageMeta
	item?: PageItem
	items?: PageItem[]
}

export const buildMeta = (params: MetaOptions) => {
	let jsonLdContent: Record<string, unknown> = {}
	if (params.item) {
		jsonLdContent = buildJsonLdDetail(params.pageMeta, params.item)
	} else if (params.items && params.items.length > 0) {
		jsonLdContent = buildJsonLdCollection(params.pageMeta, params.items)
	}

	const baseUrl = "https://goodwatch.app"
	const urlPath = new URL(params.pageMeta.url).pathname

	const metaTags = [
		// Basic meta tags
		{ title: params.pageMeta.title },
		{ name: "description", content: params.pageMeta.description },

		// Canonical URL
		{
			tagName: "link",
			rel: "canonical",
			href: params.pageMeta.url,
		},

		// Hreflang tags for international SEO
		{
			tagName: "link",
			rel: "alternate",
			hreflang: "x-default",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hreflang: "en",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hreflang: "en-US",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hreflang: "en-GB",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hreflang: "de",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hreflang: "de-DE",
			href: `${baseUrl}${urlPath}`,
		},

		// Additional SEO tags
		{ name: "robots", content: "index, follow" },
		{ name: "google", content: "notranslate" },

		// Open Graph
		{
			property: "og:type",
			content: params.item
				? params.item.media_type === "movie"
					? "video.movie"
					: "video.tv_show"
				: "website",
		},
		{ property: "og:site_name", content: "GoodWatch" },
		{ property: "og:title", content: params.pageMeta.title },
		{ property: "og:description", content: params.pageMeta.description },
		{ property: "og:url", content: params.pageMeta.url },
		{ property: "og:image", content: params.pageMeta.image },
		{ property: "og:image:alt", content: params.pageMeta.alt },

		// Twitter Cards
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:site", content: "@GoodWatchApp" },
		{ name: "twitter:title", content: params.pageMeta.title },
		{ name: "twitter:description", content: params.pageMeta.description },
		{ name: "twitter:image", content: params.pageMeta.image },

		// JSON-LD Schema
		{ "script:ld+json": jsonLdContent },
	]

	return metaTags
}

const buildJsonLdDetail = (
	data: PageMeta,
	details: MovieDetails | TVDetails,
) => {
	const isMovie = details.media_type === "movie"
	const isShow = details.media_type === "show"

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": isMovie ? "Movie" : "TVSeries",
		name: details.title,
		url: data.url,
		image: {
			"@type": "ImageObject",
			url: `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${details.poster_path}`,
			height: "300",
			width: "450",
		},
		description: details.synopsis,
		datePublished: details.release_year,
		dateCreated: details.release_year,
		genre: details.genres,
		keywords: details.keywords,
		// duration: "PT2H28M", // ISO 8601 duration format (2 hours, 28 minutes)
		// contentRating: "MPAA PG-13", // e.g., MPAA, FSK, BBFC ratings
		// inLanguage: ["en", "ja"], // ISO 639-1 language codes (English, Japanese)
		// countryOfOrigin: {
		// 	"@type": "Country",
		// 	name: "USA",
		// },
		// sameAs: [
		// 	"https://www.imdb.com/title/tt1375666/",
		// 	"https://en.wikipedia.org/wiki/Inception",
		// 	"https://www.rottentomatoes.com/m/inception",
		// 	"https://www.officialinceptionmovie.com/",
		// ],
	}

	if (isShow) {
		jsonLd.numberOfSeasons = details.number_of_seasons
		jsonLd.numberOfEpisodes = details.number_of_episodes

		// jsonLd.season = [
		// 	{
		// 		"@type": "TVSeason",
		// 		seasonNumber: 1,
		// 		numberOfEpisodes: 10,
		// 		name: "Quantum Horizons: Season 1",
		// 		startDate: "2023-09-15"
		// 	},
		// ]
		// jsonLd.episode = [
		// 	{
		// 		"@type": "TVEpisode",
		// 		episodeNumber: 1,
		// 		seasonNumber: 1,
		// 		name: "The Fracture Point",
		// 		datePublished: "2023-09-15"
		// 	}
		// ]
	}

	// Actors from cast
	if (details.cast?.length) {
		jsonLd.actor = details.cast.slice(0, 5).map((actor) => ({
			"@type": "Person",
			name: actor.name,
			// sameAs: "https://www.imdb.com/name/nm0634240/"
		}))
	}

	// Director
	if (details.crew) {
		const directors = details.crew.filter((person) => person.job === "Director")
		if (directors.length) {
			jsonLd.director = directors.map((p) => ({
				"@type": "Person",
				name: p.name,
				// sameAs: "https://www.imdb.com/name/nm0634240/"
			}))
		}
	}

	// Producer
	if (details.crew) {
		const producers = details.crew.filter((person) => person.job === "Producer")
		if (producers.length) {
			jsonLd.producer = producers.map((p) => ({
				"@type": "Person",
				name: p.name,
				// sameAs: "https://www.imdb.com/name/nm0634240/"
			}))
		}
	}

	// Composer
	if (details.crew) {
		const composers = details.crew.filter(
			(person) => person.job === "Original Music Composer",
		)
		if (composers.length) {
			jsonLd.musicBy = composers.map((p) => ({
				"@type": "Person",
				name: p.name,
				job: p.job,
				// sameAs: "https://www.imdb.com/name/nm0634240/"
			}))
		}
	}

	// TV SHOW CREATOR
	// creator: [
	// 	{
	// 		"@type": "Person",
	// 		name: "Sophia Rodriguez",
	// 		url: "https://example.com/crew/sophia-rodriguez"
	// 	}
	// ],

	// Ratings – assuming these properties exist on AllRatings
	if (details.goodwatch_overall_score_normalized_percent) {
		jsonLd.aggregateRating = {
			"@type": "AggregateRating",
			name: "GoodWatch Score",
			ratingValue:
				details.goodwatch_overall_score_normalized_percent.toString(),
			ratingCount: details.goodwatch_overall_score_voting_count?.toString(),
			worstRating: "1",
			bestRating: "100",
		}
	}
	// const aggregateRatings = []
	// if (detail.imdb_user_score_original) {
	// 	aggregateRatings.push({
	// 		"@type": "AggregateRating",
	// 		name: "IMDb",
	// 		bestRating: "10",
	// 		ratingValue: detail.imdb_user_score_original.toString(),
	// 		ratingCount: detail.imdb_user_score_rating_count?.toString(),
	// 	})
	// }
	// if (detail.metacritic_meta_score_original) {
	// 	aggregateRatings.push({
	// 		"@type": "AggregateRating",
	// 		name: "Metacritic Critics",
	// 		bestRating: "100",
	// 		ratingValue: detail.metacritic_meta_score_original.toString(),
	// 		ratingCount: detail.metacritic_meta_score_review_count.toString(),
	// 	})
	// }
	// if (detail.metacritic_user_score_original) {
	// 	aggregateRatings.push({
	// 		"@type": "AggregateRating",
	// 		name: "Metacritic Audience",
	// 		bestRating: "10",
	// 		ratingValue: detail.metacritic_user_score_original.toString(),
	// 		ratingCount: detail.metacritic_user_score_rating_count.toString(),
	// 	})
	// }
	// if (detail.rotten_tomatoes_tomato_score_original) {
	// 	aggregateRatings.push({
	// 		"@type": "AggregateRating",
	// 		name: "Rotten Tomatoes Critics",
	// 		bestRating: "100",
	// 		ratingValue: detail.rotten_tomatoes_tomato_score_original.toString(),
	// 		ratingCount: detail.rotten_tomatoes_tomato_score_review_count.toString(),
	// 	})
	// }
	// if (detail.rotten_tomatoes_audience_score_original) {
	// 	aggregateRatings.push({
	// 		"@type": "AggregateRating",
	// 		name: "Rotten Tomatoes Audience",
	// 		bestRating: "100",
	// 		ratingValue: detail.rotten_tomatoes_audience_score_original.toString(),
	// 		ratingCount:
	// 			detail.rotten_tomatoes_audience_score_rating_count.toString(),
	// 	})
	// }

	// Add potentialAction with the first 3 streaming links if available.
	if (details.streaming_links && details.streaming_links.length > 0) {
		jsonLd.potentialAction = details.streaming_links
			.slice(0, 5)
			.map((link) => ({
				"@type": "WatchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: link.stream_url,
					name: `Watch on ${link.provider_name}`,
					actionPlatform: [
						"http://schema.org/DesktopWebPlatform",
						"http://schema.org/IOSPlatform",
						"http://schema.org/AndroidPlatform",
						"http://schema.org/TvPlatform",
					],
					httpMethod: "GET",
				},
				expectsAcceptanceOf: {
					"@type": "Offer",
					name: link.provider_name,
					category: link.stream_type,
					// availabilityStarts: "2024-09-15T00:00:00Z",
					// availableDeliveryMethod: "http://schema.org/OnDemand",
					priceSpecification: {
						"@type": "PriceSpecification",
						price: link.price_dollar ?? 0,
						priceCurrency: "USD",
						valueAddedTaxIncluded: true,
					},
					// eligibleRegion: {
					// 	"@type": "Country",
					// 	name: "US",
					// },
				},
			}))

		jsonLd.offers = details.streaming_links.slice(0, 5).map((link) => ({
			"@type": "Offer",
			name: `Stream on ${link.provider_name}`,
			category: link.stream_type,
			availability: "https://schema.org/InStock",
			price: link.price_dollar ?? 0,
			priceCurrency: "USD",
			seller: {
				"@type": "Organization",
				name: link.provider_name,
				logo: `https://image.tmdb.org/t/p/original/${link.provider_logo_path}`,
				// url: link.provider_url,
			},
			url: link.stream_url,
		}))
	}

	// jsonLd.trailer = {
	// 	"@type": "VideoObject",
	// 		"name": "Inception Official Trailer",
	// 		"description": "Official theatrical trailer for the movie Inception.",
	// 		"thumbnailUrl": "https://www.example.com/images/inception-trailer-thumb.jpg",
	// 		"uploadDate": "2010-05-10",
	// 		"contentUrl": "https://www.youtube.com/watch?v=YoHD9XEInc0", // Direct URL to video file or player page
	// 		"embedUrl": "https://www.youtube.com/embed/YoHD9XEInc0" // URL for embedding the video
	// }

	return jsonLd
}

const buildJsonLdCollection = (
	data: PageMeta,
	items: (MovieDetails | TVDetails)[],
) => {
	return {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		name: data.title,
		description: data.description,
		url: data.url,
		image: data.image,
		publisher: {
			"@type": "Organization",
			name: "GoodWatch",
			logo: {
				"@type": "ImageObject",
				url: "https://goodwatch.app/android-chrome-512x512.png",
			},
		},
		mainEntity: {
			"@type": "ItemList",
			itemListElement: items.map((item, index) => ({
				"@type": "ListItem",
				position: index + 1,
				name: item.title,
				description: item.synopsis,
				url: item.homepage || data.url,
			})),
		},
	}
}

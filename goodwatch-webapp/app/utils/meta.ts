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

	return [
		// Basic meta tags
		{ title: params.pageMeta.title },
		{ name: "description", content: params.pageMeta.description },

		// Canonical URL
		{
			tagName: "link",
			rel: "canonical",
			href: params.pageMeta.url,
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
}

const buildJsonLdDetail = (
	data: PageMeta,
	detail: MovieDetails | TVDetails,
) => {
	const isMovie = detail.media_type === "movie"

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": isMovie ? "Movie" : "TVSeries",
		name: detail.title,
		url: data.url,
		image: `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${detail.poster_path}`,
		description: detail.synopsis,
		datePublished: detail.release_year,
		dateCreated: detail.release_year,
	}

	// Director (for movies) – assuming crew items have a 'job' property
	if (isMovie && detail.crew) {
		const directors = detail.crew.filter((person) => person.job === "Director")
		if (directors.length) {
			jsonLd.director = directors.map((d) => ({
				"@type": "Person",
				name: d.name,
			}))
		}
	}

	// Actors from cast
	if (detail.cast?.length) {
		jsonLd.actor = detail.cast.slice(0, 5).map((actor) => ({
			"@type": "Person",
			name: actor.name,
		}))
	}

	// Ratings – assuming these properties exist on AllRatings
	if (detail.aggregated_overall_score_normalized_percent) {
		jsonLd.aggregateRating = {
			"@type": "AggregateRating",
			name: "GoodWatch Score",
			bestRating: "100",
			ratingValue:
				detail.aggregated_overall_score_normalized_percent.toString(),
			ratingCount: detail.aggregated_overall_score_voting_count?.toString(),
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
	if (detail.streaming_links && detail.streaming_links.length > 0) {
		jsonLd.potentialAction = detail.streaming_links.slice(0, 3).map((link) => ({
			"@type": "WatchAction",
			target: link.stream_url,
		}))
	}

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

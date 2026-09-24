import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { personPath } from "~/utils/helpers"

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
	item?: MovieResult | ShowResult
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

		// hrefLang tags for international SEO
		{
			tagName: "link",
			rel: "alternate",
			hrefLang: "x-default",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hrefLang: "en",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hrefLang: "en-US",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hrefLang: "en-GB",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hrefLang: "de",
			href: `${baseUrl}${urlPath}`,
		},
		{
			tagName: "link",
			rel: "alternate",
			hrefLang: "de-DE",
			href: `${baseUrl}${urlPath}`,
		},

		// Additional SEO tags
		{ name: "robots", content: "index, follow" },
		{ name: "google", content: "notranslate" },

		// Open Graph
		{
			property: "og:type",
			content: params.item
				? params.item.mediaType === "movie"
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

const buildJsonLdDetail = (data: PageMeta, media: MovieResult | ShowResult) => {
	const { details } = media
	const isMovie = media.mediaType === "movie"
	const person = (p: { id: number; name: string }) => ({
		"@type": "Person",
		name: p.name,
		url: `https://goodwatch.app${personPath(p.id, p.name)}`,
	})
	const crewWith = (job: string) => media.crew.filter((c) => c.job === job).slice(0, 5).map(person)

	const jsonLd: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": isMovie ? "Movie" : "TVSeries",
		name: details.title,
		url: data.url,
		description: data.description,
		abstract: details.synopsis || undefined,
		image: details.poster_path
			? {
					"@type": "ImageObject",
					url: `https://image.tmdb.org/t/p/w500${details.poster_path}`,
					width: "500",
					height: "750",
				}
			: undefined,
		genre: details.genres,
		inLanguage: details.original_language_code || undefined,
		countryOfOrigin: details.production_country_codes?.length
			? details.production_country_codes.map((code) => ({ "@type": "Country", name: code }))
			: undefined,
		sameAs: details.imdb_id ? [`https://www.imdb.com/title/${details.imdb_id}/`] : undefined,
		actor: media.actors.length ? media.actors.slice(0, 5).map(person) : undefined,
	}

	const usCertificate = details.age_certifications?.find((c) => c.startsWith("US_"))?.split("_")[1]
	if (usCertificate) jsonLd.contentRating = usCertificate

	if (media.mediaType === "movie") {
		const d = media.details
		if (d.release_date) jsonLd.datePublished = new Date(d.release_date).toISOString().slice(0, 10)
		if (d.runtime) jsonLd.duration = `PT${Math.floor(d.runtime / 60)}H${d.runtime % 60}M`
		const directors = crewWith("Director")
		if (directors.length) jsonLd.director = directors
		const composers = crewWith("Original Music Composer")
		if (composers.length) jsonLd.musicBy = composers
	} else {
		const d = media.details
		if (d.first_air_date) jsonLd.startDate = new Date(d.first_air_date).toISOString().slice(0, 10)
		if (d.last_air_date && !d.in_production) jsonLd.endDate = new Date(d.last_air_date).toISOString().slice(0, 10)
		jsonLd.numberOfSeasons = d.number_of_seasons
		jsonLd.numberOfEpisodes = d.number_of_episodes
		const creators = crewWith("Executive Producer").slice(0, 3)
		if (creators.length) jsonLd.producer = creators
	}

	if (details.goodwatch_overall_score_normalized_percent && details.goodwatch_overall_score_voting_count) {
		jsonLd.aggregateRating = {
			"@type": "AggregateRating",
			name: "GoodWatch score",
			ratingValue: Math.floor(details.goodwatch_overall_score_normalized_percent).toString(),
			ratingCount: details.goodwatch_overall_score_voting_count.toString(),
			worstRating: "0",
			bestRating: "100",
		}
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

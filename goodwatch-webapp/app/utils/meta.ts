import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { personPath } from "~/utils/helpers"

export interface PageMeta {
	title: string
	description: string
	url: string
	// Only used in JSON-LD: og:image and twitter:image come from ogImageUrl(url).
	image: string
	// Describes the Open Graph card.
	alt: string
}

export type PageItem = MovieDetails | TVDetails

// The Open Graph image for a page URL, served by the og.$ route.
export const ogImageUrl = (pageUrl: string) => {
	const { pathname } = new URL(pageUrl, "https://goodwatch.app")
	const path = pathname.replace(/\/+$/, "")
	return `https://goodwatch.app/og${path || "/index"}.png`
}

export interface MetaOptions {
	pageMeta: PageMeta
	item?: MovieResult | ShowResult
	items?: PageItem[]
}

export const buildMeta = (params: MetaOptions) => {
	const image = ogImageUrl(params.pageMeta.url)
	let jsonLdContent: Record<string, unknown> = {}
	if (params.item) {
		jsonLdContent = buildJsonLdDetail(params.pageMeta, params.item)
	} else if (params.items && params.items.length > 0) {
		jsonLdContent = buildJsonLdCollection(params.pageMeta, params.items)
	}

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
		{ property: "og:image", content: image },
		{ property: "og:image:type", content: "image/png" },
		{ property: "og:image:width", content: "1200" },
		{ property: "og:image:height", content: "630" },
		{ property: "og:image:alt", content: params.pageMeta.alt },

		// Twitter Cards
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:site", content: "@GoodWatchApp" },
		{ name: "twitter:title", content: params.pageMeta.title },
		{ name: "twitter:description", content: params.pageMeta.description },
		{ name: "twitter:image", content: image },
		{ name: "twitter:image:alt", content: params.pageMeta.alt },

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
	const crewWith = (job: string) =>
		media.crew
			.filter((c) => c.job === job)
			.slice(0, 5)
			.map(person)

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
			? details.production_country_codes.map((code) => ({
					"@type": "Country",
					name: code,
				}))
			: undefined,
		sameAs: details.imdb_id
			? [`https://www.imdb.com/title/${details.imdb_id}/`]
			: undefined,
		actor: media.actors.length
			? media.actors.slice(0, 5).map(person)
			: undefined,
	}

	const usCertificate = details.age_certifications
		?.find((c) => c.startsWith("US_"))
		?.split("_")[1]
	if (usCertificate) jsonLd.contentRating = usCertificate

	if (media.mediaType === "movie") {
		const d = media.details
		if (d.release_date)
			jsonLd.datePublished = new Date(d.release_date).toISOString().slice(0, 10)
		if (d.runtime)
			jsonLd.duration = `PT${Math.floor(d.runtime / 60)}H${d.runtime % 60}M`
		const directors = crewWith("Director")
		if (directors.length) jsonLd.director = directors
		const composers = crewWith("Original Music Composer")
		if (composers.length) jsonLd.musicBy = composers
	} else {
		const d = media.details
		if (d.first_air_date)
			jsonLd.startDate = new Date(d.first_air_date).toISOString().slice(0, 10)
		if (d.last_air_date && !d.in_production)
			jsonLd.endDate = new Date(d.last_air_date).toISOString().slice(0, 10)
		jsonLd.numberOfSeasons = d.number_of_seasons
		jsonLd.numberOfEpisodes = d.number_of_episodes
		const creators = crewWith("Executive Producer").slice(0, 3)
		if (creators.length) jsonLd.producer = creators
	}

	// No aggregateRating: Google only accepts ratings from this site's own
	// users, and every GoodWatch score (user, official, overall) is built from
	// TMDB, IMDb, Metacritic and Rotten Tomatoes votes.

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

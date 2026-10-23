import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { OG_IMAGE } from "~/ui/og-image/format"
import { type Crumb, breadcrumbJsonLd } from "~/ui/nav/breadcrumb-trail"
import { personPath } from "~/utils/helpers"
import { watchActions } from "~/utils/watch-actions"

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

export { ogImageUrl } from "./og-image-url.ts"
import { ogImageUrl } from "./og-image-url.ts"

/**
 * The address of a page of a paged list: the first page is the list's own address, a later page carries `?page=N`.
 * Every other query parameter is a view of the same page and stays out of the canonical address.
 */
export const pagedUrl = (url: string, search: string) => {
	const page = Number.parseInt(
		new URLSearchParams(search).get("page") || "",
		10,
	)
	return page > 1 ? `${url}?page=${page}` : url
}

/**
 * What a crawler may do with a page. A public page is indexed. A page that is personal, transactional, or empty
 * without the visitor's own data is kept out of the index, and its links are still followed. The page stays
 * crawlable (no robots.txt rule), or a crawler never reads this tag.
 */
export type RobotsDirective =
	| "index, follow"
	| "noindex, follow"
	| "noindex, nofollow"

// Emoji, with the joiners, variation selectors, skin tones, and keycap marks that build them. ©, ® and ™ are
// pictographs in Unicode too, but they are text here.
const EMOJI =
	/(?![©®™])\p{Extended_Pictographic}|\u{FE0F}|\u{200D}|\u{20E3}|[\u{1F3FB}-\u{1F3FF}]|[\u{1F1E6}-\u{1F1FF}]/gu

/** The text without its emoji, such as "Discover the best Mind-Bending Movies" for "… Mind-Bending 🌀 Movies". */
export const withoutEmoji = (text: string) =>
	text
		.replace(EMOJI, "")
		.replace(/[ \t]+/g, " ")
		.replace(/ ([,.:;!?)])/g, "$1")
		.trim()

/**
 * A page's meta without emoji: the category labels carry one ("Scary 👻"), and a search result or a link preview
 * reads better without it. The title, the description, and the image's description go to the Open Graph and X tags
 * too, so they are all plain.
 */
export const plainPageMeta = (pageMeta: PageMeta): PageMeta => ({
	...pageMeta,
	title: withoutEmoji(pageMeta.title),
	description: withoutEmoji(pageMeta.description),
	alt: withoutEmoji(pageMeta.alt),
})

export interface MetaOptions {
	pageMeta: PageMeta
	item?: MovieResult | ShowResult
	items?: PageItem[]
	/** The page's trail, the page itself last, for BreadcrumbList structured data. */
	breadcrumbs?: readonly Crumb[]
	/** One directive per page: a second robots tag only makes the page's intent unclear. */
	robots?: RobotsDirective
	/** The country the title page shows offers for: its WatchActions are that country's. */
	country?: string
	/**
	 * A ranked list's entries on this page, as ItemList structured data: the paths of their pages, and the rank of the
	 * first one. Positions continue across the pages of a list.
	 */
	itemList?: { paths: readonly string[]; first: number }
	/** The paths of the previous and the next page of a paged list. */
	pages?: { prev?: string; next?: string }
	/** A blog post: og:type is article, with the days it was published and last changed (YYYY-MM-DD). */
	article?: { published: string; modified: string }
	/** Structured data the page builds itself, such as a blog post's BlogPosting and Dataset. */
	structuredData?: readonly Record<string, unknown>[]
}

export const buildMeta = (params: MetaOptions) => {
	const image = ogImageUrl(params.pageMeta.url)
	// Stays null on a page without structured data: an empty block is a block a crawler reads and reports.
	let jsonLdContent: Record<string, unknown> | null = null
	if (params.item) {
		jsonLdContent = buildJsonLdDetail(
			params.pageMeta,
			params.item,
			params.country,
		)
	} else if (params.items && params.items.length > 0) {
		jsonLdContent = buildJsonLdCollection(params.pageMeta, params.items)
	}

	const metaTags: Record<string, unknown>[] = [
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
		{ name: "robots", content: params.robots ?? "index, follow" },
		{ name: "google", content: "notranslate" },

		// Open Graph
		{
			property: "og:type",
			content: params.item
				? params.item.mediaType === "movie"
					? "video.movie"
					: "video.tv_show"
				: params.article
					? "article"
					: "website",
		},
		...(params.article
			? [
					{
						property: "article:published_time",
						content: params.article.published,
					},
					{
						property: "article:modified_time",
						content: params.article.modified,
					},
				]
			: []),
		{ property: "og:site_name", content: "GoodWatch" },
		{ property: "og:title", content: params.pageMeta.title },
		{ property: "og:description", content: params.pageMeta.description },
		{ property: "og:url", content: params.pageMeta.url },
		{ property: "og:image", content: image },
		{ property: "og:image:type", content: OG_IMAGE.type },
		{ property: "og:image:width", content: String(OG_IMAGE.width) },
		{ property: "og:image:height", content: String(OG_IMAGE.height) },
		{ property: "og:image:alt", content: params.pageMeta.alt },

		// Twitter Cards
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:site", content: "@GoodWatchApp" },
		{ name: "twitter:title", content: params.pageMeta.title },
		{ name: "twitter:description", content: params.pageMeta.description },
		{ name: "twitter:image", content: image },
		{ name: "twitter:image:alt", content: params.pageMeta.alt },
	]

	// JSON-LD Schema
	if (jsonLdContent) metaTags.push({ "script:ld+json": jsonLdContent })
	for (const block of params.structuredData ?? [])
		metaTags.push({ "script:ld+json": block })
	const breadcrumbList = params.breadcrumbs
		? breadcrumbJsonLd(params.breadcrumbs)
		: null
	if (breadcrumbList) metaTags.push({ "script:ld+json": breadcrumbList })
	if (params.itemList?.paths.length)
		metaTags.push({ "script:ld+json": itemListJsonLd(params.itemList) })
	for (const rel of ["prev", "next"] as const) {
		const path = params.pages?.[rel]
		if (path)
			metaTags.push({
				tagName: "link",
				rel,
				href: `https://goodwatch.app${path}`,
			})
	}

	return metaTags
}

/**
 * A ranked list as ItemList structured data, in the summary-page form: each entry is its position and the address of
 * its own page, which carries the entry's details.
 */
export const itemListJsonLd = ({
	paths,
	first,
}: { paths: readonly string[]; first: number }) => ({
	"@context": "https://schema.org",
	"@type": "ItemList",
	itemListElement: paths.map((path, index) => ({
		"@type": "ListItem",
		position: first + index,
		url: `https://goodwatch.app${path}`,
	})),
})

/**
 * The people of a credit list as structured data, each person once. A list can name a person once per role or job
 * (an actor with two characters), and structured data must not repeat them.
 */
export const jsonLdPeople = (people: readonly { id: number; name: string }[]) =>
	people
		.filter(
			(person, index) =>
				people.findIndex((other) => other.id === person.id) === index,
		)
		.map((person) => ({
			"@type": "Person",
			name: person.name,
			url: `https://goodwatch.app${personPath(person.id, person.name)}`,
		}))

export const buildJsonLdDetail = (
	data: PageMeta,
	media: MovieResult | ShowResult,
	country?: string,
) => {
	const { details } = media
	const isMovie = media.mediaType === "movie"
	const actors = jsonLdPeople(media.credits.actors)

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
		// A missing value is left out, never null or an empty list.
		genre: details.genres?.length ? details.genres : undefined,
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
		actor: actors.length ? actors : undefined,
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
		const directors = jsonLdPeople(media.credits.directors)
		if (directors.length) jsonLd.director = directors
		const composers = jsonLdPeople(media.credits.composers)
		if (composers.length) jsonLd.musicBy = composers
	} else {
		const d = media.details
		if (d.first_air_date)
			jsonLd.startDate = new Date(d.first_air_date).toISOString().slice(0, 10)
		if (d.last_air_date && !d.in_production)
			jsonLd.endDate = new Date(d.last_air_date).toISOString().slice(0, 10)
		if (d.number_of_seasons) jsonLd.numberOfSeasons = d.number_of_seasons
		if (d.number_of_episodes) jsonLd.numberOfEpisodes = d.number_of_episodes
		const creators = jsonLdPeople(media.credits.executive_producers)
		if (creators.length) jsonLd.producer = creators
	}

	// One WatchAction per offer with a link of its own in the page's country; none at all without one.
	const actions = country ? watchActions(media, country) : []
	if (actions.length) jsonLd.potentialAction = actions

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

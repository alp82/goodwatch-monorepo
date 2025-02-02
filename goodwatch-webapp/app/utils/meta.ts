export interface PageMeta {
	title: string
	description: string
	url: string
	image: string
	alt: string
}

export interface PageItem {
	name: string
	description: string
	url: string
}

export const buildMeta = (data: PageMeta, items: PageItem[]) => {
	const jsonLd = buildJsonLdCollection(data, items)
	return [
		// Basic meta tags
		{ title: data.title },
		{ name: "description", content: data.description },

		// Canonical URL
		{ rel: "canonical", href: data.url },

		// Open Graph
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "GoodWatch" },
		{ property: "og:title", content: data.title },
		{ property: "og:description", content: data.description },
		{ property: "og:url", content: data.url },
		{ property: "og:image", content: data.image },
		{
			property: "og:image:alt",
			content: data.alt,
		},

		// Twitter Cards
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:site", content: "@GoodWatchApp" },
		{ name: "twitter:title", content: data.title },
		{ name: "twitter:description", content: data.description },
		{ name: "twitter:image", content: data.image },

		// Additional SEO tags
		{ name: "robots", content: "index, follow" },
		{ name: "google", content: "notranslate" },

		// JSON-LD Schema
		jsonLd,
	]
}

const buildJsonLdCollection = (data: PageMeta, items: PageItem[]) => {
	return {
		"script:ld+json": {
			"@context": "https://schema.org",
			"@type": "CollectionPage",
			mainEntity: {
				"@type": "ItemList",
				itemListElement: items.map((item) => ({
					"@type": "ListItem",
					position: 1,
					name: item.name,
					description: item.description,
					url: item.url,
				})),
			},
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
			// potentialAction: {
			// 	"@type": "SearchAction",
			// 	target: {
			// 		"@type": "EntryPoint",
			// 		urlTemplate: "https://goodwatch.app/discover?q={search_term_string}",
			// 	},
			// 	"query-input": "required name=search_term_string",
			// },
		},
	}
}

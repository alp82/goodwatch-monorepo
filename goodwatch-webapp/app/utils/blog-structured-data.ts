// Structured data for blog posts: BlogPosting for every post, and Dataset for a data study with downloads. The author
// and publisher are the organization the start page describes (#organization), not a person.
// Plain Node runs blog-structured-data.test.ts on this file, so its imports are relative with the extension.

export const SITE = "https://goodwatch.app"
export const ORGANIZATION_ID = `${SITE}/#organization`
export const WEBSITE_ID = `${SITE}/#website`

export type BlogPost = {
	slug: string
	title: string
	description: string
	kind: string
	/** YYYY-MM-DD */
	published: string
	/** YYYY-MM-DD */
	updated: string
}

export const blogPostUrl = (slug: string) => `${SITE}/blog/${slug}`

const organization = {
	"@type": "Organization",
	"@id": ORGANIZATION_ID,
	name: "GoodWatch",
	url: `${SITE}/`,
	logo: `${SITE}/android-chrome-512x512.png`,
}

export function blogPostingJsonLd(post: BlogPost, image: string) {
	const url = blogPostUrl(post.slug)
	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		"@id": `${url}#article`,
		headline: post.title,
		description: post.description,
		url,
		mainEntityOfPage: url,
		image,
		datePublished: post.published,
		dateModified: post.updated,
		inLanguage: "en",
		author: organization,
		publisher: organization,
		isPartOf: { "@id": WEBSITE_ID },
	}
}

export type DatasetInfo = {
	name: string
	description: string
	/** YYYY-MM-DD, the day the data was read. */
	date: string
	keywords: string[]
	files: { name: string; path: string; description: string }[]
	sources: { name: string; url: string }[]
}

export function datasetJsonLd(post: BlogPost, dataset: DatasetInfo) {
	const url = blogPostUrl(post.slug)
	return {
		"@context": "https://schema.org",
		"@type": "Dataset",
		"@id": `${url}#dataset`,
		name: dataset.name,
		description: dataset.description,
		url,
		keywords: dataset.keywords,
		license: "https://creativecommons.org/licenses/by/4.0/",
		isAccessibleForFree: true,
		temporalCoverage: dataset.date,
		dateModified: post.updated,
		spatialCoverage: { "@type": "Place", name: "Worldwide" },
		creator: organization,
		publisher: organization,
		isBasedOn: dataset.sources.map((source) => ({
			"@type": "CreativeWork",
			name: source.name,
			url: source.url,
		})),
		distribution: dataset.files.map((file) => ({
			"@type": "DataDownload",
			name: file.name,
			description: file.description,
			encodingFormat: "text/csv",
			contentUrl: `${SITE}${file.path}`,
		})),
		subjectOf: { "@id": `${url}#article` },
	}
}

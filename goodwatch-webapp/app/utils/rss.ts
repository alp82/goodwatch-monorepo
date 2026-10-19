// An RSS 2.0 feed. The full post goes in content:encoded, so a reader, or dev.to's import, gets the whole text.
// Plain Node runs rss.test.ts on this file.

export type FeedItem = {
	title: string
	url: string
	/** YYYY-MM-DD */
	published: string
	description: string
	/** The post as HTML. */
	html: string
}

export type Feed = {
	title: string
	url: string
	feedUrl: string
	description: string
	/** YYYY-MM-DD */
	updated: string
	items: FeedItem[]
}

export const escapeXml = (text: string) =>
	text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")

// A CDATA section can't hold "]]>", so a post that has it is split around it.
const cdata = (text: string) =>
	`<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`

/** An RFC 822 date at noon UTC, so the day is the same in every time zone a reader is in. */
export const rssDate = (day: string) =>
	new Date(`${day}T12:00:00Z`).toUTCString()

export function rssFeed(feed: Feed) {
	const items = feed.items
		.map(
			(item) => `
		<item>
			<title>${escapeXml(item.title)}</title>
			<link>${escapeXml(item.url)}</link>
			<guid isPermaLink="true">${escapeXml(item.url)}</guid>
			<pubDate>${rssDate(item.published)}</pubDate>
			<description>${escapeXml(item.description)}</description>
			<content:encoded>${cdata(item.html)}</content:encoded>
		</item>`,
		)
		.join("")
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>${escapeXml(feed.title)}</title>
		<link>${escapeXml(feed.url)}</link>
		<atom:link href="${escapeXml(feed.feedUrl)}" rel="self" type="application/rss+xml"/>
		<description>${escapeXml(feed.description)}</description>
		<language>en</language>
		<lastBuildDate>${rssDate(feed.updated)}</lastBuildDate>${items}
	</channel>
</rss>
`
}

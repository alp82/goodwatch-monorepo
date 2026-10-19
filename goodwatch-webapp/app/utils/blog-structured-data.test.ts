import assert from "node:assert/strict"
import test from "node:test"
import {
	type BlogPost,
	ORGANIZATION_ID,
	WEBSITE_ID,
	blogPostingJsonLd,
	datasetJsonLd,
} from "./blog-structured-data.ts"
import { escapeXml, rssDate, rssFeed } from "./rss.ts"

const post: BlogPost = {
	slug: "a-study",
	title: "A study",
	description: "What we found.",
	kind: "Data study",
	published: "2026-10-19",
	updated: "2026-10-20",
}

test("a post is a BlogPosting by the GoodWatch organization", () => {
	const ld = blogPostingJsonLd(
		post,
		"https://goodwatch.app/og/blog/a-study.jpg",
	)
	assert.equal(ld["@type"], "BlogPosting")
	assert.equal(ld.url, "https://goodwatch.app/blog/a-study")
	assert.equal(ld.mainEntityOfPage, ld.url)
	assert.equal(ld.datePublished, "2026-10-19")
	assert.equal(ld.dateModified, "2026-10-20")
	assert.equal(ld.author["@type"], "Organization")
	assert.equal(ld.author["@id"], ORGANIZATION_ID)
	assert.equal(ld.publisher["@id"], ORGANIZATION_ID)
	assert.deepEqual(ld.isPartOf, { "@id": WEBSITE_ID })
})

test("a study's data is a Dataset with CC BY 4.0 downloads", () => {
	const ld = datasetJsonLd(post, {
		name: "Data",
		description: "Counts.",
		date: "2026-10-18",
		keywords: ["streaming"],
		files: [
			{
				name: "By country",
				path: "/blog/a-study/by-country.csv",
				description: "Rows.",
			},
		],
		sources: [{ name: "TMDB", url: "https://www.themoviedb.org" }],
	})
	assert.equal(ld["@type"], "Dataset")
	assert.equal(ld.license, "https://creativecommons.org/licenses/by/4.0/")
	assert.equal(ld.temporalCoverage, "2026-10-18")
	assert.equal(ld.creator["@id"], ORGANIZATION_ID)
	assert.deepEqual(ld.distribution, [
		{
			"@type": "DataDownload",
			name: "By country",
			description: "Rows.",
			encodingFormat: "text/csv",
			contentUrl: "https://goodwatch.app/blog/a-study/by-country.csv",
		},
	])
	assert.deepEqual(ld.subjectOf, {
		"@id": "https://goodwatch.app/blog/a-study#article",
	})
})

test("the feed escapes text and carries the full post", () => {
	assert.equal(
		escapeXml(`a & <b> "c" 'd'`),
		"a &amp; &lt;b&gt; &quot;c&quot; &apos;d&apos;",
	)
	assert.equal(rssDate("2026-10-19"), "Mon, 19 Oct 2026 12:00:00 GMT")
	const xml = rssFeed({
		title: "GoodWatch blog",
		url: "https://goodwatch.app/blog",
		feedUrl: "https://goodwatch.app/blog/rss.xml",
		description: "Studies & notes",
		updated: "2026-10-20",
		items: [
			{
				title: "A <study>",
				url: "https://goodwatch.app/blog/a-study",
				published: "2026-10-19",
				description: "What we found.",
				html: "<p>Text with ]]> inside</p>",
			},
		],
	})
	assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
	assert.match(xml, /<title>A &lt;study&gt;<\/title>/)
	assert.match(xml, /<description>Studies &amp; notes<\/description>/)
	assert.match(
		xml,
		/<guid isPermaLink="true">https:\/\/goodwatch.app\/blog\/a-study<\/guid>/,
	)
	assert.match(
		xml,
		/<content:encoded><!\[CDATA\[<p>Text with ]]]]><!\[CDATA\[> inside<\/p>]]><\/content:encoded>/,
	)
	assert.match(
		xml,
		/<atom:link href="https:\/\/goodwatch.app\/blog\/rss.xml" rel="self"/,
	)
})

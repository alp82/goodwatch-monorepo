import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { capUrls, pathPairs, sitemapXml } = await import("./sitemap.ts")

test("the sitemap lists the path pairs the tree holds, never a ?with= pair", () => {
	assert.deepEqual(pathPairs(), [
		["mood", "genre"],
		["genre", "decade"],
		["country", "genre"],
		["trope", "decade"],
	])
})

test("a list under the limit keeps its order and drops repeats", () => {
	const urls = [
		{ path: "/movies/moods", weight: 1e9 },
		{ path: "/movies/moods/cozy", weight: 900 },
		{ path: "/movies/moods/cozy", weight: 900 },
	]
	assert.deepEqual(capUrls(urls, 10), ["/movies/moods", "/movies/moods/cozy"])
})

test("over the limit, indexes and the biggest pages stay", () => {
	const urls = [
		{ path: "/movies/moods/cozy/comedy", weight: 30 },
		{ path: "/movies/moods", weight: 1e9 },
		{ path: "/movies/moods/cozy", weight: 900 },
	]
	assert.deepEqual(capUrls(urls, 2), ["/movies/moods", "/movies/moods/cozy"])
})

test("the XML escapes and lists absolute addresses", () => {
	const xml = sitemapXml(["/movies/moods/cozy", "/a&b"])
	assert.match(xml, /<loc>https:\/\/goodwatch\.app\/movies\/moods\/cozy<\/loc>/)
	assert.match(xml, /<loc>https:\/\/goodwatch\.app\/a&amp;b<\/loc>/)
	assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
})

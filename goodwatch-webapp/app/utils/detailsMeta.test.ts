import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

const { detailsPageMeta, detailsMetaTags } = await import("./detailsMeta.ts")

function media(mediaType: "movie" | "show", title = "Space: 1999", year = 1975) {
	return {
		mediaType,
		details: { title, release_year: year, tmdb_id: mediaType === "movie" ? 542499 : 134 },
		credits: { actors: [], directors: [], composers: [] },
		crew: { producers: [], writers: [] },
	} as unknown as MovieResult | ShowResult
}

for (const type of ["movie", "show"] as const) {
	test(`${type} title distinguishes the entity and shares the title to Open Graph`, () => {
		const item = media(type)
		const expected = `Space: 1999 (1975) ${type === "movie" ? "Movie" : "TV Show"}: Ratings and Streaming | GoodWatch`
		const page = detailsPageMeta(item)
		assert.equal(page.title, expected)
		assert.ok(page.title.split(" | ")[0].length <= 60)
		assert.equal(page.url, `https://goodwatch.app/${type}/${type === "movie" ? 542499 : 134}-space-1999`)
		const tags = detailsMetaTags(item)
		assert.ok(tags.some((tag) => "title" in tag && tag.title === expected))
		assert.ok(tags.some((tag) => "property" in tag && tag.property === "og:title" && tag.content === expected))
		const structured = tags.find((tag) => "script:ld+json" in tag)?.["script:ld+json"] as Record<string, unknown>
		assert.equal(structured.name, "Space: 1999")
		assert.equal(structured["@type"], type === "movie" ? "Movie" : "TVSeries")
	})
}

test("an ordinary title keeps ratings and streaming near the name", () => {
	assert.equal(detailsPageMeta(media("movie", "Interstellar", 2014)).title,
		"Interstellar (2014) Movie: Ratings and Streaming | GoodWatch")
})

test("a long name loses the suffix before any of the proper name", () => {
	const name = "The Chronicles of Narnia: Prince Caspian"
	const title = detailsPageMeta(media("movie", name, 2008)).title
	assert.equal(title, `${name} (2008) Movie | GoodWatch`)
	assert.ok(title.split(" | ")[0].length <= 60)
	const longer = "A Very Long Movie Name That Cannot Fit Within Sixty Characters Even Before the Year"
	assert.equal(detailsPageMeta(media("show", longer, 2026)).title, `${longer} (2026) TV Show | GoodWatch`)
})

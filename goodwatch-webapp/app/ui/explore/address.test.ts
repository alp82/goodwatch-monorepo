import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { exploreAddressExists, formerExplorePath, formerTvShowsPath } =
	await import("./address.ts")

test("the two type hubs exist, and no other one-segment path does", () => {
	assert.equal(exploreAddressExists({ type: "movies" }), true)
	assert.equal(exploreAddressExists({ type: "shows" }), true)
	assert.equal(exploreAddressExists({ type: "qwertyzzz" }), false)
	assert.equal(exploreAddressExists({ type: "tv-shows" }), false)
	assert.equal(exploreAddressExists({ type: "sitemaps" }), false)
	assert.equal(exploreAddressExists({}), false)
})

test("a category hub exists only under a known type and for a known category", () => {
	assert.equal(exploreAddressExists({ type: "movies", category: "moods" }), true)
	assert.equal(
		exploreAddressExists({ type: "shows", category: "streaming" }),
		true,
	)
	assert.equal(
		exploreAddressExists({ type: "movies", category: "qwertyzzz" }),
		false,
	)
	assert.equal(
		exploreAddressExists({ type: "qwertyzzz", category: "moods" }),
		false,
	)
	assert.equal(
		exploreAddressExists({ type: "sitemaps", category: "sitemap_old.xml" }),
		false,
	)
})

test("a category page exists only when the category lists it", () => {
	assert.equal(
		exploreAddressExists({ type: "movies", category: "moods", page: "scary" }),
		true,
	)
	assert.equal(
		exploreAddressExists({
			type: "movies",
			category: "moods",
			page: "qwertyzzz",
		}),
		false,
	)
	assert.equal(
		exploreAddressExists({
			type: "movies",
			category: "qwertyzzz",
			page: "scary",
		}),
		false,
	)
	assert.equal(
		exploreAddressExists({
			type: "qwertyzzz",
			category: "moods",
			page: "scary",
		}),
		false,
	)
})

test("a name that every object has is not a category or a page", () => {
	assert.equal(
		exploreAddressExists({ type: "movies", category: "constructor" }),
		false,
	)
	assert.equal(
		exploreAddressExists({
			type: "movies",
			category: "moods",
			page: "toString",
		}),
		false,
	)
})

test("an old explore address moves to the category page of the same name", () => {
	assert.equal(
		formerExplorePath("movies", "moods", "scary"),
		"/movies/moods/scary",
	)
	assert.equal(
		formerExplorePath("tv-shows", "moods", "scary"),
		"/shows/moods/scary",
	)
	assert.equal(formerExplorePath("tv", "moods", "scary"), "/shows/moods/scary")
})

test("an old explore address without a category page of that name has no new address", () => {
	assert.equal(formerExplorePath("movies", "moods", "qwertyzzz"), null)
	assert.equal(formerExplorePath("movies", "Plot", "time-travel"), null)
	assert.equal(formerExplorePath("all", "moods", "scary"), null)
})

test("a tv-shows address moves to the same path under shows and keeps its query", () => {
	assert.equal(formerTvShowsPath("/tv-shows", ""), "/shows")
	assert.equal(formerTvShowsPath("/tv-shows/", ""), "/shows")
	assert.equal(formerTvShowsPath("/tv-shows/moods", ""), "/shows/moods")
	assert.equal(formerTvShowsPath("/TV-SHOWS/moods", ""), "/shows/moods")
	assert.equal(formerTvShowsPath("/%74v-shows/moods", ""), "/shows/moods")
	assert.equal(
		formerTvShowsPath("/tv-shows/moods/scary", "?page=2"),
		"/shows/moods/scary?page=2",
	)
	assert.equal(
		formerTvShowsPath("/tv-shows/tv-shows/x/y", ""),
		"/shows/tv-shows/x/y",
	)
})

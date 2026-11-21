import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { isIndexable, browseCrumbs, MIN_INDEXED_TITLES } = await import("./indexing.ts")
const { familyPage, hub, ing, place } = await import("./address.ts")

const FULL = MIN_INDEXED_TITLES

test("hubs and family indexes for movies and shows are indexed, /all never", () => {
	assert.equal(isIndexable(hub("movie"), 0), true)
	assert.equal(isIndexable(hub("show"), 0), true)
	assert.equal(isIndexable(hub("all"), 0), false)
	assert.equal(isIndexable(familyPage("movie", "mood"), 0), true)
	assert.equal(isIndexable(familyPage("show", "trope"), 0), true)
	assert.equal(isIndexable(familyPage("all", "mood"), 0), false)
})

test("theme and style indexes and pages stay out", () => {
	assert.equal(isIndexable(familyPage("movie", "theme"), 0), false)
	assert.equal(isIndexable(familyPage("movie", "style"), 0), false)
	assert.equal(isIndexable(place("movie", [ing("theme", "crime")]), 500), false)
	assert.equal(
		isIndexable(place("movie", [ing("mood", "cozy"), ing("theme", "crime")]), 500),
		false,
	)
})

test("single places and two-part path blends need a full page", () => {
	assert.equal(isIndexable(place("movie", [ing("mood", "cozy")]), FULL), true)
	assert.equal(isIndexable(place("movie", [ing("mood", "cozy")]), FULL - 1), false)
	assert.equal(
		isIndexable(place("movie", [ing("mood", "cozy"), ing("genre", "comedy")]), FULL),
		true,
	)
	assert.equal(
		isIndexable(place("show", [ing("trope", "final-girl"), ing("decade", "1980s")]), 100),
		true,
	)
	assert.equal(isIndexable(place("all", [ing("mood", "cozy")]), 1000), false)
})

test("a pair the path doesn't hold, and three or more parts, travel as ?with= and stay out", () => {
	// mood + decade isn't a path pair: the decade goes into `with`.
	assert.equal(
		isIndexable(place("movie", [ing("mood", "cozy"), ing("decade", "1990s")]), 500),
		false,
	)
	const three = [ing("mood", "cozy"), ing("genre", "comedy"), ing("decade", "1990s")]
	assert.equal(isIndexable(place("movie", three), 500), false)
})

test("the breadcrumb trail is hub, family, page", () => {
	assert.deepEqual(browseCrumbs(hub("movie"), "Movies"), [{ label: "Movies", path: "/movies" }])
	assert.deepEqual(browseCrumbs(familyPage("show", "decade"), "Shows by decade"), [
		{ label: "Shows", path: "/shows" },
		{ label: "Decades", path: "/shows/decades" },
	])
	assert.deepEqual(
		browseCrumbs(place("movie", [ing("mood", "cozy"), ing("genre", "comedy")]), "Cozy comedies"),
		[
			{ label: "Movies", path: "/movies" },
			{ label: "Moods", path: "/movies/moods" },
			{ label: "Cozy comedies", path: "/movies/moods/cozy/comedy" },
		],
	)
	assert.deepEqual(browseCrumbs(place("movie", [ing("service", "netflix")], "de"), "Netflix"), [
		{ label: "Movies", path: "/movies" },
		{ label: "Streaming", path: "/movies/streaming/de" },
		{ label: "Netflix", path: "/movies/streaming/de/netflix" },
	])
})

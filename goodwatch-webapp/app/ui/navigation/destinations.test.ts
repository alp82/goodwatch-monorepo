// The main places the command palette says "You're here" for.
import assert from "node:assert/strict"
import { test } from "node:test"
import { currentDestination, searchHref } from "./destinations.ts"

test("Watch's pages belong to their tab", () => {
	assert.equal(currentDestination("/watch"), "upNext")
	assert.equal(currentDestination("/watch/on-hold"), "upNext")
	assert.equal(currentDestination("/watch/seen"), "upNext")
	assert.equal(currentDestination("/watch/movies"), "ready")
	assert.equal(currentDestination("/watch/movies/wishlist"), "ready")
	assert.equal(currentDestination("/watch/for-you"), "forYou")
	assert.equal(currentDestination("/watch/nope"), null)
})

test("the member's /new belongs to New; a country's pages under it belong to none", () => {
	assert.equal(currentDestination("/new"), "new")
	assert.equal(currentDestination("/new/us/netflix"), null)
	assert.equal(currentDestination("/new/us"), null)
	assert.equal(currentDestination("/newsletter"), null)
})

test("Taste is the viewer's own profile, or /taste", () => {
	assert.equal(currentDestination("/u/Ana", "ana"), "taste")
	assert.equal(currentDestination("/u/ana/stats", "ana"), "taste")
	assert.equal(currentDestination("/u/bob", "ana"), null)
	assert.equal(currentDestination("/u/ana"), null)
	assert.equal(currentDestination("/taste"), "taste")
	assert.equal(currentDestination("/taste/quiz"), "taste")
})

test("home, Explore's places, and pages outside them", () => {
	assert.equal(currentDestination("/"), "home")
	assert.equal(currentDestination("/discover"), "discover")
	assert.equal(currentDestination("/movies/genres/horror"), "movies")
	assert.equal(currentDestination("/people"), "people")
	assert.equal(currentDestination("/movie/123-heat"), null)
	assert.equal(currentDestination("/settings"), null)
})

test("a search goes to Discover's search", () => {
	assert.equal(searchHref("  heat "), "/discover?q=heat")
	assert.equal(searchHref(""), "/discover")
})

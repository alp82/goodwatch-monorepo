import "@remix-run/node"
import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
const {
	isTitleCastOffset,
	nextCastOffset,
	titleCastUrl,
	parseTitleCastParams,
	remainingCast,
	documentCast,
} = await import("./title-cast.ts")
const { loader } = await import("../routes/api.title-cast.ts")

test("cast offsets and next page boundaries count people", () => {
	for (const offset of [23, 143, 263]) assert.ok(isTitleCastOffset(offset))
	for (const offset of [
		0,
		-1,
		22,
		24,
		120,
		144,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		23.5,
		Number.MAX_SAFE_INTEGER,
	])
		assert.equal(isTitleCastOffset(offset), false)
	assert.equal(nextCastOffset(23, 143), null)
	assert.equal(nextCastOffset(23, 144), 143)
	assert.equal(nextCastOffset(143, 12), null)
	assert.equal(
		titleCastUrl({ mediaType: "movie", tmdbId: "42", offset: 23 }),
		"/api/title-cast?mediaType=movie&tmdbId=42&offset=23",
	)
	assert.deepEqual(
		parseTitleCastParams(
			new URLSearchParams("mediaType=show&tmdbId=42&offset=143"),
		),
		{ mediaType: "show", tmdbId: "42", offset: 143 },
	)
})
test("route rejects invalid parameters before loading any backend", async () => {
	for (const query of [
		"",
		"mediaType=person&tmdbId=42&offset=23",
		"mediaType=movie&tmdbId=4x&offset=23",
		"mediaType=show&tmdbId=42&offset=0",
		"mediaType=movie&tmdbId=42&offset=23.0",
		"mediaType=show&tmdbId=42&offset=1e2",
		"mediaType=movie&tmdbId=999999999999999999999&offset=23",
	]) {
		await assert.rejects(
			loader({
				request: new Request(`http://localhost/api/title-cast?${query}`),
				params: {},
				context: {},
			}),
			(error) => error instanceof Response && error.status === 400,
		)
	}
})
test("the carousel's button counts the people it can still load", () => {
	// Before any request, the document's total decides.
	assert.equal(remainingCast({ shown: 23, total: 223 }), 200)
	assert.equal(remainingCast({ shown: 24, total: 24 }), 0)
	assert.equal(remainingCast({ shown: 9, total: 9 }), 0)
	// After a page, the page's word on a next page wins over the arithmetic.
	assert.equal(remainingCast({ shown: 144, total: 223, hasMore: true }), 79)
	assert.equal(remainingCast({ shown: 223, total: 223, hasMore: false }), 0)
	assert.equal(remainingCast({ shown: 220, total: 223, hasMore: false }), 0)
	assert.equal(remainingCast({ shown: 150, total: 144, hasMore: true }), 1)
})
test("the document holds 24 slides: the whole cast, or 23 people and the button", () => {
	const people = Array.from({ length: 24 }, (_, index) => index)
	assert.deepEqual(documentCast(people, 24), people)
	assert.deepEqual(documentCast(people.slice(0, 9), 9), people.slice(0, 9))
	assert.deepEqual(documentCast(people, 25), people.slice(0, 23))
	assert.deepEqual(documentCast(people, 2655), people.slice(0, 23))
})

import assert from "node:assert/strict"
import { test } from "node:test"
import { parseWithSimilar } from "./similar-media-input.ts"

test("keeps entries with a numeric id and a known media type", () => {
	const input = JSON.stringify([
		{ tmdbId: "603", mediaType: "movie", categories: ["Mood"] },
		{ tmdbId: 1396, mediaType: "show", categories: [] },
	])
	assert.deepEqual(parseWithSimilar(input), [
		{ tmdbId: "603", mediaType: "movie", categories: ["Mood"] },
		{ tmdbId: "1396", mediaType: "show", categories: [] },
	])
})

test("drops entries whose id isn't a number or whose media type is unknown", () => {
	const input = JSON.stringify([
		{ tmdbId: "1 OR 1=1", mediaType: "movie" },
		{ tmdbId: "603; DROP", mediaType: "show" },
		{ tmdbId: "603\n", mediaType: "movie" },
		{ tmdbId: "-1", mediaType: "movie" },
		{ tmdbId: "603", mediaType: "person" },
		{ mediaType: "movie" },
		null,
		"603",
	])
	assert.deepEqual(parseWithSimilar(input), [])
})

test("treats text that isn't a JSON list as no selection", () => {
	for (const input of ["", "not json", "{}", '"603"', "null", "42"]) {
		assert.deepEqual(parseWithSimilar(input), [])
	}
})

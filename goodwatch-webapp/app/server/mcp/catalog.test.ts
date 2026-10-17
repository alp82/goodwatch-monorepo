import assert from "node:assert/strict"
import { test } from "node:test"
import { canonicalTitles } from "./catalog.ts"

test("canonical aliases collapse before paging; distinct namesakes and TV IDs survive", () => {
	const title = {
		media_type: "movie" as const,
		title: "Arrival",
		release_year: 2016,
	}
	const result = canonicalTitles([
		{ ...title, tmdb_id: 329865, runtime_minutes: 116 },
		{ ...title, tmdb_id: 472349, runtime_minutes: 22 },
		{ ...title, tmdb_id: 5338654, title: "Retired" },
		{ ...title, tmdb_id: 658039, title: "Canonical" },
		{ ...title, media_type: "show", tmdb_id: 5338654 },
	])
	assert.deepEqual(
		result.map((t) => [t.media_type, t.tmdb_id, t.title]),
		[
			["movie", 329865, "Arrival"],
			["movie", 472349, "Arrival"],
			["movie", 658039, "Canonical"],
			["show", 5338654, "Arrival"],
		],
	)
})

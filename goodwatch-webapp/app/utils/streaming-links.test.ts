import assert from "node:assert/strict"
import { test } from "node:test"

const { getStreamingUrl, tmdbWatchUrl } = await import("./streaming-links.ts")

test("an offer with its own link uses it", () => {
	assert.equal(
		getStreamingUrl(
			{ stream_url: "https://click.justwatch.com/a?x=1" },
			{ tmdb_id: 603 },
			"DE",
			"movie",
		),
		"https://click.justwatch.com/a?x=1",
	)
})

test("an offer without a link falls back to the title's TMDB watch page for the country", () => {
	for (const stream_url of [null, undefined, ""])
		assert.equal(
			getStreamingUrl({ stream_url }, { tmdb_id: 603 }, "de", "movie"),
			"https://www.themoviedb.org/movie/603/watch?locale=DE",
		)
	assert.equal(
		tmdbWatchUrl("show", 1396, "US"),
		"https://www.themoviedb.org/tv/1396/watch?locale=US",
	)
})

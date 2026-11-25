import assert from "node:assert/strict"
import { test } from "node:test"
import { genrePanelDataUrl, legacyGenreDocument } from "./genre-panel-data.ts"

test("an older loader navigation opens the matching document once and preserves its filters", () => {
	for (const kind of ["movies", "shows", "all"]) {
		const url = new URL(
			`https://goodwatch.test/${kind}/genres?sort=popular&_data=routes%2F%24type.%24`,
		)
		assert.equal(
			legacyGenreDocument(new Request(url), new Response()),
			`/${kind}/genres?sort=popular`,
		)
		assert.equal(legacyGenreDocument(new Request(genrePanelDataUrl(url)), new Response()), null)
		url.searchParams.delete("_data")
		assert.equal(legacyGenreDocument(new Request(url), new Response()), null)
	}
})

test("unsuccessful, redirect, mutation, root and unrelated loader responses retain normal behavior", () => {
	const url = new URL("https://goodwatch.test/movies/genres?_data=routes%2F%24type.%24")
	for (const status of [204, 302, 404, 503]) {
		assert.equal(legacyGenreDocument(new Request(url), new Response(null, { status })), null)
	}
	assert.equal(legacyGenreDocument(new Request(url, { method: "POST" }), new Response()), null)
	url.searchParams.set("_data", "root")
	assert.equal(legacyGenreDocument(new Request(url), new Response()), null)
})

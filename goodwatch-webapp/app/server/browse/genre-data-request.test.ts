import assert from "node:assert/strict"
import { test } from "node:test"
import { legacyGenreDocumentForLoader, withGenreDataRequest } from "./genre-data-request.server.ts"

test("native prefetch followed by a panel-aware navigation prepares the genre index once", async () => {
	let preparations = 0
	const load = (url: string, method = "GET") =>
		withGenreDataRequest({ url, method }, async () => {
			// The server awaits its catalog and viewer context before it accepts the address.
			await Promise.resolve()
			const document = legacyGenreDocumentForLoader()
			if (document) return document
			preparations++
			return "prepared"
		})
	const url = "/shows/genres/?country=DE&_data=routes%2F%24type.%24"
	assert.deepEqual(await Promise.all([load(url), load(url + "&_genrePanel=1")]), [
		"/shows/genres/?country=DE",
		"prepared",
	])
	assert.equal(preparations, 1)
	for (const path of [
		"/shows/genres",
		"/movies/genres?_data=root",
		"/shows/genres/drama?_data=routes%2F%24type.%24",
	])
		assert.equal(await load(path), "prepared")
	assert.equal(await load(url, "POST"), "prepared")
})

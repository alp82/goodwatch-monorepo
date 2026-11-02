import assert from "node:assert/strict"
import test from "node:test"
import { describedParams, filtersToKeep } from "./described-search.ts"

const params = (text: string) => new URLSearchParams(text)

test("a new search keeps the person's filters and drops what the last search added", () => {
	const current = params("type=movie&anime=only&moods=feelgood&q=cozy&asked=cozy+anime&page=3&mode=advanced")
	const kept = filtersToKeep(
		current,
		{ params: "type=movie&anime=only&moods=feelgood&q=cozy" },
		"type=movie",
	)
	assert.equal(kept.toString(), "type=movie")
})

test("without a last search every filter stays", () => {
	assert.equal(
		filtersToKeep(params("type=show&q=x&sort=top"), undefined).toString(),
		"type=show",
	)
})

test("the typed words stay in the URL, also when no search text is left", () => {
	const out = describedParams(
		params(""),
		"netflix movies",
		params(""),
		{ params: "services=8&type=movie" },
		true,
	)
	assert.equal(out.get("asked"), "netflix movies")
	assert.equal(out.has("q"), false)
	assert.equal(out.get("services"), "8")
})

test("without the interpreter the words are searched as they are, on the kept filters", () => {
	const out = describedParams(params(""), "space", params("type=show"), null, true)
	assert.equal(out.toString(), "type=show&q=space&asked=space")
})

test("the mode stays; the sort stays only for a search after a search", () => {
	const current = params("mode=advanced&sort=top")
	assert.equal(
		describedParams(current, "a", params(""), { params: "q=a" }, true).has("sort"),
		false,
	)
	const again = describedParams(current, "a", params(""), { params: "q=a" }, false)
	assert.equal(again.get("sort"), "top")
	assert.equal(again.get("mode"), "advanced")
})

test("how the list shows outlasts a search", () => {
	const out = describedParams(params("layout=grid&side=movie"), "a", params(""), { params: "q=a" }, false)
	assert.equal(out.get("layout"), "grid")
	assert.equal(out.get("side"), "movie")
})

import assert from "node:assert/strict"
import test from "node:test"
import { filtersToKeep } from "./described-search.ts"

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

test("the switched-off phrases and an older link's typed words aren't filters", () => {
	assert.equal(
		filtersToKeep(params("q=funny+90s&off=90s&asked=funny+90s&moods=dark"), undefined).toString(),
		"moods=dark",
	)
})

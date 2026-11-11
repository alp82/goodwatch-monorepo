import assert from "node:assert/strict"
import { test } from "node:test"
import { tropeDiscoverPath, tropeLabel, tropeUrl } from "./trope-filter.ts"

const url = "https://tvtropes.org/pmwiki/pmwiki.php/Main/ApocalypseAnarchy"
test("trope filters retain canonical concept identity in a shareable URL", () => {
	assert.equal(tropeUrl(url.replace("https://", "http://www.") + "/"), url)
	assert.equal(tropeLabel(url), "Apocalypse Anarchy")
	const path = new URL(tropeDiscoverPath(url), "https://goodwatch.app")
	assert.equal(path.searchParams.get("trope"), url)
	assert.equal(path.searchParams.has("q"), false)
})
test("unbounded or arbitrary URLs cannot become trope filters", () => {
	for (const value of [
		undefined,
		"Apocalypse Anarchy",
		"https://evil.example/Main/Foo",
		url + "?q=foo",
		"https://tvtropes.org/pmwiki/pmwiki.php/Film/Foo",
	])
		assert.equal(tropeUrl(value), undefined)
})

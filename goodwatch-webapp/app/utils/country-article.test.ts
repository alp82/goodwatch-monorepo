// The country names English says with "the", shared by the Discord cards and the "New on your services" pages.
import assert from "node:assert/strict"
import { test } from "node:test"
import { withArticle } from "./country-article.ts"

test("a country name takes 'the' where English says it", () => {
	for (const name of [
		"United States",
		"United Kingdom",
		"Netherlands",
		"Philippines",
		"Cayman Islands",
		"Czech Republic",
		"Dominican Republic",
		"Democratic Republic of the Congo",
		"Republic of the Congo",
		"Seychelles",
		"Palestinian Territory",
	])
		assert.equal(withArticle(name), `the ${name}`, name)
	for (const name of ["Germany", "Brazil", "Japan", "Ireland"])
		assert.equal(withArticle(name), name, name)
})

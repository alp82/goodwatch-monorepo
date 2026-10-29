import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "./title-filter/test-alias.ts"

// Run the real search fetch and transformation with an in-memory cache; never import Redis.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		if (url.endsWith("/utils/cache.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source:
					"export const cached = async ({ target, params }) => target(params)",
			}
		return next(url, context)
	},
})
const { getSearchPage, getSearchResults } = await import("./search.server.ts")

test("mixed search pagination survives removing people, while array consumers keep their contract", async (t) => {
	const results = Array.from({ length: 20 }, (_, id) => ({
		id,
		media_type: id < 2 ? "person" : id === 2 ? "tv" : "movie",
	}))
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({ page: 1, total_pages: 3, results }),
	)
	const params = { language: "en_US", query: "Dune" }
	const page = await getSearchPage(params)
	assert.equal(page.searchResults.length, 18)
	assert.equal(page.more, true)
	assert.equal(page.searchResults[0].media_type, "show")
	assert.deepEqual(await getSearchResults(params), page.searchResults)
})

test("the last mixed search page has an exact count", async (t) => {
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({
			page: 1,
			total_pages: 1,
			results: [{ id: 42, media_type: "movie" }],
		}),
	)
	const page = await getSearchPage({ language: "en_US", query: "Dune" })
	assert.equal(page.more, false)
	assert.equal(page.searchResults.length, 1)
})

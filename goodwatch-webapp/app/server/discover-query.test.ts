import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"

// Keep the real parser, entity resolver and server response; replace only the
// remote catalogs so these regressions run without a server or production data.
stubModules({
	// Node's test runner needs the JSON import as a module; use the real word list.
	"./negation-words.json": `export default ${readFileSync(new URL("./search-ranking/negation-words.json", import.meta.url), "utf8")}`,
	"./streaming-providers.server":
		"export const getStreamingProviders = async () => []",
	"./cast.server": `export const getCast = async () => ({ castMembers: [
		{ name: 'Tom Hanks', tmdb_id: 31 },
		{ name: 'Brad Pitt', tmdb_id: 287 },
	] })`,
	"./command-palette.server":
		"export const getPaletteTitles = async () => ({ titles: [] })",
	"./search.server": "export const getSearchResults = async () => []",
})
const { interpretDiscoverQuery } = await import("./discover-query.server.ts")
const now = new Date("2026-11-09")

test("homepage sends the complete numbered title to search without inventing a score filter", async () => {
	const result = await interpretDiscoverQuery("hostel 3", "", now)
	const params = new URLSearchParams(result.params)
	assert.equal(result.semanticQuery, "hostel 3")
	assert.equal(params.get("q"), "hostel 3")
	assert.equal(params.has("score"), false)
	assert.deepEqual(result.proposals, [])
	assert.deepEqual(result.labels, [])
})

const compositions: { query: string; expect: Record<string, string> }[] =
	JSON.parse(
		readFileSync(
			new URL(
				"../../scripts/discover-query-lab/cases/current-filter-composition.json",
				import.meta.url,
			),
			"utf8",
		),
	)
for (const row of [
	...compositions.filter((row) => row.expect.score === "80"),
	{ query: "80 brad pitt vibes", expect: { score: "80", people: "287" } },
]) {
	test(`score shorthand survives entity resolution: ${row.query}`, async () => {
		const result = await interpretDiscoverQuery(row.query, "", now)
		const params = new URLSearchParams(result.params)
		for (const [key, value] of Object.entries(row.expect))
			assert.equal(params.get(key), value, key)
		assert.equal(result.residual, "")
	})
}

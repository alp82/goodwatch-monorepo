import assert from "node:assert/strict"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
const { interpret } = await import("./discover-query.ts")

for (const query of ["scary", "scary dark", "scary horror"]) {
	test(`${query}: descriptive filters also retain text for the fingerprint read`, () => {
		const result = interpret(query)
		assert.match(result.semanticQuery, /scary/)
		if (query.includes("dark")) assert.match(result.semanticQuery, /dark/)
		if (query.includes("horror")) assert.match(result.semanticQuery, /horror/)
		assert(result.filters.moods.split(",").includes("scary"))
	})
}
test("hard filters alone do not become semantic searches", () => {
	assert.equal(interpret("netflix 80 under 90 minutes").semanticQuery, "")
})
test("existing moods win conflicts without reintroducing the rejected description", () => {
	const result = interpret("scary", "moods=funny")
	assert.equal(result.semanticQuery, "")
	assert.equal(result.filters.moods, "funny")
})
test("negative descriptive wording stays negative", () => {
	assert.match(interpret("not scary").semanticQuery, /not scary/)
})

for (const query of ["100", "100+", "100%", "100 scary"]) {
	test(`${query}: a bare perfect score is not inferred`, () => {
		const result = interpret(query)
		assert(!result.filters.score)
		assert(result.residual.includes("100"))
	})
}
test("explicit perfect score and source thresholds remain explicit", () => {
	assert.equal(interpret("score 100").filters.score, "100")
	assert.equal(interpret("IMDb 100%").filters.sources, "imdb:100")
})

test("a year cited after a title's words stays in the search text; a year after a genre filters", () => {
	const now = new Date("2026-11-03")
	const cited = interpret("dune 1984", "", now)
	assert.equal(cited.semanticQuery, "dune 1984")
	assert.equal(new URLSearchParams(cited.filters).get("minYear"), null)
	const genre = new URLSearchParams(interpret("horror 1999", "", now).filters)
	assert.equal(genre.get("minYear"), "1999")
	assert.equal(genre.get("maxYear"), "1999")
	// The words before the year were filters: the year filters too.
	for (const q of ["netflix 1999", "scary 1999"]) {
		const view = interpret(q, "", now)
		assert.equal(new URLSearchParams(view.filters).get("minYear"), "1999", q)
		assert.equal(view.residual.includes("1999"), false, q)
	}
	const phrase = new URLSearchParams(
		interpret("time travel movies from 2011", "", now).filters,
	)
	assert.equal(phrase.get("minYear"), "2011")
})

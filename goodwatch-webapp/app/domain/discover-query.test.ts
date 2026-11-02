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

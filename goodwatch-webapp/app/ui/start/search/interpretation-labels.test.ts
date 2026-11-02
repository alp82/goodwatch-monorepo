import "../../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
const { tokens } = await import("./interpretation-labels.ts")
import { relaxQuery } from "./relax-query.ts"
test("range labels combine bounds and use resolved entity/service names", () => {
	const result = tokens(
		{
			minYear: "1990",
			maxYear: "1999",
			people: "31",
			services: "337",
			similar: "123",
		},
		"Tom Hanks Disney like Arrival",
		{
			people: { 31: "Tom Hanks" },
			services: { 337: "Disney+" },
			similar: { 123: "Arrival" },
		},
	)
	assert.deepEqual(
		result.map(({ field, value }) => [field, value]),
		[
			["Released", "1990–1999"],
			["Person", "Tom Hanks"],
			["Service", "Disney+"],
			["Similar to", "Arrival"],
		],
	)
})
test("low-budget labels show the bound without a guess suffix", () => {
	assert.equal(tokens({ budget: "-4.999" }, "low budget")[0].value, "< $5M")
})
test("relaxing a constraint preserves other text and quoted title names", () => {
	assert.equal(
		relaxQuery("scary movies from the 90s on Netflix for my kids", [
			"from the 90s",
		]),
		"scary movies on Netflix for my kids",
	)
	assert.equal(relaxQuery('"Netflix" on Netflix', ["on Netflix"]), '"Netflix"')
	assert.equal(
		relaxQuery("1980 movies 80+ IMDb 7.5+", ["80+", "IMDb 7.5+"]),
		"1980 movies",
	)
	assert.equal(relaxQuery("scary and on Netflix", ["on Netflix"]), "scary")
})

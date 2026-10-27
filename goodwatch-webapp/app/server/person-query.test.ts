import assert from "node:assert/strict"
import { test } from "node:test"
import { normalizePersonQuery } from "./person-query.server.ts"
test("person filters have one bounded spelling and retain Remix data transport", () => {
	const p = new URLSearchParams(
		"junk=1&group=decade&minScore=070.9&genre=Drama&genre=Comedy&type=anime&order=desc&_data=routes%2Fperson.%24personKey",
	)
	assert.equal(
		normalizePersonQuery(p).toString(),
		"anime=only&genre=Drama&minScore=70&_data=routes%2Fperson.%24personKey",
	)
	assert.equal(
		normalizePersonQuery(
			new URLSearchParams(
				"role=nonsense&trait=madeup&minScore=Infinity&decade=2099&expand=xyz",
			),
		).toString(),
		"",
	)
})
test("normalization preserves every real score expansion and is idempotent", () => {
	for (const band of ["0", "30", "60", "70", "80", "90", "unrated"]) {
		const input = `group=score&expand=${band}`
		const normalized = normalizePersonQuery(new URLSearchParams(input))
		assert.equal(normalized.toString(), input)
		assert.equal(normalizePersonQuery(normalized).toString(), input)
	}
	assert.equal(
		normalizePersonQuery(
			new URLSearchParams("group=score&expand=100"),
		).toString(),
		"group=score",
	)
})

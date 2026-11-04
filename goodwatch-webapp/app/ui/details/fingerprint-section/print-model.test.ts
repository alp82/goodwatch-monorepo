import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { notForLine, rankLine, sectionRankKey } = await import(
	"./print-model.ts"
)

test("a rank says how many popular titles it beats, in tens or, at the top, in hundreds", () => {
	assert.equal(
		rankLine([0.93, 0.05], "movie"),
		"Stronger than 9 in 10 popular movies",
	)
	assert.equal(
		rankLine([0.6, 0.38], "show"),
		"Stronger than 6 in 10 popular shows",
	)
	assert.equal(
		rankLine([0.991, 0.004], "movie"),
		"Stronger than 99 in 100 popular movies",
	)
	assert.equal(
		rankLine([0.9999, 0], "movie"),
		"Stronger than 99 in 100 popular movies",
	)
	assert.equal(
		rankLine([0.02, 0.71], "movie"),
		"Weaker than 7 in 10 popular movies",
	)
	assert.equal(
		rankLine([0, 0.96], "show"),
		"Weaker than 96 in 100 popular shows",
	)
})

test("a rank in the middle, or none at all", () => {
	assert.equal(
		rankLine([0.45, 0.5], "movie"),
		"About the middle of popular movies",
	)
	assert.equal(rankLine(undefined, "movie"), null)
})

test("a section's rank key and the not-for line", () => {
	assert.equal(sectionRankKey("awe"), "ax:awe")
	assert.equal(notForLine([]), "")
	assert.equal(notForLine(["warmth"]), "Not for warmth.")
	assert.equal(
		notForLine(["warmth", "laughs", "comfort"]),
		"Not for warmth, laughs or comfort.",
	)
})

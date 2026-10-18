import assert from "node:assert/strict"
import { test } from "node:test"

const { runtimeLabel, bestListCopy, STATIC_PAGE_COPY, SUBTEXT_MAX_LENGTH } =
	await import("./copy.ts")

test("a movie's length reads as hours and minutes", () => {
	assert.equal(runtimeLabel(136), "2h 16m")
	assert.equal(runtimeLabel(120), "2h")
	assert.equal(runtimeLabel(45), "45m")
	assert.equal(runtimeLabel(7), "7m")
	assert.equal(runtimeLabel(873), "14h 33m")
})

test("a missing or impossible length gives no label", () => {
	for (const minutes of [0, null, undefined, -5, Number.NaN])
		assert.equal(runtimeLabel(minutes), "")
})

test("the best-of lists and the people list have cards whose subtitle fits", () => {
	assert.deepEqual(bestListCopy("shows"), {
		tag: "Best TV shows",
		title: "The best TV shows of all time",
		subtitle: "Ranked by GoodWatch score",
	})
	for (const copy of [bestListCopy("movies"), STATIC_PAGE_COPY["/people"]])
		assert.ok(copy.subtitle.length <= SUBTEXT_MAX_LENGTH, copy.subtitle)
})

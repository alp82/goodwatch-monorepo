import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { showStatusOf } = await import("./show-status.ts")

const show = (status: string | null | undefined) =>
	({ mediaType: "show", details: { title: "Severance", status } }) as never

test("a show's TMDB status becomes the chip's word and tone", () => {
	assert.deepEqual(
		[
			"Returning Series",
			"In Production",
			"Planned",
			"Pilot",
			"Ended",
			"Canceled",
		].map((s) => {
			const words = showStatusOf(show(s))
			return words && [words.word, words.tone]
		}),
		[
			["Returning", "live"],
			["In production", "live"],
			["Planned", "soon"],
			["Pilot", "soon"],
			["Ended", "over"],
			["Canceled", "cut"],
		],
	)
})

test("no chip for a movie, a missing status or one it doesn't know", () => {
	assert.equal(showStatusOf(show(null)), null)
	assert.equal(showStatusOf(show(undefined)), null)
	assert.equal(showStatusOf(show("Rumored")), null)
	assert.equal(
		showStatusOf({
			mediaType: "movie",
			details: { title: "Dune", status: "Released" },
		} as never),
		null,
	)
})

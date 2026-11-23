import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"
import { moodGrid } from "./mood-grid.ts"

const { MOODS } = await import("../moods.ts")

test("every mood has its agreed place in the grid regardless of catalog order", () => {
	const moods = MOODS.map(({ name }) => ({
		place: { slug: name.toLowerCase().replace(/ /g, "-") },
	}))
	for (const cols of [4, 2]) {
		const cells = moodGrid(moods, cols)
		const rows = Array.from({ length: 16 / cols }, () => Array<string>(cols))
		for (const { mood, row, col } of cells) rows[row][col] = mood.place.slug
		assert.deepEqual(rows.flat(), [
			"cozy",
			"romantic",
			"growing-up",
			"deep",
			"funny",
			"quirky",
			"sad",
			"dark",
			"magical",
			"trippy",
			"mysterious",
			"tense",
			"adventurous",
			"otherworldly",
			"thrilling",
			"scary",
		])
		assert.equal(cells.length, MOODS.length)
	}
})

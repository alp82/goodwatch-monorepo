import assert from "node:assert/strict"
import { test } from "node:test"
import { EFFECTS } from "./pixelfx/registry.js"
import { PUNS, matchPun } from "./puns.ts"

test("every pun's example title plays that pun", () => {
	for (const pun of PUNS)
		assert.equal(matchPun(pun.example)?.label, pun.label, pun.example)
})

test("puns match whole words, any case, without accents or 's", () => {
	assert.equal(matchPun("THE MATRIX RELOADED")?.example, "The Matrix")
	assert.equal(
		matchPun("Spider-Man: No Way Home")?.label,
		"web strands across a corner",
	)
	assert.equal(matchPun("Schindler's List"), null)
	// "war" is a word of its own, not part of "Warcraft" or "Edward".
	assert.equal(matchPun("Warcraft"), null)
	assert.equal(matchPun("Edward Scissorhands")?.label, "a frosty burst")
	assert.equal(matchPun("Ice Age")?.label, "frost nova")
	assert.equal(matchPun("Amélie"), null)
	assert.equal(matchPun(""), null)
})

test("an exact-title pun needs the whole title", () => {
	assert.equal(matchPun("Up")?.label, "balloons rise")
	assert.equal(matchPun("Up in the Air"), null)
	assert.equal(matchPun("Frozen")?.label, "frost nova")
	assert.equal(matchPun("Frozen II")?.label, "frost nova")
})

test("the first matching pun wins: specific titles before generic words", () => {
	// "Star Wars" also holds "star" and "war".
	assert.equal(matchPun("Star Wars: A New Hope")?.label, "glowing blade slash")
	// "Ghostbusters" before the generic ghosts.
	assert.equal(matchPun("Ghostbusters: Afterlife")?.label, "ghosts rise")
	assert.equal(matchPun("How to Train Your Dragon")?.label, "fire breath")
})

test("every pun plays effects the map ships", () => {
	for (const pun of PUNS)
		for (const step of pun.steps)
			assert.ok(EFFECTS[step.fx], `${pun.example}: ${step.fx}`)
})

import assert from "node:assert/strict"
import { test } from "node:test"
import { ambientIsland, comboStrength, zoomStepOf } from "./mapEffects.ts"

test("a combination's effects grow with each island: two faint, five full", () => {
	assert.equal(comboStrength(2), 0.4)
	assert.equal(comboStrength(3), 0.6)
	assert.equal(comboStrength(4), 0.8)
	assert.equal(comboStrength(5), 1)
	assert.equal(comboStrength(1), 0.4)
	assert.equal(comboStrength(9), 1)
})

const at = (id: string, r: number) => ({ id, r })

test("the hovered island plays its ambient, however small it is", () => {
	const list = [at("mood:funny", 20), at("mood:dark", 300)]
	assert.equal(ambientIsland(list, "mood:funny")?.id, "mood:funny")
})

test("with nothing hovered, the island zoomed into plays its ambient", () => {
	const list = [
		at("mood:funny", 160),
		at("mood:dark", 300),
		at("mood:cozy", 90),
	]
	assert.equal(ambientIsland(list, null)?.id, "mood:dark")
	// A hovered island that has left the view doesn't count.
	assert.equal(ambientIsland(list, "mood:sad")?.id, "mood:dark")
})

test("no ambient until an island fills a good part of the view", () => {
	assert.equal(
		ambientIsland([at("mood:funny", 149), at("mood:dark", 60)], null),
		null,
	)
	assert.equal(ambientIsland([at("mood:funny", 150)], null)?.id, "mood:funny")
	assert.equal(ambientIsland([], null), null)
})

test("pixels double among the posters and never grow past that with the zoom", () => {
	assert.equal(zoomStepOf(1), 1)
	assert.equal(zoomStepOf(1.79), 1)
	assert.equal(zoomStepOf(1.8), 2)
	assert.equal(zoomStepOf(12), 2)
})

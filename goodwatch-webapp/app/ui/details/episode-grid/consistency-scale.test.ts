import assert from "node:assert/strict"
import { test } from "node:test"
import { consistencyScale } from "./consistency-scale.ts"

test("the complete 1–10 range stays visible even when a show's ratings cluster near 9", () => {
	const { x, ticks } = consistencyScale(1004, 52)
	assert.deepEqual(ticks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
	assert.equal(x(1), 52)
	assert.equal(x(10), 952)
	assert.equal(x(5.5), 502)
	assert.ok(Math.abs(x(9.1) - x(8.1) - 100) < 1e-9)
})

test("phone and desktop use the same score proportions", () => {
	const phone = consistencyScale(300, 34)
	const desktop = consistencyScale(1004, 52)
	for (const score of [1, 3.4, 5.5, 8.7, 10]) {
		assert.ok(
			Math.abs((phone.x(score) - 34) / 232 - (desktop.x(score) - 52) / 900) <
				1e-9,
		)
	}
})

test("a season's standard-deviation band stays inside the fixed score range", () => {
	const { x } = consistencyScale(500, 34)
	assert.equal(x(0.5), x(1))
	assert.equal(x(10.5), x(10))
})

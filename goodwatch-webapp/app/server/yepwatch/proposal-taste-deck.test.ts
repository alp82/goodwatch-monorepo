import { test } from "node:test"
import assert from "node:assert/strict"
import { tasteClusters, calibrationKeys } from "./proposal-taste-deck.ts"
import { tasteFixture } from "./proposal-taste-test-support.ts"
test("Calibration is deterministic, ten distinct clusters, six movies and four shows, no repeats", async () => {
	const snapshot = tasteFixture()
	const clusters = await tasteClusters(snapshot)
	assert.equal(clusters.length, 10)
	const keys = calibrationKeys(clusters, [])
	assert.equal(keys.length, 10)
	assert.equal(new Set(keys).size, 10)
	assert.equal(keys.filter((k) => k < 2e12).length, 6)
	assert.equal(
		new Set(
			keys.map(
				(k) => clusters.find((c) => c.titles.some((t) => t.key === k))!.id
			)
		).size,
		10
	)
	assert.deepEqual(
		calibrationKeys(await tasteClusters(tasteFixture()), []),
		keys
	)
	const answers = [
		{
			key: keys[0],
			answer: "unseen" as const,
			source: "taste" as const,
			at: 1,
		},
	]
	const later = calibrationKeys(clusters, answers)
	assert.ok(!later.includes(keys[0]))
	const cluster = clusters.find((c) => c.titles.some((t) => t.key === keys[0]))!
	assert.ok(later.some((k) => cluster.titles.some((t) => t.key === k)))
	assert.equal(calibrationKeys(clusters, [], 5).length, 5)
	const rated = [{ ...answers[0], answer: "loved" as const }]
	assert.ok(
		!cluster.titles.some(
			(t) => t.key === calibrationKeys(clusters, rated, 1)[0]
		)
	)
})

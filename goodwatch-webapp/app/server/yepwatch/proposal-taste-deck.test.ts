import { test } from "node:test"
import assert from "node:assert/strict"
import { tasteClusters, calibrationKeys, readyTasteClusters } from "./proposal-taste-deck.ts"
import { tasteFixture, MemoryProfileStore, tasteDisplays } from "./proposal-taste-test-support.ts"
import { TasteProfiles } from "./proposal-taste-profile.ts"
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

test("A new snapshot serves a cached fallback before clustering completes", async () => {
	for (let swap = 0; swap < 2; swap++) {
		const snapshot = tasteFixture()
		const fingerprintAt = snapshot.fingerprintAt.bind(snapshot)
		let reads = 0
		snapshot.fingerprintAt = (row) => { reads++; return fingerprintAt(row) }
		const fallback = readyTasteClusters(snapshot)
		assert.equal(reads, 0, "request does not run k-means")
		assert.equal(calibrationKeys(fallback, []).length, 10)
		assert.equal(readyTasteClusters(snapshot), fallback)
		const clusters = await tasteClusters(snapshot)
		assert.equal(readyTasteClusters(snapshot), clusters)
		assert.ok(reads > 0)
	}
})

test("The first profile deck request after a snapshot swap completes before k-means starts", async () => {
	let snapshot = tasteFixture()
	const profiles = new TasteProfiles(new MemoryProfileStore(), "test-profile-secret-at-least-32-bytes", () => snapshot, tasteDisplays)
	for (let swap = 0; swap < 2; swap++) {
		snapshot = tasteFixture()
		const fingerprintAt = snapshot.fingerprintAt.bind(snapshot)
		let reads = 0
		snapshot.fingerprintAt = (row) => { reads++; return fingerprintAt(row) }
		const deck = await profiles.deck("profile", 10)
		assert.equal(deck.cards.length, 10)
		assert.equal(reads, 0)
		await tasteClusters(snapshot)
	}
})

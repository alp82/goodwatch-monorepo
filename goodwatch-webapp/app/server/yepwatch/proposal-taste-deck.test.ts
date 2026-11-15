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

test("Display misses are backfilled without repeats until the available pool is exhausted", async () => {
	const snapshot = tasteFixture()
	await tasteClusters(snapshot)
	const attempted = new Set<number>()
	let calls = 0
	const profiles = new TasteProfiles(new MemoryProfileStore(), "test-profile-secret-at-least-32-bytes", () => snapshot, async keys => {
		calls++
		for (const key of keys) {
			assert.ok(!attempted.has(key), "a missing display is attempted only once")
			attempted.add(key)
		}
		// The first two batches miss every display; the rest supply enough cards.
		return calls <= 2 ? new Map() : tasteDisplays(keys)
	})
	const deck = await profiles.deck("profile", 10)
	assert.equal(deck.cards.length, 10)
	assert.equal(new Set(deck.cards.map(c => c.key)).size, 10)
	assert.ok(calls >= 3)

	const available = new Set(calibrationKeys(readyTasteClusters(snapshot), []).slice(0, 3))
	const sparse = new TasteProfiles(new MemoryProfileStore(), "test-profile-secret-at-least-32-bytes", () => snapshot,
		keys => tasteDisplays(keys.filter(key => available.has(key))))
	assert.equal((await sparse.deck("profile", 10)).cards.length, 3)
})

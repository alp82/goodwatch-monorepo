// A value read without loading (last-good.ts): reading never starts a load; a refresh loads when the value is missing
// or old, one at a time; a failed load keeps the last value and the next waits for the retry time.
import assert from "node:assert/strict"
import { test } from "node:test"
import { lastGood } from "./last-good.ts"

function clock() {
	let time = 1_000_000
	return { now: () => time, pass: (ms: number) => (time += ms) }
}

test("reading never starts a load, however often it is read", () => {
	let loads = 0
	const snapshot = lastGood(
		async () => {
			loads++
			return "value"
		},
		{ maxAgeMs: 60_000, retryMs: 10_000 },
	)
	for (let i = 0; i < 5; i++) assert.equal(snapshot.peek(), null)
	assert.equal(loads, 0)
})

test("a refresh loads when the value is missing or old, one load at a time", async () => {
	const time = clock()
	let finish: (value: string) => void = () => {}
	let loads = 0
	const snapshot = lastGood(
		() => {
			loads++
			return new Promise<string>((done) => {
				finish = done
			})
		},
		{ maxAgeMs: 60_000, retryMs: 10_000, now: time.now },
	)
	const first = snapshot.refreshIfDue()
	void snapshot.refreshIfDue()
	assert.equal(loads, 1)
	finish("first")
	await first
	assert.equal(snapshot.peek(), "first")
	await snapshot.refreshIfDue()
	assert.equal(loads, 1, "a fresh value isn't loaded again")
	time.pass(61_000)
	const second = snapshot.refreshIfDue()
	assert.equal(snapshot.peek(), "first", "the old value serves while the refresh runs")
	finish("second")
	await second
	assert.equal(snapshot.peek(), "second")
	assert.equal(loads, 2)
})

test("a failed load keeps the last value; the next waits for the retry time; nothing pending stays", async () => {
	const time = clock()
	const results: (() => Promise<string>)[] = [
		() => Promise.resolve("good"),
		() => Promise.reject(new Error("incomplete")),
		() => Promise.resolve("again"),
	]
	let loads = 0
	const snapshot = lastGood(() => results[loads++](), {
		maxAgeMs: 60_000,
		retryMs: 10_000,
		now: time.now,
	})
	await snapshot.refreshIfDue()
	time.pass(61_000)
	await snapshot.refreshIfDue()
	assert.equal(loads, 2)
	assert.equal(snapshot.peek(), "good")
	time.pass(5_000)
	await snapshot.refreshIfDue()
	assert.equal(loads, 2, "no new load before the retry time")
	time.pass(5_001)
	await snapshot.refreshIfDue()
	assert.equal(loads, 3)
	assert.equal(snapshot.peek(), "again")
})

test("a load that throws at once counts as failed and never rejects the refresh", async () => {
	const snapshot = lastGood<string>(
		() => {
			throw new Error("no cluster")
		},
		{ maxAgeMs: 60_000, retryMs: 10_000 },
	)
	await snapshot.refreshIfDue()
	assert.equal(snapshot.peek(), null)
})

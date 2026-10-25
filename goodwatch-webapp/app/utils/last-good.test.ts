// A value read without waiting (last-good.ts): cold it reads null at once and starts one load, an old value is
// served while a refresh runs, and a failed load keeps the last value and waits before it tries again.
import assert from "node:assert/strict"
import { test } from "node:test"
import { lastGood } from "./last-good.ts"

const flush = () => new Promise((resolve) => setImmediate(resolve))

function clock() {
	let time = 1_000_000
	return { now: () => time, pass: (ms: number) => (time += ms) }
}

test("cold, a read returns null at once and starts one load, however many reads come meanwhile", async () => {
	let loads = 0
	const snapshot = lastGood(
		() => {
			loads++
			return new Promise<string>(() => {})
		},
		{ maxAgeMs: 60_000, retryMs: 10_000 },
	)
	const started = performance.now()
	for (let i = 0; i < 5; i++) assert.equal(snapshot.read(), null)
	assert.ok(performance.now() - started < 50)
	await flush()
	assert.equal(loads, 1)
})

test("a finished load is read from then on; an old value is served while one refresh runs", async () => {
	const time = clock()
	let resolve: (value: string) => void = () => {}
	let loads = 0
	const snapshot = lastGood(
		() => {
			loads++
			return new Promise<string>((done) => {
				resolve = done
			})
		},
		{ maxAgeMs: 60_000, retryMs: 10_000, now: time.now },
	)
	snapshot.read()
	resolve("first")
	await flush()
	assert.equal(snapshot.read(), "first")
	assert.equal(loads, 1)
	time.pass(61_000)
	assert.equal(snapshot.read(), "first")
	assert.equal(snapshot.read(), "first")
	assert.equal(loads, 2)
	resolve("second")
	await flush()
	assert.equal(snapshot.read(), "second")
})

test("a failed load keeps the last value and the next waits for the retry time; nothing pending stays", async () => {
	const time = clock()
	const results: (() => Promise<string>)[] = [
		() => Promise.resolve("good"),
		() => Promise.reject(new Error("Crate is down")),
		() => Promise.resolve("again"),
	]
	let loads = 0
	const snapshot = lastGood(() => results[loads++](), {
		maxAgeMs: 60_000,
		retryMs: 10_000,
		now: time.now,
	})
	snapshot.read()
	await flush()
	time.pass(61_000)
	assert.equal(snapshot.read(), "good")
	await flush()
	assert.equal(loads, 2)
	time.pass(5_000)
	assert.equal(snapshot.read(), "good")
	assert.equal(loads, 2, "no new load before the retry time")
	time.pass(5_001)
	snapshot.read()
	await flush()
	assert.equal(loads, 3)
	assert.equal(snapshot.read(), "again")
})

test("a load that throws at once counts as failed, not as a read error", async () => {
	const snapshot = lastGood<string>(
		() => {
			throw new Error("no cluster")
		},
		{ maxAgeMs: 60_000, retryMs: 10_000 },
	)
	assert.equal(snapshot.read(), null)
	await flush()
	assert.equal(snapshot.read(), null)
})

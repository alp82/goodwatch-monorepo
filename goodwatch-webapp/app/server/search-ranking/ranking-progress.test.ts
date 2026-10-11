import assert from "node:assert/strict"
import { test } from "node:test"
import { RankingProgress } from "./ranking-progress.server.ts"

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>((yes) => {
		resolve = yes
	})
	return { promise, resolve }
}

test("request spans are independent and immutable snapshots cannot change after rejection or completion", async (t) => {
	let now = 10
	t.mock.method(performance, "now", () => now)
	const first = new RankingProgress()
	const second = new RankingProgress()
	const gate = deferred()
	const work = first.measure("encodeEarly", () => gate.promise)
	now = 35
	const pending = first.snapshot()
	assert.deepEqual(pending, { encodeEarlyElapsed: 25, encodeEarlyPending: 1 })
	assert.deepEqual(second.snapshot(), {})
	now = 40
	const rejected = second.measure("round1", async () => {
		now = 45
		throw new Error("private fixture query")
	})
	await assert.rejects(rejected, /private fixture/)
	assert.deepEqual(second.snapshot(), { round1Elapsed: 5 })
	assert.ok(!JSON.stringify(second.snapshot()).includes("private"))
	now = 60
	gate.resolve()
	await work
	assert.deepEqual(first.snapshot(), { encodeEarlyElapsed: 50 })
	assert.deepEqual(pending, { encodeEarlyElapsed: 25, encodeEarlyPending: 1 })
	assert.ok(Object.isFrozen(pending))
})

test("awaiting early work again retains its original start and completion", async (t) => {
	let now = 0
	t.mock.method(performance, "now", () => now)
	const progress = new RankingProgress()
	const gate = deferred()
	const work = progress.measure("prefetch", () => gate.promise)
	now = 100
	const wait = progress.measure("prefetch", () => work)
	assert.deepEqual(progress.snapshot(), {
		prefetchElapsed: 100,
		prefetchPending: 1,
	})
	now = 200
	gate.resolve()
	await wait
	now = 300
	await progress.measure("prefetch", () => work)
	assert.deepEqual(progress.snapshot(), { prefetchElapsed: 200 })
})

import assert from "node:assert/strict"
import { test } from "node:test"
import { createPersonProfileCache } from "./person-profile-cache.server.ts"

const gate = () => {
	let resolve!: () => void
	const promise = new Promise<void>((r) => {
		resolve = r
	})
	return { resolve, promise }
}
test("cached and coalesced person reads succeed while four distinct cold profiles are loading", async () => {
	const release = gate()
	let active = 0
	let peak = 0
	const loaded: number[] = []
	const cache = createPersonProfileCache({
		read: async (id, load) => (id === 1 ? { id } : load()),
		load: async (id) => {
			loaded.push(id)
			peak = Math.max(peak, ++active)
			await release.promise
			active--
			return { id }
		},
	})
	const cold = [2, 3, 4, 5].map((id) => cache.get(id))
	await new Promise((resolve) => setImmediate(resolve))
	const same = Array.from({ length: 20 }, () => cache.get(2))
	assert.deepEqual(await cache.get(1), { id: 1 })
	const queued = cache.get(6)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(peak, 4)
	assert.deepEqual(loaded, [2, 3, 4, 5])
	release.resolve()
	assert.equal((await Promise.all([...cold, ...same, queued])).length, 25)
	assert.equal(peak, 4)
	assert.deepEqual(await cache.get(6), { id: 6 })
	assert.deepEqual(loaded, [2, 3, 4, 5, 6])
})

test("cold queue is bounded, expired waiters do no work, and failure releases its slot", async () => {
	const release = gate()
	const started: number[] = []
	const cache = createPersonProfileCache({
		concurrency: 1,
		queueSize: 1,
		waitMs: 20,
		read: (_id, load) => load(),
		load: async (id) => {
			started.push(id)
			if (id === 1) {
				await release.promise
				throw new Error("offline")
			}
			return id
		},
	})
	const first = cache.get(1)
	const failed = assert.rejects(first, /offline/)
	await new Promise((resolve) => setImmediate(resolve))
	const waiting = cache.get(2)
	await assert.rejects(
		cache.get(3),
		(e: Response) => e.status === 503 && e.headers.get("Retry-After") === "2",
	)
	await assert.rejects(waiting, (e: Response) => e.status === 503)
	release.resolve()
	await failed
	assert.equal(await cache.get(4), 4)
	assert.deepEqual(started, [1, 4])
})

test("expired and evicted profiles reload, including cached missing people", async () => {
	let now = 0
	let loads = 0
	const cache = createPersonProfileCache<number | null>({
		now: () => now,
		ttlMs: 10,
		entries: 1,
		read: (_id, load) => load(),
		load: async (id) => {
			loads++
			return id === 1 ? null : id
		},
	})
	assert.equal(await cache.get(1), null)
	assert.equal(await cache.get(1), null)
	assert.equal(loads, 1)
	await cache.get(2)
	await cache.get(1)
	assert.equal(loads, 3)
	now = 11
	await cache.get(1)
	assert.equal(loads, 4)
})

import { test } from "node:test"
import assert from "node:assert/strict"
import { readEvery } from "./read-cache.ts"

const tick = () => new Promise((resolve) => setImmediate(resolve))

test("a catalog read is shared, kept while fresh, and a failed first read is read again", async () => {
	let t = 0
	let reads = 0
	let fail = true
	const services = readEvery(1000, async () => {
		reads++
		if (fail) throw new Error("catalog unavailable")
		return [reads]
	}, () => t)
	await assert.rejects(services())
	fail = false
	const [a, b] = await Promise.all([services(), services()])
	assert.equal(reads, 2, "the failed read wasn't kept; callers at the same time share the next one")
	assert.equal(a, b)
	t = 999
	assert.deepEqual(await services(), [2], "still fresh")
	assert.equal(reads, 2)
})

test("an old value answers at once while one new read runs in the background; a failed refresh keeps it", async () => {
	let t = 0
	let reads = 0
	let fail = false
	let release: (() => void) | null = null
	const services = readEvery(1000, async () => {
		reads++
		if (reads > 1) await new Promise<void>((resolve) => { release = resolve })
		if (fail) throw new Error("catalog unavailable")
		return [reads]
	}, () => t)
	assert.deepEqual(await services(), [1])
	t = 1000
	assert.deepEqual(await services(), [1], "stale, answered without waiting")
	assert.deepEqual(await services(), [1])
	assert.equal(reads, 2, "one background read for both callers")
	release!()
	await tick()
	assert.deepEqual(await services(), [2], "the new value replaces the old one")
	t = 2500
	fail = true
	assert.deepEqual(await services(), [2])
	release!()
	await tick()
	assert.deepEqual(await services(), [2], "a failed refresh keeps the old value")
	assert.equal(reads, 4, "and the next caller tries again")
})

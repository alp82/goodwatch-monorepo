import { test } from "node:test"
import assert from "node:assert/strict"
import { readEvery } from "./read-cache.ts"

test("a cached catalog read is shared until it's older than its lifetime, and a failure is read again", async () => {
	let t = 0
	let reads = 0
	let fail = false
	const services = readEvery(1000, async () => {
		reads++
		if (fail) throw new Error("catalog unavailable")
		return [reads]
	}, () => t)
	const [a, b] = await Promise.all([services(), services()])
	assert.equal(reads, 1, "callers at the same time share one read")
	assert.equal(a, b)
	t = 999
	assert.deepEqual(await services(), [1], "still fresh")
	t = 1000
	fail = true
	await assert.rejects(services())
	fail = false
	assert.deepEqual(await services(), [3], "the failed read wasn't kept")
	assert.equal(reads, 3)
})

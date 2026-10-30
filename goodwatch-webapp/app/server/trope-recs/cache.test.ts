import assert from "node:assert/strict"
import { test } from "node:test"
import { sharedIndex, resultCache } from "./cache.ts"
const settle = () => new Promise((resolve) => setImmediate(resolve))

test("shared index deduplicates cold/stale builds and replaces only complete generations", async () => {
	let now = 1,
		calls = 0
	let finish: (value: string) => void = () => {}
	const read = sharedIndex(
		() => {
			calls++
			return new Promise<string>((resolve) => {
				finish = resolve
			})
		},
		() => now,
	)
	assert.deepEqual(read(), { current: undefined, pending: true })
	read()
	assert.equal(calls, 1)
	finish("first")
	await settle()
	assert.equal(read().current?.value, "first")
	now += 3_600_001
	assert.equal(read().current?.value, "first")
	assert.equal(read().pending, true)
	assert.equal(calls, 2)
	finish("second")
	await settle()
	assert.equal(read().current?.value, "second")
})

test("failed shared build backs off and retries without caching failure", async () => {
	let now = 1,
		calls = 0
	const read = sharedIndex(
		async () => {
			calls++
			throw Error("unavailable")
		},
		() => now,
	)
	read()
	await settle()
	read()
	assert.equal(calls, 1)
	now += 30_001
	read()
	assert.equal(calls, 2)
	await settle()
})

test("member results expire and memory is bounded", () => {
	let now = 1
	const cache = resultCache<number>(() => now)
	cache.set("one", 1)
	assert.equal(cache.get("one"), 1)
	now += 15_000
	assert.equal(cache.get("one"), undefined)
	for (let i = 0; i < 129; i++) cache.set(String(i), i)
	assert.equal(cache.get("0"), undefined)
	assert.equal(cache.get("128"), 128)
})

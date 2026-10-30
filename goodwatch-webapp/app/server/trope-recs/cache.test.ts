import assert from "node:assert/strict"
import { test } from "node:test"
import { sharedIndex, resultCache, warmIndex } from "./cache.ts"
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
	now += 37_501
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

test("repeated failures exponentially back off with jitter, cap, and reset after recovery", async () => {
	let now = 1,
		calls = 0,
		fails = true
	const read = sharedIndex(
		async () => {
			calls++
			if (fails) throw Error("unavailable")
			return calls
		},
		() => now,
		() => {},
		() => 1,
	)
	for (const delay of [
		37_500, 75_000, 150_000, 300_000, 600_000, 1_125_000, 1_125_000,
	]) {
		read()
		await settle()
		const before = calls
		now += delay - 1
		read()
		assert.equal(calls, before)
		now++
	}
	fails = false
	read()
	await settle()
	const previous = read().current
	assert.ok(previous)
	now += 3_600_001
	fails = true
	read()
	await settle()
	assert.equal(read().current, previous)
	const before = calls
	now += 37_499
	read()
	assert.equal(calls, before)
	now++
	read()
	assert.equal(calls, before + 1)
	await settle()
})

test("startup warms page/both after 30s, unrefs the timer, and skips search", () => {
	for (const role of ["page", "both", "search"]) {
		let called = 0,
			unrefs = 0
		let task: (() => void) | undefined
		warmIndex(
			() => {
				called++
			},
			role,
			(callback, delay) => {
				assert.equal(delay, 30_000)
				task = callback
				return {
					unref: () => {
						unrefs++
					},
				} as ReturnType<typeof setTimeout>
			},
		)
		assert.equal(called, 0)
		assert.equal(unrefs, role === "search" ? 0 : 1)
		task?.()
		assert.equal(called, role === "search" ? 0 : 1)
	}
})

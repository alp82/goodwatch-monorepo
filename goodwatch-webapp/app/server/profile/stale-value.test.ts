import assert from "node:assert/strict"
import { test } from "node:test"
import { staleValues } from "./stale-value.ts"

test("activity returns the last value without waiting and concurrent visitors share its refresh", async () => {
	const cache = staleValues<number>()
	let finish!: (value: number) => void
	let calls = 0
	const build = () => {
		calls++
		return new Promise<number>((resolve) => {
			finish = resolve
		})
	}
	const old = { value: 1, fresh: false }
	assert.deepEqual(
		await Promise.all([
			cache.read("owner", old, build),
			cache.read("owner", old, build),
		]),
		[1, 1],
	)
	assert.equal(
		calls,
		0,
		"stale readers finish before the background build starts",
	)
	await new Promise<void>((resolve) => setImmediate(resolve))
	assert.equal(calls, 1)
	const cold = cache.read("owner", null, build)
	finish(2)
	assert.equal(await cold, 2)
	assert.equal(await cache.read("owner", { value: 2, fresh: true }, build), 2)
	assert.equal(calls, 1)
})

test("failed refreshes release single flight and do not replace the last successful value", async () => {
	const cache = staleValues<number>()
	await assert.rejects(
		cache.refresh("owner", async () => {
			throw Error("unavailable")
		}),
	)
	assert.equal(await cache.refresh("owner", async () => 3), 3)
	assert.equal(await cache.read("other-owner", null, async () => 4), 4)
})

test("activity during a running build causes one more build after the older one finishes", async () => {
	const cache = staleValues<number>()
	let finish!: (n: number) => void
	const first = cache.refresh(
		"owner",
		() =>
			new Promise<number>((resolve) => {
				finish = resolve
			}),
	)
	await Promise.resolve()
	let reads = 0
	const build = async () => {
		reads++
		return 2
	}
	const next = cache.refreshAfterPending("owner", build)
	const joined = cache.refreshAfterPending("owner", build)
	assert.equal(reads, 0)
	finish(1)
	assert.equal(await first, 1)
	assert.deepEqual(await Promise.all([next, joined]), [2, 2])
	assert.equal(reads, 1)
})

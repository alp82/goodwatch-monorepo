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

test("KeyedReads keeps each key for its lifetime, shares reads in flight, and never keeps failures, gaps or refused values", async () => {
	const { KeyedReads } = await import("./read-cache.ts")
	let t = 0
	const loads: string[][] = []
	let fail = false
	const kept = new KeyedReads<number>(1000, 3, (v) => v >= 0, () => t)
	const load = async (missing: string[]) => {
		loads.push(missing)
		await tick()
		if (fail) throw new Error("catalog unavailable")
		// "gap" is never answered; "neg" is answered but refused by keep.
		return new Map(missing.filter((k) => k !== "gap").map((k) => [k, k === "neg" ? -1 : k.length]))
	}
	const [a, b] = await Promise.all([kept.many(["a", "bb"], load), kept.many(["bb", "ccc"], load)])
	assert.deepEqual(loads, [["a", "bb"], ["ccc"]], "a key being read is waited for, not read again")
	assert.deepEqual([...a], [["a", 1], ["bb", 2]])
	assert.deepEqual([...b], [["bb", 2], ["ccc", 3]])
	t = 999
	assert.deepEqual([...(await kept.many(["a"], load))], [["a", 1]])
	assert.equal(loads.length, 2, "fresh")
	t = 1000
	await kept.many(["a"], load)
	assert.deepEqual(loads.at(-1), ["a"], "read again once its lifetime is over (counted from when its read started)")
	const gaps = await kept.many(["gap", "neg"], load)
	assert.deepEqual([...gaps], [["neg", -1]], "a refused value is answered to its caller")
	await kept.many(["gap", "neg"], load)
	assert.deepEqual(loads.at(-1), ["gap", "neg"], "neither a gap nor a refused value was kept")
	fail = true
	await assert.rejects(Promise.all([kept.many(["x"], load), kept.many(["x"], load)]), /catalog unavailable/)
	fail = false
	await kept.many(["x"], load)
	assert.deepEqual(loads.at(-1), ["x"], "a failed read is not kept")
	assert.ok(kept.size <= 3, "the least recently used go beyond maxEntries")
	kept.warm(["y"], async () => { throw new Error("never thrown at the caller") })
	await tick()
})

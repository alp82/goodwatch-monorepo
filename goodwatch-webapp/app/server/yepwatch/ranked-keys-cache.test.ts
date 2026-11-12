import { test } from "node:test"
import assert from "node:assert/strict"
import { rankedKeysCache, titleKeySet } from "./ranked-keys-cache.ts"
import { roomIntentKeys } from "./proposal-intent.ts"

test("a room's base ranking is built once per key, shared by concurrent callers, and evicted oldest first", async () => {
	const ranked = rankedKeysCache(2)
	let builds = 0
	const build = (keys: number[]) => async () => {
		builds++
		return keys
	}
	const [a, b] = await Promise.all([ranked("v1|DE|all", build([1, 2])), ranked("v1|DE|all", build([9]))])
	assert.deepEqual(a, [1, 2])
	assert.equal(b, a)
	assert.equal(builds, 1)
	await ranked("v1|US|all", build([3]))
	await ranked("v1|DE|all", build([9])) // a hit makes DE the most recent
	await ranked("v1|GB|all", build([4])) // evicts US
	assert.equal(builds, 3)
	assert.deepEqual(await ranked("v1|DE|all", build([9])), [1, 2])
	assert.deepEqual(await ranked("v1|US|all", build([5])), [5])
	assert.equal(builds, 4)
})

test("a failed build is not kept", async () => {
	const ranked = rankedKeysCache()
	await assert.rejects(ranked("k", async () => { throw new Error("snapshot") }))
	assert.deepEqual(await ranked("k", async () => [7]), [7])
})

test("seen ids become numeric title keys", () => {
	assert.deepEqual([...titleKeySet(["movie_12", "show_7", "show_continue_3", "bogus"])], [1_000_000_000_012, 2_000_000_000_007])
})

test("idea lanes interleave over the base without copying it, skipping seen and repeated titles", () => {
	const m = (id: number) => 1_000_000_000_000 + id
	const base = [m(1), m(2), m(3), m(4), m(5), m(6)]
	const room = {
		seenKeys: ["movie_2"],
		ideas: [
			{ on: true, rankedKeys: [m(5), m(2), m(9)] },
			{ on: true, rankedKeys: [m(6), m(5)] },
			{ on: false, rankedKeys: [m(4)] },
		],
	} as unknown as Parameters<typeof roomIntentKeys>[0]
	assert.deepEqual(roomIntentKeys(room, base), [m(5), m(6), m(1), m(3), m(4)])
	assert.deepEqual(roomIntentKeys({ seenKeys: [], ideas: [] } as never, base), base)
})

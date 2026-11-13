// Sliced work: the same results as the one-piece versions, and the event loop runs in between.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import {
	jsonDigest,
	mapInSlices,
	runInSlices,
	sortInSlices,
	timeSlice,
} from "./time-slice.ts"

const entries = Array.from({ length: 2_000 }, (_, i) => ({
	names: [`Name ${i}`, "é ünïcode"],
	popularity: i,
	item: { key: `trope-${i}`, label: `Label ${i}`, sub: i % 2 ? "x" : "" },
}))

test("the digest is the one of the whole list's JSON", async () => {
	const whole = createHash("sha256")
		.update(JSON.stringify(entries))
		.digest("hex")
	assert.equal(await jsonDigest(entries), whole)
	assert.equal(
		await jsonDigest([]),
		createHash("sha256").update("[]").digest("hex"),
	)
})

test("a slice that is used up lets the event loop run before the next item", async () => {
	let clock = 0
	const slice = timeSlice(10, () => clock)
	let turns = 0
	const ticker = setImmediate(() => turns++)
	const mapped = await mapInSlices(
		[1, 2, 3],
		(n) => {
			clock += 6
			return n * 2
		},
		slice,
	)
	clearImmediate(ticker)
	assert.deepEqual(mapped, [2, 4, 6])
	assert.equal(turns, 1)
	assert.equal(slice.due(), false)
})

test("the sliced sort gives the order of Array.prototype.sort, ties included", async () => {
	let seed = 1
	const random = () => (seed = (seed * 16807) % 2147483647)
	for (const length of [0, 1, 511, 512, 513, 5_000, 20_011]) {
		const list = Array.from({ length }, (_, i) => ({
			key: `k${random() % 997}`,
			i,
		}))
		const compare = (a: { key: string }, b: { key: string }) =>
			a.key.localeCompare(b.key)
		let clock = 0
		const sorted = await sortInSlices(
			list,
			compare,
			timeSlice(10, () => (clock += 3)),
		)
		assert.deepEqual(sorted, [...list].sort(compare))
	}
})

test("stepped work returns its value and pauses when the slice is used up", async () => {
	function* steps() {
		yield
		yield
		return 42
	}
	let clock = 0
	const slice = timeSlice(10, () => (clock += 10))
	const pause = slice.pause
	let pauses = 0
	slice.pause = async () => {
		pauses++
		await pause()
	}
	assert.equal(await runInSlices(steps(), slice), 42)
	assert.equal(pauses, 2)
})

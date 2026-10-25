import assert from "node:assert/strict"
import { test } from "node:test"
import { createTropeSnapshots } from "./trope-snapshots.ts"
import { buildTropePool } from "./tropes-model.ts"

const pool = buildTropePool([], [], {})
const raw = (readFrom: number) => JSON.stringify({ readFrom, stats: pool })
function fixture() {
	let fast: string | null = null
	let stored: string | null = null
	let touched: string | null = null
	let failFast = false
	let failStored = false
	const errors: unknown[] = []
	let reads = 0
	const snapshots = createTropeSnapshots({
		now: () => 1_000_000,
		readFast: async () => {
			if (failFast) throw Error("Redis down")
			return fast
		},
		readTouched: async () => {
			if (failFast) throw Error("Redis down")
			return touched
		},
		readStored: async () => {
			reads++
			return stored
		},
		writeFast: async (_, value) => {
			fast = value
		},
		writeStored: async (_, p, readFrom) => {
			if (failStored) throw Error("Crate down")
			stored = JSON.stringify({ readFrom, stats: p })
		},
		onError: (error) => {
			errors.push(error)
		},
	})
	return {
		...snapshots,
		errors,
		setFast: (value: string | null) => {
			fast = value
		},
		setStored: (value: string | null) => {
			stored = value
		},
		setTouched: (value: string | null) => {
			touched = value
		},
		failFast: () => {
			failFast = true
		},
		failStored: () => {
			failStored = true
		},
		get reads() {
			return reads
		},
	}
}
test("expiry keeps the durable snapshot available, marked stale", async () => {
	const f = fixture()
	await f.write("owner", pool, 100_000)
	f.setFast(null)
	const value = await f.read("owner")
	assert.deepEqual(value, { pool, version: 100_000, fresh: false })
	assert.equal(f.reads, 1)
})
test("fresh snapshots do not read Crate and need no touched marker", async () => {
	const f = fixture()
	f.setFast(raw(900_000))
	assert.deepEqual(await f.read("owner"), {
		pool,
		version: 900_000,
		fresh: true,
	})
	assert.equal(f.reads, 0)
})
test("a committed write keeps old data readable but requires a refresh after settling", async () => {
	const f = fixture()
	f.setFast(raw(900_000))
	f.setTouched("900000")
	assert.equal((await f.read("owner"))?.fresh, false)
	f.setFast(raw(901_500))
	assert.equal((await f.read("owner"))?.fresh, true)
})
test("Redis failure still serves stored data and does not assume it is fresh", async () => {
	const f = fixture()
	f.setStored(raw(900_000))
	f.failFast()
	assert.deepEqual(await f.read("owner"), {
		pool,
		version: 900_000,
		fresh: false,
	})
	assert.equal(f.errors.length, 2)
})
test("failed durable writes do not publish a fast cache entry", async () => {
	const f = fixture()
	f.failStored()
	await assert.rejects(f.write("owner", pool, 900_000), /Crate down/)
	assert.equal(await f.read("owner"), null)
})
test("corrupt fast copies fall back to the durable snapshot", async () => {
	const f = fixture()
	f.setFast("{")
	f.setStored(raw(900_000))
	assert.deepEqual(await f.read("owner"), {
		pool,
		version: 900_000,
		fresh: true,
	})
})

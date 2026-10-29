import assert from "node:assert/strict"
import { afterEach, beforeEach, test as it, mock } from "node:test"
import type { TalkedRow } from "../../domain/talked-about-now.ts"
import {
	createHotPageRead,
	HOT_PAGE_BUDGET_MS,
	HOT_PAGE_RETRY_SECONDS,
	HotPageUnavailable,
} from "./page-read.ts"

const row = { day: "2026-10-29", source: "fixture", titles: [] } as TalkedRow
const deferred = <T>() => {
	let resolve!: (value: T) => void
	let reject!: (error: Error) => void
	const promise = new Promise<T>((yes, no) => {
		resolve = yes
		reject = no
	})
	return { promise, resolve, reject }
}
async function advance(ms: number) {
	await Promise.resolve()
	mock.timers.tick(ms)
	for (let i = 0; i < 10; i++) await Promise.resolve()
}

beforeEach(() => {
	mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 })
})
afterEach(() => mock.timers.reset())

it("bounds a cold read and shares its continuing fill with the next request", async () => {
	const cache = createHotPageRead()
	const fill = deferred<TalkedRow | null>()
	const load = mock.fn(() => fill.promise)
	const first = assert.rejects(cache.get(load), HotPageUnavailable)
	await advance(HOT_PAGE_BUDGET_MS)
	await first
	fill.resolve(row)
	await advance(0)
	assert.equal(await cache.get(load), row)
	assert.equal(load.mock.callCount(), 1)
})
it("serves the previous complete row while one refresh runs", async () => {
	const cache = createHotPageRead()
	await cache.get(async () => row)
	await advance(600_001)
	const fill = deferred<TalkedRow | null>()
	const load = mock.fn(() => fill.promise)
	assert.equal(await cache.get(load), row)
	assert.equal(await cache.get(load), row)
	assert.equal(load.mock.callCount(), 1)
	const next = { ...row, day: "2026-10-30" }
	fill.resolve(next)
	await advance(0)
	assert.equal(await cache.get(load), next)
})
it("backs off failures without extending the stale deadline", async () => {
	const cache = createHotPageRead()
	await cache.get(async () => row)
	await advance(600_001)
	const load = mock.fn(async () => {
		throw new Error("database unavailable")
	})
	assert.equal(await cache.get(load), row)
	await advance(0)
	assert.equal(await cache.get(load), row)
	assert.equal(load.mock.callCount(), 1)
	await advance(600_000)
	await assert.rejects(cache.get(load), HotPageUnavailable)
})
it("does not resurrect a ranking reset by a report while a read is in flight", async () => {
	const cache = createHotPageRead()
	const fill = deferred<TalkedRow | null>()
	const first = cache.get(() => fill.promise)
	cache.reset()
	fill.resolve(row)
	await first
	const next = { ...row, day: "2026-10-30" }
	assert.equal(await cache.get(async () => next), next)
})
it("keeps a genuinely absent ranking and clears the deadline after success", async () => {
	const cache = createHotPageRead()
	const load = mock.fn(async () => null)
	assert.equal(await cache.get(load), null)
	assert.equal(await cache.get(load), null)
	assert.equal(load.mock.callCount(), 1)
})

it("allows a normal two-second cold read to complete", async () => {
	const cache = createHotPageRead()
	const result = cache.get(
		() => new Promise((resolve) => setTimeout(() => resolve(row), 2_000)),
	)
	await advance(2_000)
	assert.equal(await result, row)
})

it("retries a cold failure after the advertised five seconds", async () => {
	const cache = createHotPageRead()
	const load = mock.fn(async () => {
		throw new Error("unavailable")
	})
	await assert.rejects(cache.get(load), HotPageUnavailable)
	await advance(HOT_PAGE_RETRY_SECONDS * 1000 - 1)
	await assert.rejects(cache.get(load), HotPageUnavailable)
	assert.equal(load.mock.callCount(), 1)
	await advance(1)
	assert.equal(await cache.get(async () => row), row)
})
it("keeps a minute of backoff only while a stale ranking remains usable", async () => {
	const cache = createHotPageRead()
	await cache.get(async () => row)
	await advance(1_190_000)
	const load = mock.fn(async () => {
		throw new Error("unavailable")
	})
	assert.equal(await cache.get(load), row)
	await advance(5_000)
	assert.equal(await cache.get(load), row)
	assert.equal(load.mock.callCount(), 1)
	await advance(5_001)
	assert.equal(await cache.get(async () => row), row)
})

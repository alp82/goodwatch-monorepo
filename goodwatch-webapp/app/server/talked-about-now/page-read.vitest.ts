import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { TalkedRow } from "../../domain/talked-about-now.ts"
import {
	createHotPageRead,
	HOT_PAGE_BUDGET_MS,
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
beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(0)
})
afterEach(() => vi.useRealTimers())

it("bounds a cold read and shares its continuing fill with the next request", async () => {
	const cache = createHotPageRead()
	const fill = deferred<TalkedRow | null>()
	const load = vi.fn(() => fill.promise)
	const first = expect(cache.get(load)).rejects.toBeInstanceOf(
		HotPageUnavailable,
	)
	await vi.advanceTimersByTimeAsync(HOT_PAGE_BUDGET_MS)
	await first
	fill.resolve(row)
	await vi.advanceTimersByTimeAsync(0)
	expect(await cache.get(load)).toBe(row)
	expect(load).toHaveBeenCalledTimes(1)
	expect(vi.getTimerCount()).toBe(0)
})
it("serves the previous complete row while one refresh runs", async () => {
	const cache = createHotPageRead()
	await cache.get(async () => row)
	await vi.advanceTimersByTimeAsync(600_001)
	const fill = deferred<TalkedRow | null>()
	const load = vi.fn(() => fill.promise)
	expect(await cache.get(load)).toBe(row)
	expect(await cache.get(load)).toBe(row)
	expect(load).toHaveBeenCalledTimes(1)
	const next = { ...row, day: "2026-10-30" }
	fill.resolve(next)
	await vi.advanceTimersByTimeAsync(0)
	expect(await cache.get(load)).toBe(next)
})
it("backs off failures without extending the stale deadline", async () => {
	const cache = createHotPageRead()
	await cache.get(async () => row)
	await vi.advanceTimersByTimeAsync(600_001)
	const load = vi.fn(async () => {
		throw new Error("database unavailable")
	})
	expect(await cache.get(load)).toBe(row)
	await vi.advanceTimersByTimeAsync(0)
	expect(await cache.get(load)).toBe(row)
	expect(load).toHaveBeenCalledTimes(1)
	await vi.advanceTimersByTimeAsync(600_000)
	await expect(cache.get(load)).rejects.toBeInstanceOf(HotPageUnavailable)
})
it("does not resurrect a ranking reset by a report while a read is in flight", async () => {
	const cache = createHotPageRead()
	const fill = deferred<TalkedRow | null>()
	const first = cache.get(() => fill.promise)
	cache.reset()
	fill.resolve(row)
	await first
	const next = { ...row, day: "2026-10-30" }
	expect(await cache.get(async () => next)).toBe(next)
})
it("keeps a genuinely absent ranking and clears the deadline after success", async () => {
	const cache = createHotPageRead()
	const load = vi.fn(async () => null)
	expect(await cache.get(load)).toBeNull()
	expect(await cache.get(load)).toBeNull()
	expect(load).toHaveBeenCalledTimes(1)
	expect(vi.getTimerCount()).toBe(0)
})

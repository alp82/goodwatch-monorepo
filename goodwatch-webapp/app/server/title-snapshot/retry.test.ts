// The wait between failed title snapshot loads: it doubles, stops at a minute, and varies a little.
import assert from "node:assert/strict"
import { test } from "node:test"
import { retryDelayMs } from "./retry.server.ts"

test("each failure in a row doubles the wait, up to a minute", () => {
	const longest = (failures: number) => retryDelayMs(failures, 0.999999)
	assert.deepEqual(
		[1, 2, 3, 4, 5, 6, 7, 50].map(longest),
		[2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000],
	)
})

test("the wait varies between three quarters and all of its length", () => {
	assert.equal(retryDelayMs(1, 0), 1_500)
	assert.equal(retryDelayMs(3, 0), 6_000)
	assert.equal(retryDelayMs(9, 0), 45_000)
	for (let i = 0; i < 200; i++) {
		const wait = retryDelayMs(4)
		assert.ok(wait >= 12_000 && wait <= 16_000, String(wait))
	}
})

test("ten failed checks take minutes, not 20 seconds", () => {
	let total = 0
	for (let failures = 1; failures <= 10; failures++)
		total += retryDelayMs(failures, 0)
	// Every 2 seconds, as before, ten retries took 20 seconds.
	assert.ok(total >= 4 * 60_000, String(total))
})

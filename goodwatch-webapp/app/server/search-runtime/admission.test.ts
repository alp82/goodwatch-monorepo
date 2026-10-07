import assert from "node:assert/strict"
import { test } from "node:test"
import { createSearchAdmission, searchBusyResponse, SEARCH_BUSY_MESSAGE, SEARCH_BUSY_RETRY_SECONDS } from "./admission.server.ts"
import { encoderThreads, readingsConfigured, searchInFlightLimit, SEARCH_MAX_IN_FLIGHT_DEFAULT } from "./limits.server.ts"
import { renderMetrics } from "../metrics/registry.server.ts"

test("admission respects the limit and release returns a slot only once", () => {
	const admission = createSearchAdmission({ limit: () => 2 })
	const first = admission.enter()
	const second = admission.enter()
	assert.ok(first)
	assert.ok(second)
	assert.equal(admission.inFlight(), 2)
	assert.equal(admission.enter(), null)
	first()
	assert.equal(admission.inFlight(), 1)
	const third = admission.enter()
	assert.ok(third)
	first()
	assert.equal(admission.inFlight(), 2)
	assert.equal(admission.enter(), null)
	second()
	third()
	assert.equal(admission.inFlight(), 0)
})

test("admission reads its limit on every entry", () => {
	let limit = 1
	const admission = createSearchAdmission({ limit: () => limit })
	assert.ok(admission.enter())
	assert.equal(admission.enter(), null)
	limit = 2
	assert.ok(admission.enter())
})

for (const rejected of [false, true]) {
	test(`hold counts work until it ${rejected ? "rejects" : "fulfills"}`, async () => {
		const admission = createSearchAdmission({ limit: () => 1 })
		let settle!: () => void
		const work = new Promise<void>((resolve, reject) => {
			settle = rejected ? () => reject(new Error("failed")) : resolve
		})
		admission.hold(work)
		assert.equal(admission.inFlight(), 1)
		assert.equal(admission.enter(), null)
		// A hold is accepted even when all slots are already taken.
		admission.hold(work)
		assert.equal(admission.inFlight(), 2)
		settle()
		await new Promise((resolve) => setImmediate(resolve))
		assert.equal(admission.inFlight(), 0)
		assert.ok(admission.enter())
	})
}

test("busy response supplies private retry headers, JSON and a metric", async () => {
	const response = searchBusyResponse()
	assert.equal(response.status, 503)
	for (const [name, value] of Object.entries({
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "private, no-store",
		"Retry-After": String(SEARCH_BUSY_RETRY_SECONDS),
		"X-Robots-Tag": "noindex",
		"Referrer-Policy": "no-referrer",
	})) assert.equal(response.headers.get(name), value)
	assert.deepEqual(await response.json(), { error: SEARCH_BUSY_MESSAGE })
	assert.match(renderMetrics(), /goodwatch_search_busy_total 1\n/)
})

test("search limit accepts positive safe integers and defaults otherwise", () => {
	assert.equal(SEARCH_MAX_IN_FLIGHT_DEFAULT, 4)
	assert.equal(searchInFlightLimit({}), 4)
	for (const value of ["0", "-1", "abc", "2.5", "", "Infinity", "9007199254740992"])
		assert.equal(searchInFlightLimit({ SEARCH_MAX_IN_FLIGHT: value }), 4)
	for (const value of [1, 7, Number.MAX_SAFE_INTEGER])
		assert.equal(searchInFlightLimit({ SEARCH_MAX_IN_FLIGHT: String(value) }), value)
})

test("encoder threads use valid settings or half the cores capped at four", () => {
	for (const [cores, expected] of [[1, 1], [2, 1], [4, 2], [8, 4], [16, 4]]) {
		assert.equal(encoderThreads({}, cores), expected)
		for (const value of ["0", "-1", "abc", "2.5", "65", "", "Infinity"])
			assert.equal(encoderThreads({ SEARCH_ENCODER_THREADS: value }, cores), expected)
	}
	for (const value of [1, 2, 4, 64])
		assert.equal(encoderThreads({ SEARCH_ENCODER_THREADS: String(value) }, 1), value)
})

test("readings require exactly 64 hexadecimal characters", () => {
	assert.equal(readingsConfigured({}), false)
	for (const value of ["0", "-1", "abc", "2.5", "a".repeat(63), "a".repeat(65), "g".repeat(64)])
		assert.equal(readingsConfigured({ SEARCH_STORAGE_KEY: value }), false)
	assert.equal(readingsConfigured({ SEARCH_STORAGE_KEY: "aB09".repeat(16) }), true)
})

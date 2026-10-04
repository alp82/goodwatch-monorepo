// Drives every cache outcome with a fake Redis client while preserving target behavior.
import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import "ioredis"
import "../title-filter/test-alias.ts"
const { cached, serializeCacheEntry, setRedisClusterForTest } = await import(
	"../../utils/cache.ts"
)
const { renderMetrics, resetMetricsForTest } = await import(
	"./registry.server.ts"
)
// Allow the import-time Redis connection attempt to finish before installing each fake.
await new Promise((resolve) => setTimeout(resolve, 1000))
beforeEach(resetMetricsForTest)

test("all cache results count once and only target execution records duration", async () => {
	for (const result of [
		"hit",
		"stale",
		"miss",
		"unavailable",
		"error",
		"bypass",
	]) {
		resetMetricsForTest()
		let reads = 0
		let calls = 0
		let writes = 0
		const data = { answer: 42 }
		setRedisClusterForTest(
			result === "unavailable"
				? null
				: {
						async get() {
							reads++
							if (result === "error") throw new Error("Read failed")
							return result === "hit" || result === "stale"
								? serializeCacheEntry(data, result === "stale" ? 0 : Date.now())
								: null
						},
						async setex() {
							writes++
						},
						async del() {
							return 0
						},
						async info() {
							return ""
						},
					},
		)
		const response = await cached({
			name: "related-movie-603",
			metricName: "related-movie",
			params: {},
			ttlMinutes: result === "bypass" ? 0 : 1,
			target: async () => {
				calls++
				return data
			},
		})
		assert.deepEqual(response, data)
		assert.equal(calls, result === "hit" ? 0 : 1)
		assert.equal(reads, result === "bypass" || result === "unavailable" ? 0 : 1)
		assert.equal(
			writes,
			result === "hit" || result === "bypass" || result === "unavailable"
				? 0
				: 1,
		)
		const output = renderMetrics()
		assert.ok(
			output.includes(
				`goodwatch_data_cache_requests_total{cache="related-movie",result="${result}"} 1`,
			),
			result,
		)
		assert.equal(
			output.includes(
				'goodwatch_data_cache_miss_duration_seconds_count{cache="related-movie"} 1',
			),
			result !== "hit",
		)
		assert.ok(!output.includes("603"))
	}
})
test("target failures still record duration and preserve the thrown error", async () => {
	setRedisClusterForTest(null)
	const error = new Error("Target failed")
	await assert.rejects(
		cached({
			name: "failing",
			params: {},
			ttlMinutes: 1,
			target: async () => {
				throw error
			},
		}),
		(caught) => caught === error,
	)
	assert.ok(
		renderMetrics().includes(
			'goodwatch_data_cache_miss_duration_seconds_count{cache="failing"} 1',
		),
	)
})
test("metricName bounds many distinct keys and both cache metrics cap at 100", async () => {
	setRedisClusterForTest(null)
	for (let i = 0; i < 110; i++)
		await cached({
			name: `dynamic-${i}`,
			metricName: "bounded",
			params: {},
			ttlMinutes: 0,
			target: async () => ({}),
		})
	assert.ok(
		renderMetrics().includes(
			'goodwatch_data_cache_requests_total{cache="bounded",result="bypass"} 110',
		),
	)
	assert.ok(!renderMetrics().includes("dynamic-"))
	resetMetricsForTest()
	for (let i = 0; i < 101; i++)
		await cached({
			name: `cap-${i}`,
			params: {},
			ttlMinutes: 0,
			target: async () => ({}),
		})
	for (const metric of [
		"goodwatch_data_cache_requests_total",
		"goodwatch_data_cache_miss_duration_seconds",
	])
		assert.ok(
			renderMetrics().includes(
				`goodwatch_metrics_dropped_label_sets_total{metric="${metric}"} 1`,
			),
		)
})

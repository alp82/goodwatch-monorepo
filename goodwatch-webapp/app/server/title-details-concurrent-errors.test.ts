import "react"
import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import Redis from "ioredis"
import "./title-filter/test-alias.ts"
// Suppress cache.ts's import-time cluster connection; all commands use the fake below.
const originalConnect = Redis.Cluster.prototype.connect
Redis.Cluster.prototype.connect = async () => {}
const { createTitleDetailsGetters } = await import("./title-details-cache.ts")
const { cached, setRedisClusterForTest } = await import("../utils/cache.ts")
const { createStaticHandler, isRouteErrorResponse } = await import("@remix-run/router")
Redis.Cluster.prototype.connect = originalConnect

beforeEach(() => {
	setRedisClusterForTest({
		get: async () => null,
		setex: async () => {},
		del: async () => 0,
	})
})
afterEach(() => setRedisClusterForTest(null))

for (const mediaType of ["movie", "show"] as const) {
	test(`three concurrent requests for a missing ${mediaType} each receive a 404`, async () => {
		let fetches = 0
		const getters = createTitleDetailsGetters(async () => {
			fetches++
			await delay(20)
			throw new Response("Not Found", { status: 404 })
		})
		const handler = createStaticHandler([
			{
				id: "details",
				path: `/${mediaType}/:${mediaType}Key`,
				loader: ({ params }) =>
					mediaType === "movie"
						? getters.getDetailsForMovie({
								movieId: params.movieKey!,
								country: "US",
								language: "en",
							})
						: getters.getDetailsForShow({
								showId: params.showKey!,
								country: "US",
								language: "en",
							}),
			},
		])
		const results = await Promise.all(
			Array.from({ length: 3 }, () =>
				handler.query(new Request(`http://localhost/${mediaType}/999999999`)),
			),
		)
		assert.equal(fetches, 1)
		for (const result of results) {
			assert.ok(!(result instanceof Response))
			assert.equal(result.statusCode, 404)
			const error = result.errors?.details
			assert.ok(isRouteErrorResponse(error))
			assert.equal(error.status, 404)
			assert.equal(error.data, "Not Found")
		}
	})
}

test("three concurrent cached redirects return distinct 301 responses", async () => {
	let fetches = 0
	const handler = createStaticHandler([
		{
			path: "/movie/:movieKey",
			loader: () => cached({
				name: "concurrent-errors-redirect",
				params: {},
				ttlMinutes: 1,
				target: async () => {
					fetches++
					await delay(20)
					throw new Response(null, {
						status: 301,
						headers: { Location: "/movie/42" },
					})
				},
			}),
		},
	])
	const results = await Promise.all(
		Array.from({ length: 3 }, () =>
			handler.query(new Request("http://localhost/movie/999999999")),
		),
	)
	assert.equal(fetches, 1)
	for (const result of results) {
		assert.ok(result instanceof Response)
		assert.equal(result.status, 301)
		assert.equal(result.headers.get("Location"), "/movie/42")
	}
	assert.equal(new Set(results).size, 3)
})

test("three concurrent cached callers receive distinct readable 404 responses", async () => {
	let fetches = 0
	const original = new Response("Not Found", { status: 404 })
	const results = await Promise.all(
		Array.from({ length: 3 }, () =>
			cached({
				name: "concurrent-errors-direct-response",
				params: {},
				ttlMinutes: 1,
				target: async () => {
					fetches++
					await delay(20)
					throw original
				},
			}).catch((error: unknown) => error),
		),
	)
	assert.equal(fetches, 1)
	assert.equal(new Set(results).size, 3)
	for (const result of results) {
		assert.ok(result instanceof Response)
		assert.notEqual(result, original)
		assert.equal(result.status, 404)
		assert.equal(await result.text(), "Not Found")
	}
	assert.equal(original.bodyUsed, false)
})

test("three concurrent cached callers receive the same non-Response error", async () => {
	let fetches = 0
	const original = new Error("Details unavailable")
	const results = await Promise.all(
		Array.from({ length: 3 }, () =>
			cached({
				name: "concurrent-errors-direct-error",
				params: {},
				ttlMinutes: 1,
				target: async () => {
					fetches++
					await delay(20)
					throw original
				},
			}).catch((error: unknown) => error),
		),
	)
	assert.equal(fetches, 1)
	for (const result of results) assert.equal(result, original)
})

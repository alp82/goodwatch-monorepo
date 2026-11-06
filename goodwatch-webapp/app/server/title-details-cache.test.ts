import "react"
import assert from "node:assert/strict"
import { test } from "node:test"
import Redis from "ioredis"
import "./title-filter/test-alias.ts"
// Suppress cache.ts's import-time cluster connection; all commands use the fake below.
const originalConnect = Redis.Cluster.prototype.connect
Redis.Cluster.prototype.connect = async () => {}
const {
	createTitleDetailsGetters,
	DETAILS_TTL_MINUTES,
	DETAILS_STALE_MINUTES,
} = await import("./title-details-cache.ts")
const { setRedisClusterForTest } = await import("../utils/cache.ts")
const { trimTitleDetails } = await import("./title-details-shape.ts")
Redis.Cluster.prototype.connect = originalConnect

test("details cache stores trimmed values in versioned normalized keys for the lifetime plus the stale window", async () => {
	const store = new Map<string, string>()
	const reads: string[] = []
	const ttls: number[] = []
	setRedisClusterForTest({
		get: async (key) => {
			reads.push(key)
			return store.get(key) ?? null
		},
		setex: async (key, ttl, value) => {
			store.set(key, value)
			ttls.push(ttl)
		},
		del: async (key) => Number(store.delete(key)),
	})
	let fetches = 0
	const awards = {
		coverage: "partial" as const,
		source: "TVDB" as const,
		note: "Reported results from TVDB. Coverage is incomplete, so these results don't establish award totals.",
		wins: [
			{ award: "Academy Awards", category: "Cinematography", year: "2024" },
		],
		nominations: [],
	}
	const award_results = [
		{ award: "Academy Awards", category: "Cinematography", year: "2024", won: true },
		{ award: "BAFTA Awards", category: "Editing", year: "2024", won: false },
	]
	const seen: unknown[] = []
	const getters = createTitleDetailsGetters(async (...args) => {
		fetches++
		seen.push(args)
		return {
			awards,
			award_results,
			details: { tmdb_id: 42, title: "Title", tropes: [], keywords: ["junk"] },
			cast_rows: [],
			videos: { clips: null, trailers: [], featurettes: [] },
		}
	})
	try {
		for (const language of ["EN", "en", "junk"])
			for (const country of ["us", "US"])
				await getters.getDetailsForMovie({
					movieId: "5338654",
					country,
					language,
				})
		await getters.getDetailsForShow({
			showId: "42",
			country: "us",
			language: "EN",
		})
		await getters.getDetailsForShow({
			showId: "42",
			country: "US",
			language: "invalid",
		})
		assert.equal(fetches, 2)
		assert.deepEqual(seen[0], ["movie", "658039", "US", "en"])
		assert.equal(store.size, 2)
		assert.ok(
			[...store.keys()].some((key) =>
				key.startsWith("cached-details-movie-v8:"),
			),
		)
		assert.ok(
			[...store.keys()].some((key) =>
				key.startsWith("cached-details-show-v9:"),
			),
		)
		assert.ok(
			reads.every(
				(key) =>
					!key.startsWith("cached-details-movie:") &&
					!key.startsWith("cached-details-show:") &&
					!key.startsWith("cached-details-movie-v2:") &&
					!key.startsWith("cached-details-movie-v3:") &&
					!key.startsWith("cached-details-show-v3:") &&
					!key.startsWith("cached-details-show-v4:") &&
					!key.startsWith("cached-details-movie-v6:") &&
					!key.startsWith("cached-details-show-v7:") &&
					!key.startsWith("cached-details-movie-v7:") &&
					!key.startsWith("cached-details-show-v8:"),
			),
		)
		for (const value of store.values()) {
			const stored = JSON.parse(value)
			assert.deepEqual(stored.data.awards, awards)
			assert.deepEqual(stored.data.award_results, award_results)
			assert.ok(!value.includes("availability_evidence"))
			assert.ok(!value.includes("cast_rows"))
			assert.ok(value.includes('"cast":[]'))
			assert.ok(value.includes('"keywords":[]'))
			assert.deepEqual(
				stored.data,
				JSON.parse(
					JSON.stringify(
						trimTitleDetails(
							{
								awards,
								award_results,
								details: {
									tmdb_id: 42,
									title: "Title",
									tropes: [],
									keywords: ["junk"],
								},
								cast_rows: [],
								videos: { clips: null, trailers: [], featurettes: [] },
							},
							stored.data.mediaType,
						),
					),
				),
			)
		}
		assert.deepEqual(
			ttls,
			Array(2).fill((DETAILS_TTL_MINUTES + DETAILS_STALE_MINUTES) * 60),
		)
		const readCount = reads.length
		for (const movieId of ["garbage", "1e2", "", "42;DROP"])
			await assert.rejects(
				getters.getDetailsForMovie({ movieId, country: "US", language: "en" }),
				(error) => error instanceof Response && error.status === 404,
			)
		assert.equal(reads.length, readCount)
		await getters.getDetailsForMovie(
			{ movieId: "42", country: "junk", language: "?" },
			{ bypassCache: true },
		)
		assert.equal(reads.length, readCount)
		assert.deepEqual(seen.at(-1), ["movie", "42", "", "en"])
		await getters.getDetailsForShow({
			showId: "42",
			country: "junk",
			language: "EN",
		})
		await getters.getDetailsForShow({
			showId: "42",
			country: "",
			language: "invalid",
		})
		assert.equal(store.size, 3)
		await assert.rejects(
			getters.getDetailsForShow({
				showId: "42x",
				country: "US",
				language: "en",
			}),
			(error) => error instanceof Response && error.status === 404,
		)
	} finally {
		setRedisClusterForTest(null)
	}
})

test("title details are fresh for 12 hours and never served older than 24 hours", () => {
	assert.equal(DETAILS_TTL_MINUTES, 12 * 60)
	assert.equal(DETAILS_TTL_MINUTES + DETAILS_STALE_MINUTES, 24 * 60)
})

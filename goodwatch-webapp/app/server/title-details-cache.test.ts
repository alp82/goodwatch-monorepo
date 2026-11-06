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
	DETAILS_AWARDS_LATE_MINUTES,
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

test("a title whose award read was late is stored for the same lifetime but fresh for 10 minutes only", async () => {
	const store = new Map<string, string>()
	const ttls: number[] = []
	setRedisClusterForTest({
		get: async (key) => store.get(key) ?? null,
		setex: async (key, ttl, value) => {
			store.set(key, value)
			ttls.push(ttl)
		},
		del: async (key) => Number(store.delete(key)),
	})
	const raw = (awards_late: boolean) => ({
		...(awards_late ? { awards_late } : {}),
		details: { tmdb_id: 7, title: "Title", tropes: [] },
		cast_rows: [],
		videos: { clips: null, trailers: [], featurettes: [] },
		mediaType: "movie" as const,
	})
	try {
		const late = createTitleDetailsGetters(async () => raw(true))
		const before = Date.now()
		await late.getDetailsForMovie({ movieId: "7", country: "US", language: "en" })
		const [stored] = [...store.values()].map((v) => JSON.parse(v))
		assert.ok(!("awards_late" in stored.data), "the stored shape is unchanged")
		const backdated = (DETAILS_TTL_MINUTES - DETAILS_AWARDS_LATE_MINUTES) * 60_000
		assert.ok(before - stored.timestamp >= backdated - 1000)
		assert.ok(before - stored.timestamp < backdated + 5000)
		assert.deepEqual(ttls, [(DETAILS_TTL_MINUTES + DETAILS_STALE_MINUTES) * 60])
		// A hit inside the 10 minutes serves it without a fetch; after them the lookup is stale and refreshes.
		let fetches = 0
		const complete = createTitleDetailsGetters(async () => {
			fetches++
			return raw(false)
		})
		await complete.getDetailsForMovie({ movieId: "7", country: "US", language: "en" })
		assert.equal(fetches, 0)
		const key = [...store.keys()][0]
		const entry = JSON.parse(store.get(key) ?? "")
		entry.timestamp -= (DETAILS_AWARDS_LATE_MINUTES + 1) * 60_000
		store.set(key, JSON.stringify(entry))
		await complete.getDetailsForMovie({ movieId: "7", country: "US", language: "en" })
		for (let i = 0; i < 20 && fetches === 0; i++) await new Promise((r) => setTimeout(r, 5))
		assert.equal(fetches, 1)
		await new Promise((r) => setTimeout(r, 20))
		const refreshed = JSON.parse(store.get(key) ?? "")
		assert.ok(Date.now() - refreshed.timestamp < 5000, "a complete refresh is fresh for the lifetime")
	} finally {
		setRedisClusterForTest(null)
	}
})

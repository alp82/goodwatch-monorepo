import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"
import type { TitleSnapshot } from "./title-snapshot/snapshot.server"
import type { query } from "~/utils/crate"
const cache = new Map<string, string>()
const calls: { sql: string; params?: unknown[] }[] = []
const person = (id: number, department = "Acting") => ({
	tmdb_id: id,
	name: `Person ${id}`,
	profile_path: `/face-${id}`,
	known_for_department: department,
})
const boundary = globalThis as typeof globalThis & {
	peopleQuery: typeof query
	peopleRedis: object
	peopleSnapshot: TitleSnapshot | null
}
boundary.peopleSnapshot = null
boundary.peopleRedis = {
	get: async (key: string) => cache.get(key) ?? null,
	set: async (key: string, value: string, mode: string, ttl: number) => {
		assert.equal(mode, "EX")
		assert.equal(ttl, 1800)
		cache.set(key, value)
	},
}
boundary.peopleQuery = async <T extends {}>(
	sql: string,
	params?: unknown[],
): Promise<T[]> => {
	calls.push({ sql, params })
	let rows: object[]
	if (sql.includes("FROM person_appeared_in"))
		rows = [
			{ person_tmdb_id: 1, count: params?.[0] === "movie" ? 8 : 4 },
			{ person_tmdb_id: 99, count: 100 },
		]
	else if (sql.includes("FROM person_worked_on"))
		rows = [
			{ person_tmdb_id: 2, job: "Director", count: 10 },
			{ person_tmdb_id: 3, job: "Screenplay", count: 2 },
			{ person_tmdb_id: 3, job: "Novel", count: 1 },
		]
	else rows = [person(1), person(2, "Directing"), person(3, "Writing")]
	return rows as T[]
}
stubModules({
	"~/server/title-snapshot/index.server": "export const getTitleSnapshot = () => globalThis.peopleSnapshot",
	"~/utils/crate":
		"export const query = (...args) => globalThis.peopleQuery(...args)",
	"~/utils/cache":
		"export const getRedisCluster = () => globalThis.peopleRedis; export const withRedisDeadline = p => p",
	"../../public/sitemaps/sitemap_people.xml?raw": `export default '<urlset>${Array.from({ length: 8 }, (_, i) => `<url><loc>https://goodwatch.app/person/${i + 1}-person</loc></url>`).join("")}</urlset>'`,
})
const {
	readPeopleInResults,
	peopleCacheKey,
	peopleInResults,
	featuredPeople,
} = await import("./discover-people.server.ts")

test("grouped fixture combines kinds and writing jobs and skips people absent from adult-safe read", async () => {
	calls.length = 0
	const result = await readPeopleInResults([1e12 + 11, 2e12 + 22])
	assert.equal(calls.length, 5)
	assert.deepEqual(
		result.actors.map((p) => [p.tmdb_id, p.count, p.note]),
		[[1, 12, "12 titles"]],
	)
	assert.deepEqual(
		result.crew.map((p) => [p.tmdb_id, p.count, p.note]),
		[
			[2, 20, "Director · 20"],
			[3, 6, "Writer · 6"],
		],
	)
	assert.match(calls[4].sql, /adult = false/)
})
test("SQL inlines validated literal IDs, binds kind/jobs, deduplicates, and skips empty kinds", async () => {
	calls.length = 0
	await readPeopleInResults([
		1e12 + 11,
		1e12 + 11,
		1e12 + 12,
		1e12,
		2e12,
		3e12,
		NaN,
		Infinity,
		1e12 + 0.5,
		"11); DROP TABLE person" as unknown as number,
	])
	assert.equal(calls.length, 3)
	for (const call of calls.slice(0, 2)) {
		assert.match(call.sql, /media_tmdb_id IN \(11,12\)/)
		assert.equal(call.params?.[0], "movie")
		assert.doesNotMatch(call.sql, /DROP|NaN|Infinity|IN \(\?\)/)
	}
	assert.match(
		calls[0].sql,
		/order_default < 15 GROUP BY person_tmdb_id ORDER BY 2 DESC LIMIT 60/,
	)
	assert.match(calls[1].sql, /GROUP BY person_tmdb_id, job/)
	assert.match(calls[1].sql, /COUNT\(\*\) AS count/)
	assert.deepEqual(calls[1].params?.slice(1), [
		"Director",
		"Screenplay",
		"Writer",
		"Novel",
		"Original Music Composer",
		"Director of Photography",
	])
	calls.length = 0
	assert.deepEqual(await readPeopleInResults([]), {
		mode: "results",
		actors: [],
		crew: [],
	})
	assert.equal(calls.length, 0)
})
test("cache hashes the same key set in any order and reuses concurrent and subsequent requests", async () => {
	const keys = [1e12 + 31, 2e12 + 32]
	assert.equal(
		peopleCacheKey(keys),
		peopleCacheKey([keys[1], keys[0], keys[0]]),
	)
	assert.notEqual(peopleCacheKey(keys), peopleCacheKey([1e12 + 32]))
	assert.match(peopleCacheKey(keys), /^discover-people:v1:[\w-]+$/)
	calls.length = 0
	const [first, shared] = await Promise.all([
		peopleInResults(keys),
		peopleInResults([...keys].reverse()),
	])
	assert.deepEqual(shared, first)
	assert.equal(calls.length, 5)
	assert.deepEqual(await peopleInResults([...keys].reverse()), first)
	assert.equal(calls.length, 5)
})
test("featured preserves eight sitemap actors and fills distinct crew quotas from the top 300 Popular movies, cached per version", async (t) => {
	const originalQuery = boundary.peopleQuery
	t.after(() => { boundary.peopleQuery = originalQuery; boundary.peopleSnapshot = null })
	const { FLAG_POSTER, FLAG_ADULT } = await import("./title-snapshot/format.server.ts")
	// More than 300 movies interleaved with shows: filter kind before taking 300.
	// Descending popularity reverses input order. The most popular movie is adult and ineligible.
	const keys = Array.from({ length: 606 }, (_, i) => (i % 2 ? 2e12 : 1e12) + i + 1)
	boundary.peopleSnapshot = {
		version: "featured-first", count: keys.length,
		columns: {
			pointIds: Float64Array.from(keys),
			popularity: Float32Array.from(keys, (_, i) => i),
			votes: Uint32Array.from(keys, () => 2000),
			scores: Uint8Array.from(keys, () => 80),
			releaseDays: Int32Array.from(keys, () => 100),
			flags: Uint8Array.from(keys, (_, i) => FLAG_POSTER | (i === 604 ? FLAG_ADULT : 0)),
		},
	} as unknown as TitleSnapshot
	const credits = [
		{ person_tmdb_id: 1, job: "Director", count: 1000 }, // featured actor
		{ person_tmdb_id: 9, job: "Director", count: 900 }, // another actor
		{ person_tmdb_id: 999, job: "Director", count: 800 }, // absent from adult-safe read
		...Array.from({ length: 5 }, (_, i) => ({ person_tmdb_id: 20 + i, job: "Director", count: 100 - i })),
		{ person_tmdb_id: 20, job: "Writer", count: 1000 }, // already a director
		{ person_tmdb_id: 30, job: "Screenplay", count: 30 },
		{ person_tmdb_id: 30, job: "Novel", count: 40 },
		{ person_tmdb_id: 31, job: "Writer", count: 65 },
		{ person_tmdb_id: 32, job: "Novel", count: 60 },
		{ person_tmdb_id: 33, job: "Screenplay", count: 55 },
		{ person_tmdb_id: 34, job: "Writer", count: 50 },
		{ person_tmdb_id: 30, job: "Original Music Composer", count: 1000 },
		{ person_tmdb_id: 40, job: "Original Music Composer", count: 2 },
		{ person_tmdb_id: 40, job: "Director of Photography", count: 1000 },
		{ person_tmdb_id: 41, job: "Director of Photography", count: 1 },
	]
	const people = [
		...Array.from({ length: 9 }, (_, i) => person(i + 1)),
		...Array.from({ length: 5 }, (_, i) => person(20 + i, "Directing")),
		...Array.from({ length: 5 }, (_, i) => person(30 + i, "Writing")),
		person(40, "Sound"), person(41, "Camera"),
	]
	let fail = false
	boundary.peopleQuery = async <T extends {}>(sql: string, params?: unknown[]): Promise<T[]> => {
		calls.push({ sql, params })
		assert.doesNotMatch(sql, /person_appeared_in|person\.popularity/)
		if (sql.includes("person_worked_on")) {
			if (fail) throw new Error("fixture credit failure")
			return credits as unknown as T[]
		}
		assert.match(sql, /adult = false/)
		return people as unknown as T[]
	}
	calls.length = 0
	const [first, shared] = await Promise.all([featuredPeople(), featuredPeople()])
	assert.strictEqual(first, shared)
	assert.deepEqual(first.actors.map(p => p.tmdb_id), [1, 2, 3, 4, 5, 6, 7, 8])
	assert.deepEqual(first.crew.map(p => [p.tmdb_id, p.role]), [
		[20, "Director"], [21, "Director"], [22, "Director"], [23, "Director"],
		[30, "Writer"], [31, "Writer"], [32, "Writer"], [33, "Writer"],
		[40, "Music"], [41, "Camera"],
	])
	assert.equal(new Set([...first.actors, ...first.crew].map(p => p.tmdb_id)).size, 18)
	assert.ok([...first.actors, ...first.crew].every(p => p.count === null && p.note === p.role))
	assert.equal(calls.length, 3) // actors once, movie crew only, one person read
	const expectedIds = Array.from({ length: 300 }, (_, i) => 603 - 2 * i)
	assert.equal(calls.filter(c => c.sql.includes("person_worked_on")).length, 1)
	for (const call of calls.filter(c => c.sql.includes("person_worked_on"))) {
		const ids = call.sql.match(/media_tmdb_id IN \(([^)]+)\)/)?.[1].split(",").map(Number)
		assert.deepEqual(ids, expectedIds)
		assert.deepEqual(call.params, ["movie", "Director", "Screenplay", "Writer", "Novel", "Original Music Composer", "Director of Photography"])
		assert.match(call.sql, /COUNT\(DISTINCT media_tmdb_id\) AS count/)
		assert.match(call.sql, /GROUP BY person_tmdb_id, job ORDER BY 3 DESC$/)
	}
	assert.strictEqual(await featuredPeople(), first)
	assert.equal(calls.length, 3)
	boundary.peopleSnapshot = { ...boundary.peopleSnapshot!, version: "featured-second" }
	await featuredPeople()
	assert.equal(calls.length, 5)

	boundary.peopleSnapshot = { ...boundary.peopleSnapshot, version: "featured-failure" }
	fail = true
	const warnings: unknown[][] = []
	t.mock.method(console, "warn", (...args: unknown[]) => { warnings.push(args) })
	const degraded = await featuredPeople()
	assert.deepEqual(degraded.actors, first.actors)
	assert.deepEqual(degraded.crew, [])
	assert.equal(warnings.length, 1)
	assert.match(String(warnings[0][0]), /featured crew unavailable/)
	fail = false
	const recovered = await featuredPeople()
	assert.deepEqual(recovered, first) // failure was not cached
	const recoveredCalls = calls.length
	assert.strictEqual(await featuredPeople(), recovered)
	assert.equal(calls.length, recoveredCalls)

	boundary.peopleSnapshot = null
	assert.deepEqual((await featuredPeople()).crew, [])
})

test("reader caps validated distinct titles to 100 across both kinds", async () => {
	calls.length = 0
	const keys = Array.from({ length: 130 }, (_, i) => (i % 2 ? 2e12 : 1e12) + i + 1)
	assert.equal(peopleCacheKey(keys), peopleCacheKey(keys.slice(0, 100)))
	assert.notEqual(peopleCacheKey(keys), peopleCacheKey([...keys].reverse()))
	await readPeopleInResults([NaN, keys[0], ...keys])
	assert.equal(calls.length, 5)
	for (const call of calls.slice(0, 4)) {
		const ids = call.sql.match(/media_tmdb_id IN \(([^)]+)\)/)?.[1].split(",").map(Number)
		const kind = call.params?.[0]
		assert.deepEqual(ids, keys.slice(0, 100).filter((key) => (key > 2e12 ? "show" : "movie") === kind).map((key) => key % 1e12))
		assert.match(call.sql, /LIMIT 60$/)
	}
})

test("empty results skip Redis and SELECT", async (t) => {
	const redis = boundary.peopleRedis
	t.after(() => { boundary.peopleRedis = redis })
	boundary.peopleRedis = {
		get: () => { throw new Error("unexpected cache get") },
		set: () => { throw new Error("unexpected cache set") },
	}
	calls.length = 0
	assert.deepEqual(await peopleInResults([]), { mode: "results", actors: [], crew: [] })
	assert.equal(calls.length, 0)
})

for (const operation of ["get", "set"] as const) {
	test(`Redis ${operation} rejection still returns the SELECT result`, async (t) => {
		const redis = boundary.peopleRedis
		t.after(() => { boundary.peopleRedis = redis })
		let gets = 0
		let sets = 0
		boundary.peopleRedis = {
			get: async () => { gets++; if (operation === "get") throw new Error("Redis get failed"); return null },
			set: async () => { sets++; if (operation === "set") throw new Error("Redis set failed") },
		}
		calls.length = 0
		const result = await peopleInResults([1e12 + 71])
		assert.equal(gets, 1)
		assert.equal(sets, 1)
		assert.equal(calls.length, 3)
		assert.ok(calls.every(({ sql }) => sql.startsWith("SELECT ")))
		assert.equal(result.actors[0].tmdb_id, 1)
		assert.equal(result.mode, "results")
	})
}

test("Redis set does not delay returning the SELECT result", async (t) => {
	const redis = boundary.peopleRedis
	t.after(() => { boundary.peopleRedis = redis })
	let finishSet: () => void = () => {}
	const set = new Promise<void>((resolve) => { finishSet = resolve })
	boundary.peopleRedis = { get: async () => null, set: () => set }
	calls.length = 0
	const result = await peopleInResults([1e12 + 72])
	assert.equal(calls.length, 3)
	assert.equal(result.actors[0].tmdb_id, 1)
	finishSet()
})

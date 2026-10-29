import assert from "node:assert/strict"
import { test } from "node:test"
import { stubModules } from "./rating-onboarding.test-support.ts"
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
}
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
	"~/utils/crate":
		"export const query = (...args) => globalThis.peopleQuery(...args)",
	"~/utils/cache":
		"export const getRedisCluster = () => globalThis.peopleRedis; export const withRedisDeadline = p => p",
	"../../public/sitemaps/sitemap_people.xml?raw": `export default '<urlset><url><loc>https://goodwatch.app/person/1-one</loc></url><url><loc>https://goodwatch.app/person/2-two</loc></url><url><loc>https://goodwatch.app/person/3-three</loc></url></urlset>'`,
})
const {
	readPeopleInResults,
	peopleCacheKey,
	peopleInResults,
	selectFeaturedPeople,
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
test("featured follows cohort order with 8 actors, 4 directors, 4 writers, 2 other crew and caches per deploy", async () => {
	const people = ["Acting", "Directing", "Writing", "Sound"].flatMap(
		(dept, n) =>
			Array.from({ length: 10 }, (_, i) => person(n * 10 + i + 1, dept)),
	)
	const result = selectFeaturedPeople(people)
	assert.equal(result.actors.length, 8)
	assert.deepEqual(
		result.crew.map((p) => p.role),
		[
			...Array(4).fill("Director"),
			...Array(4).fill("Writer"),
			"Sound",
			"Sound",
		],
	)
	assert.deepEqual(
		result.actors.map((p) => p.tmdb_id),
		[1, 2, 3, 4, 5, 6, 7, 8],
	)
	assert.ok([...result.actors, ...result.crew].every((p) => p.count === null))
	calls.length = 0
	assert.strictEqual(await featuredPeople(), await featuredPeople())
	assert.equal(calls.length, 1)
	assert.match(calls[0].sql, /adult = false/)
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

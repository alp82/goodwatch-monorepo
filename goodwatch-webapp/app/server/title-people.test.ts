import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import type { LoaderFunctionArgs } from "@remix-run/node"
const { loader } = await import("../routes/api.title-people.ts")
const { buildCast } = await import("../utils/title-people.ts")
const { createPeopleCache } = await import("./title-people.server.ts")

const key = { type: "show", id: 1416, kind: "cast" } as const
const data = buildCast("show", [], 466)

test("route rejects bad input before accessing a database", async () => {
	for (const query of [
		"",
		"type=show&id=0&kind=cast",
		"type=show&id=1416&kind=crew&limit=201",
	]) {
		await assert.rejects(
			loader({
				request: new Request(`http://localhost/api/title-people?${query}`),
			} as LoaderFunctionArgs),
			(error: unknown) => error instanceof Response && error.status === 400,
		)
	}
})

test("cache shares concurrent loads and keeps filters out of its identity", async () => {
	let calls = 0
	const load = createPeopleCache(async () => {
		calls++
		return data
	})
	const results = await Promise.all([load(key), load(key), load(key)])
	assert.equal(calls, 1)
	assert.ok(results.every((r) => r === data))
	await load({ ...key })
	assert.equal(calls, 1)
	await load({ ...key, kind: "crew" })
	await load({ ...key, type: "movie" })
	await load({ ...key, id: 1399 })
	assert.equal(calls, 4)
})

test("cache expires from load completion and evicts the least recently used title", async () => {
	let time = 0
	let calls = 0
	const load = createPeopleCache(
		async () => {
			calls++
			return data
		},
		{ ttlMs: 100, maxEntries: 2, now: () => time },
	)
	await load(key)
	await load({ ...key, id: 2 })
	await load(key)
	await load({ ...key, id: 3 })
	await load(key)
	assert.equal(calls, 3)
	await load({ ...key, id: 2 })
	assert.equal(calls, 4)
	time = 99
	await load(key)
	assert.equal(calls, 4)
	time = 100
	await load(key)
	assert.equal(calls, 5)
})

test("cache retries failed loads and does not retain oversized results", async () => {
	let calls = 0
	const load = createPeopleCache(async () => {
		if (++calls === 1) throw new Error("Unavailable")
		return data
	})
	await assert.rejects(load(key), /Unavailable/)
	await load(key)
	await load(key)
	assert.equal(calls, 2)
	const small = createPeopleCache(
		async () => {
			calls++
			return data
		},
		{ maxBytes: 1 },
	)
	await small(key)
	await small(key)
	assert.equal(calls, 4)
})

test("cache evicts by byte budget as well as entry count", async () => {
	let calls = 0
	const load = createPeopleCache(
		async () => {
			calls++
			return data
		},
		{ maxBytes: Buffer.byteLength(JSON.stringify(data)) },
	)
	await load(key)
	await load({ ...key, id: 2 })
	await load(key)
	assert.equal(calls, 3)
})

const { fetchTitleCast, fetchTitleCrew, fetchPeopleByIds } = await import(
	"./title-people.server.ts"
)
type Query = typeof import("~/utils/crate").query

test("cast and crew query credits then people with one distinct array parameter and join all roles", async () => {
	for (const kind of ["cast", "crew"] as const) {
		const calls: { sql: string; params: unknown }[] = []
		const credits = [
			{ person_tmdb_id: 2, credit_id: "b", character: "Second", job: "Writer" },
			{
				person_tmdb_id: 1,
				credit_id: "a",
				character: "First",
				job: "Director",
			},
			{
				person_tmdb_id: 2,
				credit_id: "a",
				character: "Other",
				job: "Producer",
			},
			{
				person_tmdb_id: 3,
				credit_id: "a",
				character: "Missing",
				job: "Editor",
			},
		]
		const people = [
			{ tmdb_id: 2, name: "Two", profile_path: null, popularity: null },
			{ tmdb_id: 1, name: "One", profile_path: "/one.jpg", popularity: 1 },
		]
		const query: Query = async <T extends {}>(
			sql: string,
			params?: (string | number | Date)[],
		) => {
			calls.push({ sql, params })
			return (calls.length === 1 ? credits : people) as unknown as T[]
		}
		const rows = await (kind === "cast" ? fetchTitleCast : fetchTitleCrew)(
			{ ...key, kind },
			query,
		)
		assert.equal(calls.length, 2)
		assert.match(
			calls[0].sql,
			new RegExp(
				`FROM ${kind === "cast" ? "person_appeared_in" : "person_worked_on"} WHERE media_type = \\? AND media_tmdb_id = \\? LIMIT 100000`,
			),
		)
		assert.deepEqual(calls[0].params, ["show", 1416])
		assert.equal(
			calls[1].sql,
			"SELECT tmdb_id, name, profile_path, popularity FROM person WHERE tmdb_id = ANY(?) LIMIT 100000",
		)
		assert.deepEqual(calls[1].params, [[2, 1, 3]])
		assert.ok(calls.every(({ sql }) => !/\b(JOIN|WITH)\b/.test(sql)))
		assert.deepEqual(
			rows.map((row) => [row.id, row.name]),
			[
				[1, "One"],
				[2, "Two"],
				[2, "Two"],
			],
		)
		assert.deepEqual(
			rows.map((row) =>
				kind === "cast"
					? (row as { character: string }).character
					: (row as { job: string }).job,
			),
			kind === "cast"
				? ["First", "Other", "Second"]
				: ["Director", "Producer", "Writer"],
		)
	}
})

test("people lookup skips empty ids and chunks distinct ids at 5000", async () => {
	const batches: unknown[] = []
	const query: Query = async (sql, params) => {
		batches.push(params)
		return []
	}
	assert.equal((await fetchPeopleByIds([], query)).size, 0)
	assert.equal(batches.length, 0)
	const ids = Array.from({ length: 5001 }, (_, i) => i + 1)
	await fetchPeopleByIds([...ids, 1, 5001], query)
	assert.deepEqual(batches, [[ids.slice(0, 5000)], [[5001]]])
})

test("failed people lookup rejects the title load", async () => {
	let calls = 0
	const query: Query = async <T extends {}>() => {
		if (++calls === 2) throw new Error("People unavailable")
		return [{ person_tmdb_id: 1, credit_id: "a" }] as unknown as T[]
	}
	await assert.rejects(fetchTitleCast(key, query), /People unavailable/)
})

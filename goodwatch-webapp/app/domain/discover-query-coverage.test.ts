import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import "../server/title-filter/test-alias.ts"
const { interpret } = await import("./discover-query.ts")
const { filterStateFromParams, filterStateToParams } = await import(
	"./filter-state.ts"
)
const { evaluateCase } = await import(
	"../../scripts/discover-query-lab/evaluate.mjs"
)
const cases = JSON.parse(
	readFileSync(
		new URL(
			"../../scripts/discover-query-lab/cases/current-filter-coverage.json",
			import.meta.url,
		),
		"utf8",
	),
)
for (const row of cases)
	test(`${row.query}${row.existing ? ` [${row.existing}]` : ""}`, () => {
		const result = interpret(
			row.query,
			row.existing ?? "",
			new Date("2026-11-02"),
		)
		const verdict = evaluateCase(row, result)
		assert.deepEqual(verdict.failures, [])
		const params = new URLSearchParams(result.filters)
		const state = filterStateFromParams(params, {
			onMyServices: false,
			notSeenYet: false,
		})
		const serialized = filterStateToParams(state, {
			onMyServices: false,
			notSeenYet: false,
		})
		for (const key of Object.keys(row.expect))
			if (
				!["services", "unseen", "foryou", "sort"].includes(key) &&
				!(
					key === "episodeRuntime" &&
					row.expect[key] === "any" &&
					!state.runtime
				)
			)
				assert(
					serialized.has(key),
					`${key} must survive Discover's real parser`,
				)
	})

const catalog = [
	{ id: 122, name: "Disney+" },
	{ id: 403, name: "Discovery" },
	{ id: 1875, name: "Runtime" },
	{ id: 73, name: "Tubi TV" },
]
for (const [q, expected] of [
	["Disney+", { services: "337" }],
	["Discovery Plus", { services: "524" }],
	["Tubi", { services: "73" }],
	["on Runtime", { services: "1875" }],
	["runtime under two hours", { maxRuntime: "119", services: "all" }],
	["runtime 90 minutes", { maxRuntime: "90", services: "all" }],
] as const)
	test(`catalog aliases and ambiguous words: ${q}`, () => {
		const result = interpret(q, "", new Date(), [], catalog)
		for (const [key, value] of Object.entries(expected))
			assert.equal(result.filters[key], value)
		assert.equal(result.residual, "")
		assert(!result.filters.score)
	})
for (const q of [
	"like Hit Man",
	"like Two Seasons",
	"like The Big Budget Movie",
])
	test(`a reference name is not a standalone new filter: ${q}`, () => {
		const r = interpret(q)
		assert(!r.filters.returns)
		assert(!r.filters.seasons)
		assert(!r.filters.budget)
		assert(r.entities.some((e) => e.name === q.slice(5)))
	})

test("confirmed person names expose trailing scores while exact numeric names remain intact", async () => {
	const { createEntityResolver } = await import(
		"../server/discover-query-entities.server.js"
	)
	const resolver = createEntityResolver(
		async () =>
			Response.json({
				castMembers: [
					{ name: "Tom Hanks", tmdb_id: 31 },
					{ name: "John 5", tmdb_id: 55 },
				],
			}),
		"http://lookup.invalid",
	)
	const proposal = await resolver({
		parameter: "people",
		name: "Tom Hanks 80",
		start: 0,
		end: 22,
	})
	assert.equal(proposal?.value, "31")
	assert.equal(proposal?.consumedName, "Tom Hanks")
	const r = interpret("with Tom Hanks 80", "", new Date(), [proposal])
	assert.equal(r.filters.people, "31")
	assert.equal(r.filters.score, "80")
	assert.equal(r.residual, "")
	const exact = await resolver({
		parameter: "people",
		name: "John 5",
		start: 0,
		end: 11,
	})
	assert.equal(exact?.value, "55")
	assert.equal(exact?.consumedName, "John 5")
	const named = interpret("with John 5", "", new Date(), [exact])
	assert.equal(named.filters.people, "55")
	assert(!named.filters.score)
})

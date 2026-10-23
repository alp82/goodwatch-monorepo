import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import type { MovieResult, ShowResult } from "../types/details-types.tsx"

const statements: { sql: string; args: unknown[]; signal?: AbortSignal }[] = []
let stalled = ""
let rejectPart = false
let emptyCredits = false
Object.assign(globalThis, {
	__titleEnrichmentQuery: async (
		sql: string,
		args: unknown[],
		signal?: AbortSignal,
	) => {
		statements.push({ sql, args, signal })
		const part = sql.includes("essence_text")
			? "analysis"
			: sql.includes("person_worked_on")
			? "creators"
			: "people"
		if (stalled === part) {
			if (rejectPart) throw new Error("backend unavailable")
			return new Promise(() => {})
		}
		if (part === "analysis") return [{ essence_text: "An analysis" }]
		if (sql.includes("JOIN person"))
			return [
				{ id: 2, name: "Creator B" },
				{ id: 9, name: "Creator I" },
			]
		if (part === "creators" && emptyCredits) return []
		if (part === "creators")
			return [{ id: 9 }, { id: 2 }, { id: 9 }, { id: 404 }]
		return [
			{ id: 2, name: "Creator B" },
			{ id: 9, name: "Creator I" },
		]
	},
	__titleEnrichmentGrid: async () => {
		if (stalled === "grid") {
			if (rejectPart) throw new Error("backend unavailable")
			return new Promise(() => {})
		}
		return { seasons: [], specials: [] }
	},
})
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string },
			next: (specifier: string, context: { parentURL?: string }) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (!context.parentURL?.endsWith("/mcp/title-details.server.ts"))
			return next(specifier, context)
		const body = specifier.includes("combined-search/catalog.server")
			? "export const searchQuery=(...args)=>globalThis.__titleEnrichmentQuery(...args)"
			: specifier.includes("episode-grid.server")
			? "export const getEpisodeGrid=()=>globalThis.__titleEnrichmentGrid()"
			: null
		return body
			? {
					url: `data:text/javascript,${encodeURIComponent(body)}`,
					shortCircuit: true,
			  }
			: next(specifier, context)
	},
})
const { richerTitleDetails } = await import("./title-details.server.ts")
const media = {
	mediaType: "show",
	details: { tmdb_id: 42, genres: [] },
	credits: { actors: [{ id: 1, name: "Actor" }], directors: [] },
	videos: {},
	seasons: [],
} as unknown as ShowResult
const origin = "https://goodwatch.app"

test("richerTitleDetails never joins person; creators retain distinct ordered links and limit after person lookup", async () => {
	statements.length = 0
	const result = await richerTitleDetails(media, origin, {
		include: ["cast", "analysis", "seasons", "episodes"],
	})
	assert.ok(statements.length > 0)
	for (const { sql } of statements)
		assert.doesNotMatch(sql, /\bJOIN\s+(?:doc\.)?person\b/i)
	const credits = statements.find(({ sql }) =>
		sql.includes("person_worked_on"),
	)!
	assert.deepEqual(credits.args, [42])
	assert.match(credits.sql, /SELECT DISTINCT person_tmdb_id AS id/)
	assert.match(
		credits.sql,
		/media_type = 'show'.*media_tmdb_id = \?.*job = 'Creator'/s,
	)
	assert.doesNotMatch(credits.sql, /LIMIT/i)
	const people = statements.find(({ sql }) => /FROM person WHERE/.test(sql))!
	assert.deepEqual(people.args, [9, 2, 404])
	assert.ok(people.signal)
	assert.equal(people.signal, credits.signal, "both creator lookups share one budget")
	assert.match(people.sql, /IN \(\?, \?, \?\)/)
	assert.match(people.sql, /SELECT DISTINCT tmdb_id AS id, name/)
	assert.match(people.sql, /ORDER BY tmdb_id LIMIT 10/)
	assert.deepEqual(
		result.creators?.map(({ id, name }) => ({ id, name })),
		[
			{ id: 2, name: "Creator B" },
			{ id: 9, name: "Creator I" },
		],
	)
	assert.equal(result.creators?.[0].url, `${origin}/person/2-creator-b`)
	assert.equal(result.title_analysis?.summary, "An analysis")
})

for (const part of ["analysis", "creators", "people", "grid"]) {
	for (const fails of [false, true]) {
		test(`${part} ${
			fails ? "failure" : "timeout"
		} drops only that enrichment`, async (t) => {
			stalled = part
			rejectPart = fails
			statements.length = 0
			t.mock.timers.enable({ apis: ["setTimeout"] })
			try {
				let result: Awaited<ReturnType<typeof richerTitleDetails>> | undefined
				const pending = richerTitleDetails(media, origin, {
					include: ["cast", "scores", "analysis", "seasons", "episodes"],
				}).then((value) => {
					result = value
				})
				await new Promise(setImmediate)
				t.mock.timers.tick(1000)
				await new Promise(setImmediate)
				assert.ok(result, "enrichment must return within its one-second budget")
				await pending
				assert.equal(result.cast?.[0].name, "Actor")
				assert.ok(result.scores)
				assert.equal("title_analysis" in result, part !== "analysis")
				assert.equal(
					"creators" in result,
					part !== "creators" && part !== "people",
				)
				assert.equal("seasons" in result, part !== "grid")
				assert.equal("episodes" in result, part !== "grid")
				if (!fails && part !== "grid") {
					assert.equal(
						statements.find(({ sql }) =>
							part === "analysis"
								? sql.includes("essence_text")
								: part === "people"
								? /FROM person WHERE/.test(sql)
								: sql.includes("person_worked_on"),
						)?.signal?.aborted,
						true,
					)
				}
			} finally {
				stalled = ""
				rejectPart = false
			}
		})
	}
}


test("no creator credits skips the person lookup and returns an empty creators list", async () => {
	statements.length = 0
	emptyCredits = true
	try {
		const result = await richerTitleDetails(media, origin, { include: ["cast"] })
		assert.deepEqual(result.creators, [])
		assert.equal(statements.length, 1)
		assert.match(statements[0].sql, /FROM person_worked_on/)
	} finally {
		emptyCredits = false
	}
})

test("empty include skips enrichment; movies never look up show creators", async () => {
	statements.length = 0
	const compact = await richerTitleDetails(media, origin, { include: [] })
	assert.equal(statements.length, 0)
	assert.deepEqual(Object.keys(compact), ["trailer_url"])
	const movie = { ...media, mediaType: "movie" } as unknown as MovieResult
	const result = await richerTitleDetails(movie, origin, {})
	assert.equal(statements.length, 1)
	assert.match(statements[0].sql, /FROM movie WHERE tmdb_id = \?/)
	assert.equal(result.title_analysis?.summary, "An analysis")
	assert.equal("creators" in result, false)
})

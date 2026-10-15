import assert from "node:assert/strict"
import "node-crate"
import { after, test } from "node:test"
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici"
import "../title-filter/test-alias.ts"
const { exactCatalogTitles } = await import("./catalog.server.ts")
const previous = getGlobalDispatcher()
const agent = new MockAgent()
agent.disableNetConnect()
setGlobalDispatcher(agent)
process.env.CRATE_HOSTS = "exact-title-fixture.invalid"
process.env.CRATE_PORT = "4200"
after(async () => {
	setGlobalDispatcher(previous)
	await agent.close()
})
const cols = [
	"tmdb_id",
	"title",
	"original_title",
	"release_year",
	"poster_path",
	"popularity",
	"adult",
]

test("indexed exact fallback retains original names and remakes without a vote floor", async () => {
	const statements: string[] = []
	for (const type of ["movie", "show"])
		agent
			.get("http://exact-title-fixture.invalid:4200")
			.intercept({
				path: "/_sql",
				method: "POST",
				body: (body) => {
					const query = JSON.parse(String(body))
					if (!query.stmt.includes(`FROM ${type} `)) return false
					statements.push(query.stmt)
					assert.deepEqual(query.args, ["Özgün başlık"])
					return true
				},
			})
			.reply(200, {
				cols,
				rows:
					type === "movie"
						? [
								[1, "An obscure movie", "Özgün başlık", 1980, null, 0, false],
								[2, "Özgün başlık", null, 2020, null, 0, false],
								[3, "Özgün başlık sequel", null, 2021, null, 0, false],
								[4, "Özgün başlık", null, 2022, null, 0, true],
							]
						: [[5, "ÖZGÜN başlık", null, 2023, null, 0, null]],
			})
	const result = await exactCatalogTitles("Özgün başlık")
	assert.deepEqual(
		result.map((row) => [row.type, row.id]),
		[
			["movie", 1],
			["movie", 2],
			["tv", 5],
		],
	)
	assert.equal(result[0].original, "Özgün başlık")
	assert.equal(new Set(statements).size, 2)
	for (const stmt of statements) {
		assert.match(stmt, /MATCH\(\(title,original_title\), \?\)/)
		assert.doesNotMatch(stmt, /voting_count|lower\(/)
	}
})

test("slow catalog fallback returns empty within its budget", async () => {
	for (let i = 0; i < 2; i++)
		agent
			.get("http://exact-title-fixture.invalid:4200")
			.intercept({ path: "/_sql", method: "POST" })
			.reply(200, { cols, rows: [] })
			.delay(600)
	const started = performance.now()
	assert.deepEqual(await exactCatalogTitles("slow fixture"), [])
	assert.ok(performance.now() - started < 350)
})

test("primary winner cancellation aborts catalog fetch and pending body", async () => {
	let aborts = 0
	let requests = 0
	setGlobalDispatcher({
		dispatch(_options, handler) {
			requests++
			handler.onConnect?.((error) => {
				aborts++
				handler.onError?.(error ?? new Error("Catalog aborted"))
			})
			if (requests === 2) {
				handler.onHeaders?.(200, [], () => {}, "OK")
				handler.onData?.(Buffer.from('{"rows":['))
			}
			return true
		},
	} as Parameters<typeof setGlobalDispatcher>[0])
	const controller = new AbortController()
	try {
		const pending = exactCatalogTitles("cancelled catalog", controller.signal)
		await new Promise((resolve) => setImmediate(resolve))
		assert.equal(requests, 2)
		controller.abort()
		assert.deepEqual(await pending, [])
		assert.equal(aborts, 2)
	} finally {
		setGlobalDispatcher(agent)
	}
})

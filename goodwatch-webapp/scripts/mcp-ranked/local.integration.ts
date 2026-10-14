import assert from "node:assert/strict"
import Redis from "ioredis"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"

process.env.CRATE_HOSTS = "127.0.0.1"
process.env.CRATE_PORT = "15767"
process.env.CRATE_USER = "crate"
process.env.CRATE_PASS = ""
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = "redis://127.0.0.1:16767"
process.env.TITLE_CARDS_REDIS_URL = ""
process.env.TITLE_SNAPSHOT_REDIS_URL = "redis://127.0.0.1:16767"
process.env.SEARCH_STORAGE_KEY = "ab".repeat(32)
process.env.WEBAPP_ROLE = "search"
const redis = new Redis("redis://127.0.0.1:16767", { maxRetriesPerRequest: 1 })
const resource = "http://localhost:3336/mcp"
const member = `mcp-ranked-${Date.now()}`
let calls = 0
const run = async () => {
	calls++
	const { searchQuery } = await import(
		"../../app/server/combined-search/catalog.server"
	)
	return {
		titles: await searchQuery<{
			media_type: "movie"
			tmdb_id: number
			title: string
			release_year: number
		}>(
			"SELECT 'movie' AS media_type, tmdb_id, title, release_year FROM movie WHERE tmdb_id BETWEEN 2000 AND 2024 ORDER BY tmdb_id DESC",
		),
		ranked: true,
		messages: [],
		chargedNano: 84,
	}
}
const { createRankedSearch } = await import(
	"../../app/server/mcp/ranked.server"
)
const rankedSearch = createRankedSearch({ redis: () => redis, run })
let id = 0
async function call(
	args: Record<string, unknown>,
	who = member,
	search = rankedSearch,
) {
	const handle = createReadMcpHandler({
		resource,
		rankedSearch: search,
		limiter: {
			async take() {
				return { allowed: true as const, store: "valkey" as const }
			},
		},
		authorization: {
			async verifyAccessToken(token) {
				return {
					token,
					clientId: "local-ranked-probe",
					scopes: ["mcp:read"],
					expiresAt: Date.now() / 1000 + 60,
					resource: new URL(resource),
					extra: { userId: who },
				}
			},
		},
	})
	const response = await handle(
		new Request(resource, {
			method: "POST",
			headers: {
				Authorization: "Bearer local",
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: ++id,
				method: "tools/call",
				params: { name: "search_titles", arguments: args },
			}),
		}),
	)
	assert.equal(response.status, 200, await response.clone().text())
	const text = await response.text()
	const message = JSON.parse(
		text.startsWith("event:") ? text.split("data: ")[1].split("\n")[0] : text,
	)
	assert.ok(!message.error, JSON.stringify(message))
	return message.result
}
try {
	const first = await call({ query: "  QUIET   Movies  ", ranked: true })
	assert.equal(first.isError, false, JSON.stringify(first))
	assert.equal(first.structuredContent.quota.used, 1)
	assert.equal(first.structuredContent.items.length, 20)
	assert.equal(first.structuredContent.items[0].id, "movie:2024")
	assert.equal(first.structuredContent.charged_nano, 84)
	const cached = await call({ query: "quiet movies", ranked: true, limit: 3 })
	assert.equal(cached.structuredContent.cached, true)
	assert.equal(cached.structuredContent.quota.used, 1)
	assert.equal(cached.structuredContent.charged_nano, 0)
	const page = await call({
		ranked: true,
		cursor: first.structuredContent.next_cursor,
	})
	assert.equal(page.structuredContent.items.length, 5)
	assert.equal(page.structuredContent.items[0].id, "movie:2004")
	assert.equal(page.structuredContent.charged_nano, 0)
	assert.equal(calls, 1)
	console.log(
		"PASS: explicit ranked search reserves one member query; normalized cache hits and paging are free",
	)
	const { searchAdmission } = await import(
		"../../app/server/search-runtime/admission.server"
	)
	const background = Promise.withResolvers<void>()
	const held = createRankedSearch({
		redis: () => redis,
		run: async () => {
			searchAdmission.hold(background.promise)
			return run()
		},
	})
	try {
		assert.equal(
			(
				await call(
					{ query: "background first", ranked: true },
					`${member}-background`,
					held,
				)
			).isError,
			false,
		)
		const blocked = await call(
			{ query: "background second", ranked: true },
			`${member}-background`,
			held,
		)
		assert.equal(
			blocked.structuredContent.status,
			"member_busy",
			JSON.stringify(blocked),
		)
	} finally {
		background.resolve()
		await new Promise((resolve) => setTimeout(resolve, 30))
	}
	assert.equal(
		(
			await call(
				{ query: "background second", ranked: true },
				`${member}-background`,
				held,
			)
		).isError,
		false,
	)
	console.log(
		"PASS: detached native search work retains the member's in-flight place after its response",
	)
} finally {
	await redis.quit()
}

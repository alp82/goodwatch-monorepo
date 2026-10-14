import assert from "node:assert/strict"
import { createServer } from "node:http"
import Redis from "ioredis"
import { MockAgent, setGlobalDispatcher } from "undici"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"

// Provider requests are loopback-rewritten by mcp-ranked-vite.config.mjs; all other outbound traffic is blocked.
const network = new MockAgent()
network.disableNetConnect()
network.enableNetConnect(/^(127\.0\.0\.1|localhost)(:|$)/)
setGlobalDispatcher(network)
const fetchLocal = globalThis.fetch
globalThis.fetch = ((input, init) => {
	const url = new URL(
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: input.url,
	)
	if (!["127.0.0.1", "localhost"].includes(url.hostname))
		throw new Error(`Blocked nonlocal test backend: ${url.hostname}`)
	return fetchLocal(input, init)
}) as typeof fetch
Object.assign(process.env, {
	CRATE_HOSTS: "127.0.0.1",
	CRATE_PORT: "15767",
	CRATE_USER: "crate",
	CRATE_PASS: "",
	REDIS_HOST: "",
	TASTE_REDIS_URL: "redis://127.0.0.1:16767",
	TITLE_SNAPSHOT_REDIS_URL: "redis://127.0.0.1:16767",
	TITLE_CARDS_REDIS_URL: "",
	QDRANT_URL: "http://127.0.0.1:15769",
	QDRANT_API_KEY: "",
	WEBAPP_ROLE: "search",
	SEARCH_STORAGE_KEY: "ab".repeat(32),
	TYPESAFE_API_KEY: "loopback-fixture",
	TMDB_API_KEY: "loopback-fixture",
	SEARCH_TRANSLATION_ENABLED: "false",
	SEARCH_MODEL_DIR: "/tmp/gw-mcp-569-no-models",
})
const redis = new Redis("redis://127.0.0.1:16767", { maxRetriesPerRequest: 1 })
const { cacheScripts, setRedisClusterForTest } = await import(
	"../../app/utils/cache"
)
for (const [name, script] of Object.entries(cacheScripts))
	redis.defineCommand(name, script)
setRedisClusterForTest(redis)
let paidCalls = 0
const fixture = createServer(async (request, response) => {
	response.setHeader("Content-Type", "application/json")
	if (request.url === "/health") return response.end("{}")
	if (request.url?.startsWith("/tmdb/search/multi"))
		return response.end(
			JSON.stringify({
				total_pages: 1,
				results: Array.from({ length: 25 }, (_, i) => ({
					id: 2000 + i,
					title: `Local Movie ${String(i).padStart(2, "0")}`,
					original_title: `Local Movie ${String(i).padStart(2, "0")}`,
					release_date: "2020-01-01",
					media_type: "movie",
					poster_path: "/local.jpg",
					popularity: 25 - i,
					adult: false,
				})),
			}),
		)
	if (request.url === "/v1/systemone") {
		paidCalls++
		let raw = ""
		for await (const chunk of request) raw += chunk
		const input = JSON.parse(raw)
		const answers = Object.fromEntries(
			Object.entries(input.questions).map(([name, q]) => {
				const question = q as {
					type: string
					criteria?: Record<string, unknown>
				}
				if (question.type === "noul") return [name, { type: "noul", noul: 0 }]
				const labels = Object.keys(question.criteria ?? {})
				return [
					name,
					{
						type: "choice",
						choice: labels[0],
						confidence: 1,
						probabilities: Object.fromEntries(
							labels.map((label, index) => [label, index === 0 ? 1 : 0]),
						),
					},
				]
			}),
		)
		return response.end(
			JSON.stringify({
				model: "jev-1.13.0",
				usage: { input_tokens: 100, output_tokens: 0 },
				answers,
			}),
		)
	}
	response.statusCode = 404
	response.end(
		JSON.stringify({
			error: "Unexpected local fixture request",
			path: request.url,
		}),
	)
})
await new Promise<void>((resolve) =>
	fixture.listen(15769, "127.0.0.1", resolve),
)
const member = `mcp-native-ranked-${Date.now()}`
const resource = "http://localhost:3336/mcp"
const handle = createReadMcpHandler({
	resource,
	limiter: {
		async take() {
			return { allowed: true as const, store: "valkey" as const }
		},
	},
	authorization: {
		async verifyAccessToken(token) {
			return {
				token,
				clientId: "local-native-search",
				scopes: ["mcp:read"],
				resource: new URL(resource),
				expiresAt: Date.now() / 1000 + 60,
				extra: { userId: member },
			}
		},
	},
})
let id = 0
async function call(query: string) {
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
				params: { name: "search_titles", arguments: { query, ranked: true } },
			}),
		}),
	)
	assert.equal(response.status, 200)
	const text = await response.text()
	const result = JSON.parse(
		text.startsWith("event:") ? text.split("data: ")[1].split("\n")[0] : text,
	).result
	assert.equal(result.isError, false, JSON.stringify(result))
	return result.structuredContent
}
try {
	const query = `Local Movie ${Date.now()}`
	const found = await call(query)
	assert.equal(found.quota.used, 1)
	assert.equal(found.charged_nano, 8400)
	assert.equal(paidCalls, 2)
	assert.equal(found.items.length, 20)
	assert.match(found.items[0].id, /^movie:20[0-9]{2}$/)
	assert.match(found.items[0].url, /\/movie\/20[0-9]{2}/)
	assert.equal(found.ranked, false)
	assert.ok(found.messages.includes("Showing basic search results."))
	const cached = await call(`  ${query.toUpperCase().replaceAll(" ", "   ")}  `)
	assert.equal(cached.cached, true)
	assert.equal(cached.charged_nano, 0)
	assert.equal(paidCalls, 2)
	console.log(
		"PASS: real combinedSearch uses local paid SDK fixtures, native price accounting and cached MCP results",
	)
	const { getSearchStore } = await import(
		"../../app/server/search-runtime/runtime.server"
	)
	await getSearchStore().haltPaidAdmissions()
	const denied = await call(`quiet local friends ${member}`)
	assert.equal(denied.quota.used, 2)
	assert.equal(denied.charged_nano, 0)
	assert.equal(paidCalls, 2)
	assert.equal(denied.ranked, false)
	assert.ok(denied.messages.includes("Showing basic search results."))
	console.log(
		"PASS: shared Crate budget halt prevents provider calls; native basic fallback is reported honestly",
	)
} finally {
	setRedisClusterForTest(null)
	await redis.quit()
	const { stopSearchIndex } = await import(
		"../../app/server/search-ranking/search-index.server"
	)
	const { stopQueryEncoder } = await import(
		"../../app/server/search-ranking/query-encoder.server"
	)
	const { stopTitleSnapshot } = await import(
		"../../app/server/title-snapshot/index.server"
	)
	const { stopTasteStore } = await import("../../app/server/taste/index.server")
	const { stopTastePortraitCache } = await import(
		"../../app/server/taste-portrait/cache.server"
	)
	stopSearchIndex()
	await stopQueryEncoder()
	stopTitleSnapshot()
	stopTasteStore()
	stopTastePortraitCache()
	fixture.closeAllConnections()
	await new Promise<void>((resolve) => fixture.close(() => resolve()))
	await network.close()
}

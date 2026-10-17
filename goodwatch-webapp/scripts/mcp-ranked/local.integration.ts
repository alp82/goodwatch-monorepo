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
function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>((settle) => {
		resolve = settle
	})
	return { promise, resolve }
}
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
	clientId = "local-ranked-probe",
	name = "search_titles",
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
					clientId,
					scopes:
						name === "search_titles" ? ["mcp:read"] : ["mcp:read", "mcp:write"],
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
				params: { name, arguments: args },
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
	assert.equal(new URL(first.structuredContent.page_url).searchParams.get("q"), "QUIET   Movies")
	assert.match(first.structuredContent.items[0].url, /movie\/2024-/)
	assert.equal(first.structuredContent.items[0].link, `[Local Movie 24 (2020)](${first.structuredContent.items[0].url})`)
	const snapshotKeys = await redis.keys("mcp-ranked:*:page:*")
	for (const key of snapshotKeys) {
		const value = await redis.get(key)
		assert.ok(!value?.includes("QUIET   Movies"), "Queries must stay encrypted in cached snapshots")
	}
	const cached = await call({ query: "quiet movies", ranked: true, limit: 3 })
	assert.equal(cached.structuredContent.cached, true)
	assert.equal(cached.structuredContent.quota.used, 1)
	assert.equal(cached.structuredContent.charged_nano, 0)
	const page = await call({
		ranked: true,
		cursor: first.structuredContent.next_cursor,
	})
	assert.equal(page.structuredContent.page_url, first.structuredContent.page_url)
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
	const background = deferred()
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
	for (let i = 1; i < 20; i++) {
		const found = await call(
			{ query: `daily query ${i}`, ranked: true },
			member,
			rankedSearch,
			i % 2 ? "second-client" : "first-client",
		)
		assert.equal(found.structuredContent.quota.used, i + 1)
	}
	const beforeDenied = calls
	const denied = await call({ query: "over quota", ranked: true })
	assert.equal(denied.structuredContent.status, "quota_exceeded")
	assert.equal(denied.structuredContent.quota.remaining, 0)
	assert.equal(calls, beforeDenied)
	assert.equal(
		(await call({ query: "quiet movies", ranked: true })).structuredContent
			.cached,
		true,
	)
	assert.equal(
		(await call({ ranked: true, cursor: first.structuredContent.next_cursor }))
			.isError,
		false,
	)
	assert.equal(
		(await call({ query: "new peer query", ranked: true }, `${member}-peer`))
			.structuredContent.quota.used,
		1,
	)
	assert.equal(
		(await call({ query: "Local Movie" })).structuredContent.ranked,
		false,
	)
	const beforeWrite = calls
	const ambiguousWrite = await call(
		{
			title_name: "Harbor",
			want_to_see: true,
			action_id: `${member}-ambiguous`,
		},
		member,
		rankedSearch,
		"writer",
		"set_want_to_see",
	)
	assert.equal(ambiguousWrite.structuredContent.outcome, "unresolved")
	assert.equal(
		(
			await call(
				{
					title_name: "Local Movie 01",
					want_to_see: true,
					action_id: `${member}-wishlist`,
				},
				member,
				rankedSearch,
				"writer",
				"set_want_to_see",
			)
		).isError,
		false,
	)
	assert.equal(calls, beforeWrite)
	console.log(
		"PASS: 20/day quota is shared across OAuth clients; peers, name lookup and write resolution are independent",
	)
	const boundary = (Math.floor(Date.now() / 86400000) + 1) * 86400000
	let at = boundary - 1000
	const rollover = createRankedSearch({
		redis: () => redis,
		run,
		clock: () => at,
	})
	for (let i = 0; i < 20; i++) {
		const result = await call(
			{ query: `rollover ${i}`, ranked: true },
			`${member}-utc`,
			rollover,
		)
		assert.equal(result.structuredContent.quota.used, i + 1)
		assert.equal(
			result.structuredContent.quota.resets_at,
			new Date(boundary).toISOString(),
		)
	}
	at = boundary
	assert.equal(
		(
			await call(
				{ query: "rollover 19", ranked: true },
				`${member}-utc`,
				rollover,
			)
		).structuredContent.quota.used,
		0,
	)
	assert.equal(
		(
			await call(
				{ query: "new UTC day", ranked: true },
				`${member}-utc`,
				rollover,
			)
		).structuredContent.quota.used,
		1,
	)
	console.log(
		"PASS: quota resets at UTC midnight; surviving cache hits remain free on the new day",
	)
	const slots: (() => void)[] = []
	for (;;) {
		const release = searchAdmission.enter()
		if (!release) break
		slots.push(release)
	}
	try {
		const before = calls
		const busy = await call(
			{ query: "global admission denied", ranked: true },
			`${member}-admission`,
		)
		assert.equal(busy.structuredContent.status, "search_busy")
		assert.equal(busy.structuredContent.quota.used, 0)
		assert.equal(calls, before)
		assert.equal(
			(
				await call({
					ranked: true,
					cursor: first.structuredContent.next_cursor,
				})
			).isError,
			false,
		)
	} finally {
		slots.forEach((release) => release())
	}
	assert.equal(
		(
			await call(
				{ query: "global admission denied", ranked: true },
				`${member}-admission`,
			)
		).structuredContent.quota.used,
		1,
	)
	const started = deferred()
	const settle = deferred()
	const inFlight = createRankedSearch({
		redis: () => redis,
		run: async () => {
			started.resolve()
			await settle.promise
			return run()
		},
	})
	const pendingCall = call(
		{ query: "held foreground", ranked: true },
		`${member}-flight`,
		inFlight,
	)
	await started.promise
	try {
		const busy = await call(
			{ query: "different foreground", ranked: true },
			`${member}-flight`,
			inFlight,
			"other-client",
		)
		assert.equal(busy.structuredContent.status, "member_busy")
		assert.equal(busy.structuredContent.quota.used, 1)
		assert.equal(
			(
				await call(
					{ query: "independent foreground", ranked: true },
					`${member}-other`,
				)
			).isError,
			false,
		)
	} finally {
		settle.resolve()
	}
	assert.equal((await pendingCall).isError, false)
	console.log(
		"PASS: member and shared search-role admission reject before executing; rejection does not spend quota",
	)
	assert.equal(
		(
			await call(
				{ ranked: true, cursor: first.structuredContent.next_cursor },
				`${member}-peer`,
			)
		).structuredContent.status,
		"cursor_expired",
	)
	assert.equal(
		(
			await call({
				query: "different query",
				ranked: true,
				cursor: first.structuredContent.next_cursor,
			})
		).structuredContent.status,
		"invalid_cursor",
	)
	const unavailable = createRankedSearch({ redis: () => null, run })
	assert.equal(
		(await call({ query: "no coordinator", ranked: true }, member, unavailable))
			.structuredContent.status,
		"ranked_unavailable",
	)
	process.env.REC_MCP_RANKED_SEARCH = "off"
	try {
		assert.equal(
			(await call({ query: "flagged", ranked: true })).structuredContent.status,
			"ranked_disabled",
		)
	} finally {
		Reflect.deleteProperty(process.env, "REC_MCP_RANKED_SEARCH")
	}
	process.env.WEBAPP_ROLE = "page"
	try {
		assert.equal(
			(await call({ query: "wrong role", ranked: true })).structuredContent
				.status,
			"wrong_role",
		)
	} finally {
		process.env.WEBAPP_ROLE = "search"
	}
	const failures = createRankedSearch({
		redis: () => redis,
		run: async () => {
			throw new Error("local simulated provider failure")
		},
	})
	const failed = await call(
		{ query: "failed attempt", ranked: true },
		`${member}-failure`,
		failures,
	)
	assert.equal(failed.structuredContent.quota.used, 1)
	assert.equal(failed.structuredContent.status, "search_failed")
	assert.equal(
		(await call({ query: "next attempt", ranked: true }, `${member}-failure`))
			.structuredContent.quota.used,
		2,
	)
	const beforeCancelled = calls
	const cancelled = await rankedSearch(
		`${member}-cancel`,
		resource,
		{ query: "already cancelled", ranked: true },
		AbortSignal.abort(),
	)
	assert.equal(cancelled.status, "search_cancelled")
	assert.equal(calls, beforeCancelled)
	const { renderMetrics } = await import(
		"../../app/server/metrics/registry.server"
	)
	const metrics = renderMetrics()
	assert.match(
		metrics,
		/goodwatch_mcp_ranked_requests_total\{outcome="quota_exceeded"\} 1\n/,
	)
	assert.match(metrics, /goodwatch_mcp_ranked_cost_nano_total [1-9][0-9]*\n/)
	assert.match(metrics, /goodwatch_mcp_ranked_cost_unknown_total 1\n/)
	assert.ok(!metrics.includes(member) && !metrics.includes("quiet movies"))
	console.log(
		"PASS: cursors are member-bound; flags, role refusal, failed attempts and bounded usage/cost metrics",
	)
	if (process.argv.includes("--ttl")) {
		const ttlMember = `${member}-ttl`
		const ttlFirst = await call({ query: "TTL query", ranked: true }, ttlMember)
		const longWork = deferred()
		const longRunner = createRankedSearch({
			redis: () => redis,
			run: async () => {
				searchAdmission.hold(longWork.promise)
				return run()
			},
		})
		await call(
			{ query: "long background", ranked: true },
			`${member}-long`,
			longRunner,
		)
		try {
			console.log(
				"Waiting on local TTLs: query cache 60 s; background lease renewal past its original 30 s",
			)
			await new Promise((resolve) => setTimeout(resolve, 32000))
			assert.equal(
				(
					await call(
						{ query: "long competitor", ranked: true },
						`${member}-long`,
						longRunner,
					)
				).structuredContent.status,
				"member_busy",
			)
			await new Promise((resolve) => setTimeout(resolve, 29000))
			assert.equal(
				(await call({ query: "ttl query", ranked: true }, ttlMember))
					.structuredContent.quota.used,
				2,
			)
			assert.equal(
				(
					await call(
						{ ranked: true, cursor: ttlFirst.structuredContent.next_cursor },
						ttlMember,
					)
				).structuredContent.quota.used,
				2,
			)
		} finally {
			longWork.resolve()
			await new Promise((resolve) => setTimeout(resolve, 30))
		}
		console.log(
			"PASS: query cache expires at 60 s, old paging stays free, and renewed leases retain long native work",
		)
	}
} finally {
	await redis.quit()
	const { stopTitleSnapshot } = await import(
		"../../app/server/title-snapshot/index.server"
	)
	const { stopTasteStore } = await import("../../app/server/taste/index.server")
	const { stopTastePortraitCache } = await import(
		"../../app/server/taste-portrait/cache.server"
	)
	stopTitleSnapshot()
	stopTasteStore()
	stopTastePortraitCache()
}

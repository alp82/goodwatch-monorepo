import assert from "node:assert/strict"
import Redis from "ioredis"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"
import { titleKey } from "../../app/utils/title-key"
import { fixtureTaste } from "./taste-fixture"

Object.assign(process.env, {
	CRATE_HOSTS: "127.0.0.1",
	CRATE_PORT: "15767",
	CRATE_USER: "goodwatch_search",
	CRATE_PASS: "local-mcp-test-only",
	REDIS_HOST: "",
	TASTE_REDIS_URL: "redis://127.0.0.1:16767",
	TITLE_CARDS_REDIS_URL: "",
	TITLE_SNAPSHOT_REDIS_URL: "redis://127.0.0.1:16767",
	WEBAPP_ROLE: "search",
	SEARCH_STORAGE_KEY: "ab".repeat(32),
})
const redis = new Redis("redis://127.0.0.1:16767")
const { createRankedSearch } = await import(
	"../../app/server/mcp/ranked.server"
)
const rankedSearch = createRankedSearch({
	redis: () => redis,
	run: async () => ({
		titles: Array.from({ length: 25 }, (_, i) => ({
			media_type: "movie" as const,
			tmdb_id: 2000 + i,
			title: `Local Movie ${String(i).padStart(2, "0")}`,
			release_year: 2020,
		})),
		ranked: true,
		messages: [],
		chargedNano: 0,
	}),
})
const resource = "http://localhost:3336/mcp"
let id = 0
async function call(
	name: string,
	args: Record<string, unknown> = {},
	userId = "mcp-taste-A",
) {
	const handle = createReadMcpHandler({
		resource,
		rankedSearch,
		limiter: {
			async take() {
				return { allowed: true as const, store: "memory" as const }
			},
		},
		authorization: {
			async verifyAccessToken(token) {
				return {
					token,
					clientId: "personal-fixture",
					scopes: ["mcp:read", "mcp:write"],
					expiresAt: Date.now() / 1000 + 60,
					resource: new URL(resource),
					extra: { userId },
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
	assert.equal(response.status, 200)
	const text = await response.text()
	const result = JSON.parse(
		text.startsWith("event:") ? text.split("data: ")[1].split("\n")[0] : text,
	).result
	assert.equal(result.isError, false, JSON.stringify(result))
	return result.structuredContent
}
try {
	const library = await call("get_library", { filter: "seen", kind: "movie" })
	assert.equal(library.sort, "match")
	assert.equal(library.total, 25)
	assert.equal(library.items[0].id, "movie:2024")
	for (const item of library.items) {
		const match = fixtureTaste("mcp-taste-A").match([
			titleKey("movie", Number(item.id.split(":")[1])),
		])[0]
		assert.equal(item.match, match)
		assert.equal(item.match_label, `${match}% taste match`)
	}
	const dated = await call("get_library", {
		filter: "want_to_see",
		sort: "added",
	})
	assert.equal(dated.sort, "added")
	assert.equal(dated.items[0].id, "movie:2000")
	const longest = await call("get_library", {
		filter: "seen",
		kind: "movie",
		sort: "runtime",
		limit: 2,
	})
	assert.deepEqual(
		longest.items.map((item: { id: string; runtime_minutes: number }) => [
			item.id,
			item.runtime_minutes,
		]),
		[
			["movie:2001", 310],
			["movie:2002", 240],
		],
	)
	assert.ok(
		!library.items.some((item: { id: string }) => item.id === "movie:2001"),
		"Longest title lies beyond the default first page",
	)
	assert.match(longest.page_note, /default website order/)
	const missing = await call("get_title", { title_id: "movie:2003" })
	assert.equal(missing.title.match, null)
	assert.equal(missing.title.match_label, null)
	const peer = await call(
		"get_library",
		{ filter: "seen", kind: "movie" },
		"mcp-taste-B",
	)
	assert.equal(peer.items[0].id, "movie:2000")
	const failed = await call(
		"get_library",
		{ filter: "seen", kind: "movie", sort: "runtime" },
		"mcp-taste-failure",
	)
	assert.equal(failed.items[0].runtime_minutes, 310)
	assert.equal(failed.items[0].match, null)
	assert.equal(failed.taste.signal, "unavailable")
	console.log(
		"PASS: real GoodWatch taste scores and labels, default full-library match order, explicit sorts, missing fingerprints, peer isolation and unavailable-taste degradation",
	)
	const title = await call("get_title", { title_id: "show:1399" })
	assert.equal(title.title.runtime_minutes, 40)
	assert.equal(title.title.availability.country, "DE")
	assert.equal(title.title.availability.state, "watchable")
	assert.ok(
		title.title.availability.offers.every(
			(offer: { service_id: number }) => offer.service_id === 8,
		),
	)
	assert.ok(
		title.title.availability.offers.every(
			(offer: { url: string }) =>
				offer.url === "https://www.netflix.com/title/DE-show-1399",
		),
	)
	assert.equal(title.title.availability.offers[0].name, "Netflix")
	const pick = await call("get_tonight")
	assert.equal(pick.pick.title.id, "show:1399")
	assert.equal(pick.pick.title.runtime_minutes, 40)
	assert.equal(pick.pick.title.match, title.title.match)
	assert.equal(
		pick.pick.title.availability.offers[0].url,
		title.title.availability.offers[0].url,
	)
	const foreign = await call(
		"get_title",
		{ title_id: "show:1399" },
		"mcp-taste-B",
	)
	assert.equal(foreign.title.availability.country, "US")
	assert.equal(
		foreign.title.availability.offers[0].url,
		"https://www.netflix.com/title/US-show-1399",
	)
	console.log(
		"PASS: Watch next and title availability link only owned services, in Watching from country, using the site deep link",
	)
	const shows = await call("get_my_shows")
	assert.equal(shows.items[0].match, title.title.match)
	assert.equal(shows.items[0].runtime_minutes, 40)
	const progress = await call("get_show_progress", { title_id: "show:1399" })
	assert.equal(progress.title.match, title.title.match)
	for (const args of [
		{ query: "Local Movie" },
		{ query: "local fixture", ranked: true },
	]) {
		const found = await call("search_titles", args)
		assert.equal(found.items.length, 25)
		for (const item of found.items) {
			const match = fixtureTaste("mcp-taste-A").match([
				titleKey("movie", Number(item.id.split(":")[1])),
			])[0]
			assert.equal(item.match, match)
			assert.equal(
				item.match_label,
				match === null ? null : `${match}% taste match`,
			)
			assert.equal(typeof item.runtime_minutes, "number")
		}
	}
	const write = await call("set_want_to_see", {
		title_id: "movie:2000",
		want_to_see: true,
		action_id: "personal-metadata-receipt",
	})
	assert.equal(typeof write.title.match, "number")
	assert.equal(write.title.runtime_minutes, 100)
	const retry = await call("set_want_to_see", {
		title_id: "movie:2000",
		want_to_see: true,
		action_id: "personal-metadata-receipt",
	})
	assert.equal(retry.replayed, true)
	assert.equal(retry.title.match, write.title.match)
	const { searchQuery } = await import(
		"../../app/server/combined-search/catalog.server"
	)
	const receipts = await searchQuery<{ result: string }>(
		"SELECT result FROM user_mcp_action WHERE user_id=? AND action_id=?",
		["mcp-taste-A", "personal-metadata-receipt"],
	)
	assert.equal(
		"match" in JSON.parse(receipts[0].result).title,
		false,
		"Personal scores stay out of durable receipts",
	)
	for (const key of await redis.keys("mcp-ranked:*:page:*")) {
		const raw = await redis.get(key)
		assert.ok(
			!raw?.includes('"match_label"'),
			"Personal scores stay out of cached search snapshots",
		)
	}
	const failedWrite = await call(
		"set_want_to_see",
		{
			title_id: "movie:2000",
			want_to_see: false,
			action_id: "metadata-failure-receipt",
		},
		"mcp-taste-failure",
	)
	assert.ok(["applied", "unchanged"].includes(failedWrite.outcome))
	assert.equal(failedWrite.title.match, null)
	console.log(
		"PASS: all title-returning read tools and write receipts carry runtime/taste; personalized presentation never enters public caches or durable receipts",
	)
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

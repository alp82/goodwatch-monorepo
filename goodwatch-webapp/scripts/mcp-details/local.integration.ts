import assert from "node:assert/strict"
import Redis from "ioredis"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"
import { posterView } from "../../app/server/mcp/poster-grid/cards"
import { fixtureTaste } from "../mcp-personal/taste-fixture"
import { titleKey } from "../../app/utils/title-key"
Object.assign(process.env, {
	CRATE_HOSTS: "127.0.0.1",
	CRATE_PORT: "15967",
	CRATE_USER: "goodwatch_search",
	CRATE_PASS: "local-mcp-test-only",
	REDIS_HOST: "",
	TASTE_REDIS_URL: "redis://127.0.0.1:16967",
	TITLE_CARDS_REDIS_URL: "",
	TITLE_SNAPSHOT_REDIS_URL: "redis://127.0.0.1:16967",
	QDRANT_URL: "http://127.0.0.1:15971",
	QDRANT_API_KEY: "",
	WEBAPP_ROLE: "search",
})
const redis = new Redis("redis://127.0.0.1:16967")
const { cacheScripts, setRedisClusterForTest } = await import(
	"../../app/utils/cache"
)
for (const [name, script] of Object.entries(cacheScripts))
	redis.defineCommand(name, script)
setRedisClusterForTest(redis)
const resource = "http://localhost:3336/mcp"
let id = 0
async function rpc(
	method: string,
	params: Record<string, unknown>,
	member = "mcp-member-A",
) {
	const handle = createReadMcpHandler({
		resource,
		limiter: {
			async take() {
				return { allowed: true as const, store: "memory" as const }
			},
		},
		authorization: {
			async verifyAccessToken(token) {
				return {
					token,
					clientId: "local-details",
					scopes: ["mcp:read"],
					expiresAt: Date.now() / 1000 + 60,
					resource: new URL(resource),
					extra: { userId: member },
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
			body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
		}),
	)
	assert.equal(response.status, 200)
	const raw = await response.text()
	return (
		raw.startsWith("event:")
			? JSON.parse(raw.split("data: ")[1].split("\n")[0])
			: JSON.parse(raw)
	).result
}
async function call(
	name: string,
	args: Record<string, unknown>,
	member?: string,
) {
	const result = await rpc("tools/call", { name, arguments: args }, member)
	assert.ok(!result.isError, JSON.stringify(result))
	assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
	return result.structuredContent
}
try {
	const tools = (await rpc("tools/list", {})).tools
	const similar = tools.find(
		(t: { name: string }) => t.name === "get_similar_titles",
	)
	assert.equal(similar.annotations.readOnlyHint, true)
	assert.equal(similar._meta.ui.resourceUri, "ui://goodwatch/posters-v2.html")
	const detail = await call("get_title", { title_id: "movie:2000" })
	assert.equal(detail.title.cast.length, 5)
	for (const person of [...detail.title.cast, ...detail.title.directors])
		assert.equal(person.link, `[${person.name}](${person.url})`)
	assert.equal(detail.title.cast[0].name, "Local Person 1")
	assert.equal(
		detail.title.directors[0].url,
		"http://localhost:3336/person/8001-local-person-1",
	)
	assert.equal(detail.title.scores.imdb.score, 8.6)
	assert.equal(detail.title.scores.metacritic_audience.out_of, 10)
	assert.equal(detail.title.scores.rotten_tomatoes_critics.out_of, 100)
	assert.equal(
		detail.title.trailer_url,
		"https://www.youtube.com/watch?v=abcdefghijk",
	)
	assert.equal(
		detail.title.title_analysis.summary,
		"A hopeful local mystery about friends solving a crime.",
	)
	assert.ok(detail.title.title_analysis.moods.length > 0)
	assert.ok(detail.title.title_analysis.themes.includes("Crime"))
	assert.ok(detail.title.title_analysis.tropes.includes("Found Family"))
	assert.ok(!JSON.stringify(detail).includes('"dna'))
	assert.ok(detail.title.poster_url)
	assert.ok(!detail.title.seasons && !detail.title.episodes)
	const minimal = await call("get_title", {
		title_id: "movie:2000",
		include: [],
	})
	for (const field of [
		"cast",
		"directors",
		"scores",
		"title_analysis",
		"seasons",
		"episodes",
	])
		assert.ok(!(field in minimal.title), field)
	for (const include of ["cast", "scores", "analysis"]) {
		const one = await call("get_title", {
			title_id: "movie:2000",
			include: [include],
		})
		assert.ok(
			(include === "analysis" ? "title_analysis" : include) in one.title,
		)
		assert.ok(!((include === "scores" ? "cast" : "scores") in one.title))
	}
	const show = await call("get_title", {
		title_name: "Local Orbit",
		year: 2020,
		include: ["cast", "seasons", "episodes"],
		episode_limit: 2,
	})
	assert.equal(show.title.creators[0].name, "Local Person 1")
	for (const person of show.title.creators)
		assert.equal(person.link, `[${person.name}](${person.url})`)
	assert.equal(show.title.seasons.length, 2)
	assert.equal(show.title.seasons[0].scores.imdb.score, 8.4)
	assert.equal(show.title.seasons[0].scores.tomatometer.score, 94)
	assert.equal(show.title.seasons[0].scores.metascore.score, 85)
	assert.equal(show.title.seasons[1].scores, null)
	assert.equal(show.title.episodes.items.length, 2)
	assert.equal(show.title.episodes.items[0].imdb.score, 8.1)
	const page = await call("get_title", {
		title_id: "show:1399",
		include: ["episodes"],
		episode_cursor: show.title.episodes.next_cursor,
		episode_limit: 2,
		season_number: 1,
	})
	assert.equal(page.title.episodes.items[0].episode_number, 3)
	assert.ok(!page.title.seasons)
	const end = await call("get_title", {
		title_id: "show:1399",
		include: ["episodes"],
		episode_cursor: page.title.episodes.next_cursor,
		episode_limit: 2,
		season_number: 1,
	})
	assert.equal(end.title.episodes.items[0].episode_number, 5)
	assert.equal(end.title.episodes.next_cursor, null)
	const empty = await call("get_title", {
		title_id: "show:1399",
		include: ["episodes"],
		season_number: 2,
	})
	assert.equal(empty.title.episodes.total, 0)
	const all = await call("get_similar_titles", {
		title_id: "movie:2000",
		for_you: false,
		limit: 2,
	})
	assert.equal(all.items.length, 2)
	assert.equal(all.items[0].id, "movie:2001")
	assert.ok(!all.items.some((t: { id: string }) => t.id === "movie:2002"))
	assert.equal(all.items[0].match, null)
	assert.ok(all.items[0].poster_url)
	assert.match(all.page_url, /#related$/)
	const next = await call("get_similar_titles", {
		title_id: "movie:2000",
		for_you: false,
		limit: 2,
		cursor: all.next_cursor,
	})
	assert.ok(
		!next.items.some((t: { id: string }) =>
			all.items.some((first: { id: string }) => first.id === t.id),
		),
	)
	const seen = await call("get_similar_titles", {
		title_id: "movie:2001",
		for_you: false,
	})
	assert.ok(seen.items.some((t: { id: string }) => t.id === "movie:2000"))
	const unseen = await call("get_similar_titles", {
		title_id: "movie:2001",
		exclude_seen: true,
		for_you: false,
	})
	for (const forbidden of [
		"movie:2000",
		"movie:2002",
		"movie:2003",
		"show:1399",
		"show:1400",
	])
		assert.ok(
			!unseen.items.some((t: { id: string }) => t.id === forbidden),
			forbidden,
		)
	const shows = await call("get_similar_titles", {
		title_id: "movie:2000",
		kind: "show",
		for_you: false,
	})
	assert.equal(shows.items.length, 2)
	assert.ok(shows.items.every((t: { id: string }) => t.id.startsWith("show:")))
	const peer = await call(
		"get_similar_titles",
		{ title_id: "movie:2000", for_you: false },
		"mcp-member-B",
	)
	assert.ok(peer.items.some((t: { id: string }) => t.id === "movie:2002"))
	const personal = await call(
		"get_similar_titles",
		{ title_id: "movie:2000" },
		"mcp-taste-A",
	)
	assert.equal(personal.for_you_applied, true)
	for (const item of personal.items)
		assert.equal(
			item.match,
			fixtureTaste("mcp-taste-A").match([
				titleKey(
					item.id.startsWith("show:") ? "show" : "movie",
					Number(item.id.split(":")[1]),
				),
			])[0],
		)
	const view = posterView(
		JSON.parse(
			JSON.stringify(personal)
				.split("http://localhost:3336")
				.join("https://goodwatch.app"),
		),
		"https://goodwatch.app",
	)
	assert.ok(view.cards.length > 0)
	const noFp = await call("get_similar_titles", { title_id: "movie:3000" })
	assert.equal(noFp.items.length, 0)
	assert.match(noFp.message, /No title analysis/)
	for (const [name, args] of [
		[
			"get_title",
			{ title_id: "show:1399", include: ["episodes"], episode_limit: 51 },
		],
		["get_title", { title_id: "show:1399", season_number: 1 }],
		["get_similar_titles", { title_id: "movie:2000", kind: "tv" }],
	] as const) {
		const bad = await rpc("tools/call", { name, arguments: args })
		assert.ok(bad.isError)
	}
	process.env.REC_MCP_SIMILAR_TITLES = "off"
	assert.ok(
		!(await rpc("tools/list", {})).tools.some(
			(t: { name: string }) => t.name === "get_similar_titles",
		),
	)
	delete process.env.REC_MCP_SIMILAR_TITLES
	console.log(
		"PASS: rich details include defaults/selection, linked cast/creators, score scales, analysis/trailer, real season scores and paged episodes",
	)
	console.log(
		"PASS: real Qdrant neighbors through scoped SDK calls, For you, taste match, canonical links/posters, seen/hidden/type filters, paging, missing fingerprint, member isolation and policy",
	)
} finally {
	await redis.quit()
	const { stopTitleSnapshot } = await import(
		"../../app/server/title-snapshot/index.server"
	)
	stopTitleSnapshot()
	const { stopTasteStore } = await import("../../app/server/taste/index.server")
	stopTasteStore()
	const { stopTastePortraitCache } = await import(
		"../../app/server/taste-portrait/cache.server"
	)
	stopTastePortraitCache()
	setRedisClusterForTest(null)
}
// The Qdrant gRPC SDK exposes no close API and keeps idle HTTP/2 sessions for 15 minutes.
// A thrown assertion skips this exit; successful probes have completed all assertions and store cleanup above.
process.exit(0)

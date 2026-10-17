import assert from "node:assert/strict"
import Redis from "ioredis"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"

// This probe never loads .env. Force every data dependency to dedicated loopback services.
process.env.CRATE_HOSTS = "127.0.0.1"
process.env.CRATE_PORT = "15767"
process.env.CRATE_USER = "crate"
process.env.CRATE_PASS = ""
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = "redis://127.0.0.1:16767"
process.env.TITLE_CARDS_REDIS_URL = ""
process.env.TITLE_SNAPSHOT_REDIS_URL = "redis://127.0.0.1:16767"
const { createRateLimiter } = await import("../../app/server/rate-limit.server")
const resource = "http://localhost:3336/mcp"
const valkey = new Redis("redis://127.0.0.1:16767", { maxRetriesPerRequest: 1 })
const limiter = createRateLimiter({ redis: () => valkey })
for (const member of ["mcp-member-A", "mcp-member-B", "mcp-rate-probe"]) {
	await valkey.del(`mcp-read:{${member}}:60`, `mcp-read:{${member}}:3600`)
}
let id = 0
async function rpc(
	member: string,
	method: string,
	params: Record<string, unknown> = {},
) {
	const handle = createReadMcpHandler({
		resource,
		limiter,
		authorization: {
			async verifyAccessToken(token) {
				return {
					token,
					clientId: "local-test",
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
	assert.equal(response.status, 200, await response.clone().text())
	const text = await response.text()
	const message = text.startsWith("event:")
		? JSON.parse(text.split("data: ")[1].split("\n")[0])
		: JSON.parse(text)
	assert.ok(!message.error, JSON.stringify(message))
	return message.result
}
async function call(
	name: string,
	args: Record<string, unknown> = {},
	member = "mcp-member-A",
) {
	const result = await rpc(member, "tools/call", { name, arguments: args })
	assert.ok(!result.isError, JSON.stringify(result))
	assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
	const checkTitles = (value: unknown) => {
		if (!value || typeof value !== "object") return
		const object = value as Record<string, unknown>
		if (typeof object.id === "string" && /^(movie|show):/.test(object.id))
			assert.match(String(object.url), /^http:\/\/localhost:3336\/(movie|show)\//)
		for (const child of Object.values(object)) checkTitles(child)
	}
	checkTitles(result.structuredContent)
	return result.structuredContent
}
try {
	const first = await call("search_titles", { query: "Local Movie" })
	assert.equal(first.page_url, "http://localhost:3336/discover?q=Local+Movie")
	assert.match(first.page_note, /differ/)
	assert.equal(first.items.length, 20)
	assert.equal(first.next_cursor, "offset:20")
	const second = await call("search_titles", {
		query: "Local Movie",
		cursor: first.next_cursor,
	})
	assert.equal(second.items.length, 5)
	assert.equal(second.next_cursor, null)
	assert.equal(
		new Set([...first.items, ...second.items].map((t: { id: string }) => t.id))
			.size,
		25,
	)
	assert.equal(first.items[0].id, "movie:2000")
	assert.equal(
		first.items[0].url,
		"http://localhost:3336/movie/2000-local-movie-00",
	)
	const title = await call("get_title", { title_id: "show:1399" })
	assert.equal(title.title.name, "Local Orbit")
	assert.equal(title.member.status, "watching")
	assert.equal(title.member.latest_recorded_watch_date, null)
	assert.equal(title.member.watch_date_note, "No date recorded")
	assert.equal(title.title.synopsis, "A local test show.")
	assert.equal(title.title.availability.state, "unknown")
	const byName = await call("get_title", { title_name: "Local Orbit" })
	assert.equal(byName.title.id, "show:1399")
	console.log(
		"PASS: real title details, member marks, unknown dates and availability",
	)
	const shows = await call("get_my_shows")
	assert.equal(shows.page_url, "http://localhost:3336/my-shows")
	assert.deepEqual(
		shows.items.map((t: { id: string; group: string }) => [t.id, t.group]),
		[
			["show:1399", "continue"],
			["show:1400", "on_hold"],
		],
	)
	assert.equal(shows.items[0].next_episode.number, 3)
	const progress = await call("get_show_progress", {
		title_id: "show:1399",
		limit: 1,
	})
	assert.equal(progress.status, "watching")
	assert.equal(progress.episodes_watched, 2)
	assert.equal(progress.next_episode.number, 3)
	assert.equal(progress.watches.items[0].date, null)
	assert.equal(progress.watches.items[0].date_note, "No date recorded")
	const progress2 = await call("get_show_progress", {
		title_id: "show:1399",
		limit: 1,
		cursor: progress.watches.next_cursor,
	})
	assert.equal(progress2.watches.items.length, 1)
	assert.equal(progress2.watches.next_cursor, null)
	assert.notEqual(progress.watches.items[0].id, progress2.watches.items[0].id)
	const peerProgress = await call(
		"get_show_progress",
		{ title_id: "show:1399" },
		"mcp-member-B",
	)
	assert.equal(peerProgress.status, "not_started")
	assert.equal(peerProgress.watches.total, 0)
	console.log(
		"PASS: My shows, current pass, next episode, unknown dates and peer isolation",
	)
	const tonight = await call("get_tonight")
	assert.equal(tonight.page_url, "http://localhost:3336/?tv=tonight")
	assert.equal(tonight.pick.title.id, "show:1399")
	assert.equal(tonight.pick.episode.code, "S1 E3")
	assert.equal(tonight.pick.reason, "nextEpisode")
	console.log("PASS: Tonight agrees with My shows and show progress")
	const taste = await call("get_taste")
	assert.equal(taste.page_url, "http://localhost:3336/taste")
	assert.equal(taste.rated_titles, 1)
	assert.equal(taste.wishlist_titles, 25)
	assert.equal(taste.signal, "none")
	assert.deepEqual(taste.leanings, [])
	const peerTaste = await call("get_taste", {}, "mcp-member-B")
	assert.equal(peerTaste.rated_titles, 0)
	console.log(
		"PASS: real Taste counts, honest unavailable model and member isolation",
	)
	const library = await call("get_library")
	assert.equal(library.page_url, "http://localhost:3336/my-library")
	assert.equal(library.items.length, 20)
	assert.equal(library.total, 27)
	const library2 = await call("get_library", { cursor: library.next_cursor })
	assert.equal(library2.items.length, 7)
	assert.equal(library2.next_cursor, null)
	const rated = await call("get_library", { filter: "rated" })
	assert.equal(rated.page_url, "http://localhost:3336/my-library?status=seen")
	assert.match(rated.page_note, /unrated/)
	assert.equal(rated.items.length, 1)
	assert.equal(rated.items[0].score, 8)
	const peer = await call("get_library", {}, "mcp-member-B")
	assert.deepEqual(
		peer.items.map((t: { id: string }) => t.id),
		["movie:2001"],
	)
	const ambiguous = await rpc("mcp-member-A", "tools/call", {
		name: "get_title",
		arguments: { title_name: "Harbor" },
	})
	assert.equal(ambiguous.structuredContent.status, "ambiguous_title")
	assert.deepEqual(
		ambiguous.structuredContent.choices.map((t: { id: string }) => t.id),
		["movie:3000", "movie:3001"],
	)
	const disambiguated = await call("get_title", {
		title_name: "Harbor",
		year: 2024,
	})
	assert.equal(disambiguated.title.id, "movie:3001")
	for (const args of [
		{ limit: 21 },
		{ cursor: "garbage" },
		{ user_id: "mcp-member-B" },
	]) {
		const invalid = await rpc("mcp-member-A", "tools/call", {
			name: "get_library",
			arguments: args,
		})
		assert.equal(invalid.isError, true)
	}
	const missing = await rpc("mcp-member-A", "tools/call", {
		name: "get_title",
		arguments: { title_id: "movie:999999" },
	})
	assert.equal(missing.structuredContent.status, "title_not_found")
	const wrongKind = await rpc("mcp-member-A", "tools/call", {
		name: "get_show_progress",
		arguments: { title_id: "movie:2000" },
	})
	assert.equal(wrongKind.structuredContent.status, "invalid_title_kind")
	const olderPass = await call("get_show_progress", { title_id: "show:1400" })
	assert.equal(olderPass.episodes_watched, 2)
	assert.equal(olderPass.next_episode.number, 3)
	assert.equal(olderPass.watches.total, 3)
	assert.equal(
		olderPass.watches.items.find(
			(w: { id: string; date: string | null }) => w.id === "earlier-pass",
		).date,
		"2020-01-06",
	)
	assert.ok(Number(await valkey.get("mcp-read:{mcp-member-A}:60")) > 0)
	for (let n = 0; n < 61; n++) {
		const rateHandle = createReadMcpHandler({
			resource,
			limiter,
			authorization: {
				async verifyAccessToken(token) {
					return {
						token,
						clientId: n % 2 ? "client-one" : "client-two",
						scopes: ["mcp:read"],
						expiresAt: Date.now() / 1000 + 60,
						resource: new URL(resource),
						extra: { userId: "mcp-rate-probe" },
					}
				},
			},
		})
		const response = await rateHandle(
			new Request(resource, {
				method: "POST",
				headers: {
					Authorization: "Bearer local",
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify({ jsonrpc: "2.0", id: n, method: "ping" }),
			}),
		)
		assert.equal(response.status, n < 60 ? 200 : 429)
		if (n === 60) assert.ok(Number(response.headers.get("Retry-After")) > 0)
		await response.text()
	}
	await call("get_library", {}, "mcp-member-B")
	console.log(
		"PASS: real Valkey member limits shared by clients, with independent peer budget",
	)
	console.log(
		"PASS: schema rejection, ambiguity, missing titles, prior passes and recorded dates",
	)
	console.log("PASS: isolated member library, scores and pagination")
	console.log(
		"PASS: catalog name lookup, pagination and canonical URLs over local CrateDB",
	)
} finally {
	await valkey.quit()
	const { stopTitleSnapshot } = await import(
		"../../app/server/title-snapshot/index.server"
	)
	const { stopTasteStore } = await import("../../app/server/taste/index.server")
	stopTitleSnapshot()
	stopTasteStore()
}

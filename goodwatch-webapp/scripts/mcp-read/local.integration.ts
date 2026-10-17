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
		if (typeof object.id === "string" && /^(movie|show):/.test(object.id)) {
			assert.match(
				String(object.url),
				/^http:\/\/localhost:3336\/(movie|show)\//,
			)
			assert.equal(
				object.link,
				`[${object.name} (${object.year ?? "Year unknown"})](${object.url})`,
			)
		}
		for (const child of Object.values(object)) checkTitles(child)
	}
	checkTitles(result.structuredContent)
	return result.structuredContent
}
try {
	const first = await call("search_titles", { query: "Local Movie", limit: 20 })
	assert.equal(
		first.page_url,
		"http://localhost:3336/discover?q=Local+Movie&services=all&unseen=0&foryou=1",
	)
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
	const full = await call("search_titles", { query: "Local Movie" })
	assert.equal(full.items.length, 25)
	assert.equal(full.next_cursor, null)
	assert.equal(full.availability, "everywhere")
	assert.equal(full.exclude_seen, false)
	assert.ok(full.items.some((item: { id: string }) => item.id === "movie:2000"))
	const unseen = await call("search_titles", {
		query: "Local Movie",
		exclude_seen: true,
		limit: 20,
	})
	assert.equal(unseen.items.length, 20)
	assert.equal(unseen.items[0].id, "movie:2001")
	assert.equal(new URL(unseen.page_url).searchParams.get("unseen"), "1")
	const unseenPage = await call("search_titles", {
		query: "Local Movie",
		exclude_seen: true,
		cursor: unseen.next_cursor,
	})
	assert.equal(unseenPage.items.length, 4)
	const unseenShows = await call("search_titles", {
		query: "Local",
		exclude_seen: true,
	})
	assert.ok(
		!unseenShows.items.some((item: { id: string }) =>
			["show:1399", "show:1400"].includes(item.id),
		),
	)
	const arrival = await call("search_titles", { query: "arrival" })
	assert.deepEqual(
		arrival.items.map((item: { id: string; runtime_minutes: number }) => [
			item.id,
			item.runtime_minutes,
		]),
		[
			["movie:329865", 116],
			["movie:472349", 22],
		],
	)
	const canonical = await call("search_titles", {
		query: "Local Canonical",
		limit: 1,
	})
	assert.equal(canonical.items[0].id, "movie:872517")
	const canonicalPage = await call("search_titles", {
		query: "Local Canonical",
		limit: 1,
		cursor: canonical.next_cursor,
	})
	assert.equal(canonicalPage.items[0].id, "show:3635601")
	assert.equal(canonicalPage.next_cursor, null)
	console.log(
		"PASS: full search default, seen filtering before paging, distinct Arrival works and canonical alias deduplication",
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
	assert.equal(shows.items[0].year, 2020)
	assert.match(shows.items[0].link, /Local Orbit \(2020\)/)
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
	assert.equal(tonight.page_url, "http://localhost:3336/my-shows")
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
	const wishlist = await call("get_library", {
		filter: "want_to_see",
		limit: 2,
	})
	assert.equal(wishlist.sort, "added")
	assert.deepEqual(
		wishlist.items.map((item: { id: string }) => item.id),
		["movie:2000", "movie:2001"],
	)
	assert.equal(
		wishlist.items[0].added_at,
		new Date(1791982800000).toISOString(),
	)
	const oldest = await call("get_library", {
		filter: "want_to_see",
		sort: "waiting",
		limit: 2,
	})
	assert.deepEqual(
		oldest.items.map((item: { id: string }) => item.id),
		["movie:2024", "movie:2023"],
	)
	assert.ok(oldest.items[0].added_at < oldest.items[1].added_at)
	assert.match(oldest.page_note, /default website order/)
	const byTitle = await call("get_library", {
		filter: "want_to_see",
		sort: "title",
	})
	assert.equal(byTitle.page_url, "http://localhost:3336/my-library?sort=title")
	const { libraryOrder } = await import("../../app/domain/my-library")
	const { getUserData } = await import("../../app/server/userData.server")
	const user = await getUserData({ user_id: "mcp-member-A" })
	for (const status of [
		"want",
		"seen",
		"watching",
		"on_hold",
		"dropped",
		"unrated",
	] as const) {
		const { sortsFor } = await import("../../app/domain/my-library")
		for (const sort of sortsFor(status)) {
			const filter = status === "want" ? "want_to_see" : status
			const found = await call("get_library", { filter, sort, limit: 20 })
			const native = libraryOrder(
				user,
				{ status, sort, kind: "all", q: "" },
				(key) =>
					key.startsWith("movie-")
						? `Local Movie ${String(Number(key.slice(6)) - 2000).padStart(2, "0")}`
						: key === "show-1399"
							? "Local Orbit"
							: "Local Hold",
			)
			assert.deepEqual(
				found.items.map((item: { id: string }) => item.id),
				native.keys.slice(0, 20).map((key) => key.replace("-", ":")),
			)
		}
	}
	console.log(
		"PASS: library added dates, oldest-first wishlist, and all native My library sorts agree",
	)
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

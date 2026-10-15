// Preload CommonJS dependencies before the alias hook rewrites relative imports.
import "node-crate"
import "ioredis"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

const { talkedAboutNowEnabled, talkedAboutNowMode } = await import("./flags.server.ts")
const { CONTENT_QUALITY_VERSION, RELEVANCE_VERSION, crateSocialStore, fixtureSocialStore, isMissingTable, readTitleSql, reportId, withMemoryReports } =
	await import("./social-store.server.ts")
const { readBuzzTop, readTitleItems, toItem } = await import("./title-social.server.ts")
const { createRateLimit } = await import("./rate-limit.server.ts")
const { handleWrongTitle } = await import("./wrong-title.server.ts")
type SocialFixture = import("./social-store.server.ts").SocialFixture
type FixtureRelevance = import("./social-store.server.ts").FixtureRelevance

const NOW = new Date("2026-10-14T12:00:00Z")
const hex = (n: number) => n.toString(16).padStart(64, "0")
const NARNIA = { mediaType: "movie" as const, tmdbId: 1147572 }

function fixture(): SocialFixture {
	return {
		posts: [
			{ post_id: hex(1), source: "youtube", source_id: "3g28OdIj6cY", url: "https://www.youtube.com/watch?v=3g28OdIj6cY", author: "Netflix India", published_at: "2026-10-13T18:00:07Z", text: "Official Trailer", content_hash: "a" },
			{ post_id: hex(2), source: "youtube", source_id: "pDvjN6h-mRo", url: "https://www.youtube.com/watch?v=pDvjN6h-mRo", author: "Netflix", published_at: "2026-10-12T18:00:00Z", text: "Official Trailer (again)", content_hash: "a" },
			{ post_id: hex(3), source: "rss", url: "https://deadline.com/narnia", author: "Deadline", published_at: "2026-10-13T18:30:27Z", text: "First trailer", content_hash: "a" },
			{ post_id: hex(4), source: "bluesky", source_id: "at://did:plc:abc/app.bsky.feed.post/3mx", url: "https://bsky.app/profile/x/post/3mx", author: "x.bsky.social", published_at: "2026-10-14T10:00:00Z", text: "Narnia!", content_hash: "a" },
			{ post_id: hex(5), source: "rss", url: "https://old.example/a", author: "Old", published_at: "2026-09-01T00:00:00Z", text: "Too old", content_hash: "a" },
			{ post_id: hex(6), source: "rss", url: "https://gone.example/a", published_at: "2026-10-13T00:00:00Z", text: "Deleted", content_hash: "a", deleted_at: "2026-10-14T00:00:00Z" },
			{ post_id: hex(7), source: "rss", url: "https://changed.example/a", published_at: "2026-10-13T00:00:00Z", text: "Changed", content_hash: "new" },
			{ post_id: hex(8), source: "mastodon", url: "https://mastodon.social/@a/1", published_at: "2026-10-13T01:00:00Z", text: "Hidden by an operator", content_hash: "a" },
			{ post_id: hex(9), source: "rss", url: "https://vector.example/a", published_at: "2026-10-13T02:00:00Z", text: "Vector lane", content_hash: "a" },
		],
		links: [
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(1), lane: "foreground_exact", duplicate_group: "trailer", content_hash: "a" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(2), lane: "foreground_exact", duplicate_group: "trailer", content_hash: "a" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(3), lane: "foreground_fuzzy", content_hash: "a" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(4), lane: "foreground_exact", content_hash: "a" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(5), lane: "foreground_exact", content_hash: "a" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(6), lane: "foreground_exact", content_hash: "a" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(7), lane: "foreground_exact", content_hash: "old" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(8), lane: "foreground_exact", content_hash: "a", hidden_at: "2026-10-14T00:00:00Z" },
			{ media_type: "movie", media_tmdb_id: 1147572, post_id: hex(9), lane: "vector_context", content_hash: "a" },
			{ media_type: "tv", media_tmdb_id: 1147572, post_id: hex(4), lane: "foreground_exact", content_hash: "a" },
		],
		// Every post passed the content-quality gate for its current content.
		quality: Array.from({ length: 9 }, (_, i) => ({
			post_id: hex(i + 1),
			content_hash: i + 1 === 7 ? "new" : "a",
			version: "content-quality-1",
			status: "pass" as const,
		})),
		// Every link was judged worth showing for its post's current content, the newer the higher here.
		relevance: [
			keep(1, 0.7),
			keep(2, 0.7),
			keep(3, 0.8),
			keep(4, 0.9),
			keep(5, 0.95),
			keep(6, 0.6),
			{ ...keep(7, 0.6), content_hash: "new" },
			keep(8, 0.6),
			keep(9, 0.5),
			{ ...keep(4, 0.4), media_type: "tv" },
		],
	}
}

function keep(n: number, score: number, change: Partial<FixtureRelevance> = {}): FixtureRelevance {
	return {
		media_type: "movie",
		media_tmdb_id: 1147572,
		post_id: hex(n),
		version: "relevance-1",
		content_hash: "a",
		status: "keep",
		kind: "news",
		score,
		dup_group: null,
		...change,
	}
}

const read = (store: ReturnType<typeof fixtureSocialStore>, lanes: string[] = []) =>
	store.readTitle(NARNIA, { limit: 50, disabledLanes: lanes }).then((rows) => rows.map((row) => row.post_id))

// --- The flag ---

test("the flag is off unless set to preview or on, and preview shows only the listed members", () => {
	assert.equal(talkedAboutNowMode("title", {}), "off")
	assert.equal(talkedAboutNowMode("title", { TALKED_ABOUT_NOW_TITLE: " ON " }), "on")
	assert.equal(talkedAboutNowMode("title", { TALKED_ABOUT_NOW_TITLE: "yes" }), "off")
	const preview = { TALKED_ABOUT_NOW_TITLE: "preview", TALKED_ABOUT_NOW_PREVIEW_USERS: "u-1, u-2" }
	assert.equal(talkedAboutNowEnabled("title", "u-2", preview), true)
	assert.equal(talkedAboutNowEnabled("title", "u-3", preview), false)
	assert.equal(talkedAboutNowEnabled("title", null, preview), false)
	assert.equal(talkedAboutNowEnabled("title", null, { TALKED_ABOUT_NOW_TITLE: "on" }), true)
	assert.equal(talkedAboutNowEnabled("title", "u-1", { TALKED_ABOUT_NOW_PREVIEW_USERS: "u-1" }), false)
})

// --- The read ---

test("the fixture store applies the read query's filters and keeps one post per duplicate group, best-ranked first", async () => {
	const store = fixtureSocialStore(fixture(), () => NOW)
	assert.deepEqual(await read(store), [hex(4), hex(3), hex(1), hex(9)])
	assert.deepEqual(await read(store, ["vector_context"]), [hex(4), hex(3), hex(1)])
	const rows = await store.readTitle(NARNIA, { limit: 2, disabledLanes: [] })
	assert.equal(rows.length, 2)
})

test("only a passing content-quality verdict of the current version for the post's current content shows a link", async () => {
	const verdict = (n: number, change: Record<string, unknown> = {}) => ({
		post_id: hex(n),
		content_hash: "a",
		version: "content-quality-1",
		status: "pass" as const,
		...change,
	})
	const gated = (quality: SocialFixture["quality"]) => fixtureSocialStore({ ...fixture(), quality }, () => NOW)
	// The posts that are otherwise visible: 4, 3, 1 (the trailer group's newest) and 9.
	assert.deepEqual(await read(gated([verdict(4), verdict(3), verdict(1), verdict(9)])), [hex(4), hex(3), hex(1), hex(9)])
	assert.deepEqual(
		await read(
			gated([
				verdict(4, { status: "reject" }),
				verdict(3, { version: "content-quality-0" }),
				verdict(1, { content_hash: "before-an-edit" }),
				verdict(9),
			]),
		),
		[hex(9)],
	)
	// No verdict at all: nothing shows (fail closed).
	assert.deepEqual(await read(gated(undefined)), [])
	assert.deepEqual(await read(gated([])), [])
})

test("the Crate read joins the passing content-quality verdict of the post's current content", () => {
	const sql = readTitleSql("doc", [])
	assert.match(
		sql,
		/JOIN doc\.social_content_quality q ON q\.post_id = p\.post_id AND q\.content_hash = p\.content_hash\s+AND q\.version = 'content-quality-1' AND q\.status = 'pass'/,
	)
	// An inner join, not a left one: a post without a verdict has no row.
	assert.doesNotMatch(sql, /LEFT JOIN doc\.social_content_quality/)
	assert.equal(CONTENT_QUALITY_VERSION, "content-quality-1")
})

test("only a `keep` relevance verdict of the current version for the link and the post's current content shows it", async () => {
	const judged = (relevance: SocialFixture["relevance"]) => fixtureSocialStore({ ...fixture(), relevance }, () => NOW)
	assert.deepEqual(await read(judged([keep(4, 0.9), keep(3, 0.8), keep(1, 0.7), keep(9, 0.5)])), [hex(4), hex(3), hex(1), hex(9)])
	assert.deepEqual(
		await read(
			judged([
				keep(4, 0.9, { status: "drop" }),
				keep(3, 0.8, { version: "relevance-0" }),
				keep(1, 0.7, { content_hash: "before-an-edit" }),
				keep(9, 0.5),
			]),
		),
		[hex(9)],
	)
	// A verdict on the same post for another title doesn't count for this one.
	assert.deepEqual(await read(judged([keep(4, 0.9, { media_type: "tv" })])), [])
	// No verdict at all, as before the relevance table exists: nothing shows (fail closed).
	assert.deepEqual(await read(judged(undefined)), [])
	assert.deepEqual(await read(judged([])), [])
	assert.equal(RELEVANCE_VERSION, "relevance-1")
})

test("the read ranks by the relevance score, not by time, and keeps the best of each duplicate group", async () => {
	const judged = (relevance: SocialFixture["relevance"]) => fixtureSocialStore({ ...fixture(), relevance }, () => NOW)
	// The oldest visible post ranks first.
	assert.deepEqual(await read(judged([keep(4, 0.2), keep(3, 0.5), keep(1, 0.1), keep(9, 0.9)])), [hex(9), hex(3), hex(4), hex(1)])
	// The same story from two sources: the better-ranked one, though older.
	assert.deepEqual(
		await read(judged([keep(4, 0.9, { dup_group: "story" }), keep(3, 0.95, { dup_group: "story" }), keep(9, 0.5)])),
		[hex(3), hex(9)],
	)
	// The trailer group's older upload ranks higher, so it is the one shown; a dropped one never stands in.
	assert.deepEqual(await read(judged([keep(1, 0.3), keep(2, 0.6)])), [hex(2)])
	assert.deepEqual(await read(judged([keep(1, 0.3, { status: "drop" }), keep(2, 0.6, { status: "drop" })])), [])
	const [row] = await judged([keep(9, 0.42)]).readTitle(NARNIA, { limit: 5, disabledLanes: [] })
	assert.equal(row.score, 0.42)
})

test("the Crate read joins the link's `keep` relevance verdict, ranks by its score and groups by its duplicate group", () => {
	const sql = readTitleSql("doc", [])
	assert.match(
		sql,
		/JOIN doc\.social_relevance rel ON rel\.media_type = l\.media_type AND rel\.media_tmdb_id = l\.media_tmdb_id\s+AND rel\.post_id = l\.post_id AND rel\.content_hash = p\.content_hash\s+AND rel\.version = 'relevance-1' AND rel\.status = 'keep'/,
	)
	assert.doesNotMatch(sql, /LEFT JOIN doc\.social_relevance/)
	assert.match(sql, /PARTITION BY COALESCE\(rel\.dup_group, l\.duplicate_group, l\.post_id\)\s+ORDER BY rel\.score DESC NULLS LAST, p\.published_at DESC/)
	assert.match(sql, /WHERE duplicate_rank = 1 ORDER BY score DESC NULLS LAST, published_at DESC, post_id DESC LIMIT \?$/)
})

test("before the relevance table exists, the read is empty: never pieces without a verdict", async () => {
	const missing = Object.assign(new Error("RelationUnknown[Relation 'doc.social_relevance' unknown]"), { code: 4041 })
	const store = crateSocialStore({ select: async () => Promise.reject(missing) })
	assert.deepEqual(await store.readTitle(NARNIA, { limit: 5, disabledLanes: [] }), [])
	// The message alone, as some drivers report it, is enough.
	assert.equal(isMissingTable({ message: "RelationUnknown[Relation 'doc.social_relevance' unknown]" }), true)
})

test("a fixture can be moved in time so that its newest post is recent", async () => {
	const store = fixtureSocialStore({ ...fixture(), shiftToHoursAgo: 2 }, () => new Date("2026-11-30T00:00:00Z"))
	const [newest] = await store.readTitle(NARNIA, { limit: 1, disabledLanes: [] })
	assert.equal(newest.published_at, "2026-11-29T22:00:00.000Z")
})

test("the Crate read sends the title, the disabled lanes and a bounded limit, and dates come back as ISO", async () => {
	const calls: { sql: string; params: unknown[] }[] = []
	const store = crateSocialStore({
		select: async <T,>(sql: string, params: unknown[]) => {
			calls.push({ sql, params })
			return [{ post_id: hex(1), source: "youtube", source_id: "abc", url: "https://youtu.be/x", author: "A", published_at: new Date(1791994499000), text: "T", lane: "official_video_id", score: 0.8 }] as T[]
		},
	})
	const rows = await store.readTitle({ mediaType: "tv", tmdbId: 1396 }, { limit: 500, disabledLanes: ["vector_context", "foreground_fuzzy"] })
	assert.deepEqual(calls[0].params, ["tv", 1396, "vector_context", "foreground_fuzzy", 100])
	assert.match(calls[0].sql, /l\.lane NOT IN \(\?, \?\)/)
	assert.match(calls[0].sql, /r\.status IN \('open', 'confirmed'\)/)
	assert.equal(rows[0].published_at, "2026-10-14T16:14:59.000Z")
	assert.equal(rows[0].score, 0.8)
	assert.doesNotMatch(readTitleSql("doc", []), /NOT IN/)
})

test("missing tables read as nothing; other failures are thrown", async () => {
	const missing = Object.assign(new Error("RelationUnknown[Relation 'doc.social_title_link' unknown]"), { code: 4041 })
	assert.equal(isMissingTable(missing), true)
	assert.equal(isMissingTable({ message: "SchemaUnknownException[Schema 'x' unknown]", code: 4045 }), true)
	const empty = crateSocialStore({ select: async () => Promise.reject(missing) })
	assert.deepEqual(await empty.readTitle(NARNIA, { limit: 5, disabledLanes: [] }), [])
	assert.equal(await empty.linkExists(NARNIA, hex(1)), false)
	const down = crateSocialStore({ select: async () => Promise.reject(new Error("connect ECONNREFUSED")) })
	await assert.rejects(down.readTitle(NARNIA, { limit: 5, disabledLanes: [] }), /ECONNREFUSED/)
})

test("rows become facade items: news for RSS, purged posts left out, long text cut", () => {
	const base = { post_id: hex(1), source_id: null, author: null, published_at: "2026-10-13T00:00:00.000Z", lane: "x", score: 0.5 }
	assert.deepEqual(toItem({ ...base, source: "rss", url: "https://www.variety.com/a", text: "Headline" }), {
		id: hex(1),
		source: "news",
		url: "https://www.variety.com/a",
		sourceId: null,
		author: "variety.com",
		publishedAt: "2026-10-13T00:00:00.000Z",
		text: "Headline",
	})
	assert.equal(toItem({ ...base, source: "bluesky", url: "https://bsky.app/x", text: null }), null)
	assert.equal(toItem({ ...base, source: "bluesky", url: "", text: "x" }), null)
	assert.equal(toItem({ ...base, source: "mastodon", url: "https://m.example/@a/1", text: "x".repeat(600) })?.text.length, 400)
})

test("the buzz lift comes from the current snapshot's eligible top 20", async () => {
	const payload = JSON.stringify({
		top20: [
			{ title_key: "movie:1147572", eligible: true, score: 9.74, views: 55235, day: "2026-10-13" },
			{ title_key: "tv:1", eligible: false, score: 3, views: 10 },
		],
	})
	const top = await readBuzzTop((async () => [{ day: "2026-10-13", payload }]) as never)
	assert.deepEqual(top, { "movie:1147572": { lift: 9.74, views: 55235, day: "2026-10-13" } })
	const missing = Object.assign(new Error("RelationUnknown"), { code: 4041 })
	assert.deepEqual(await readBuzzTop((async () => Promise.reject(missing)) as never), {})
	assert.deepEqual(await readBuzzTop((async () => []) as never), {})
})

// --- The report ---

test("a Crate report upserts by the title-and-post hash and refreshes the table before it returns", async () => {
	const statements: { sql: string; params?: unknown[] }[] = []
	const store = crateSocialStore({ run: async (sql, params) => void statements.push({ sql, params }), now: () => NOW })
	const { reportId: id } = await store.report(NARNIA, hex(3), "x".repeat(900))
	assert.equal(id, reportId(NARNIA, hex(3)))
	assert.match(statements[0].sql, /^INSERT INTO doc\.social_link_report .* ON CONFLICT \(report_id\) DO UPDATE SET status = 'open', reason = excluded\.reason$/s)
	assert.deepEqual(statements[0].params?.slice(0, 4), [id, "movie", 1147572, hex(3)])
	assert.equal((statements[0].params?.[4] as string).length, 500)
	assert.equal(statements[1].sql, "REFRESH TABLE doc.social_link_report")
})

const ORIGIN = "https://goodwatch.app"
const ENV = { NODE_ENV: "production" } as NodeJS.ProcessEnv

function post(body: unknown, headers: Record<string, string> = {}) {
	return new Request(`${ORIGIN}/api/social/wrong-title`, {
		method: "POST",
		headers: { origin: ORIGIN, "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
		body: typeof body === "string" ? body : JSON.stringify(body),
	})
}

const report = { media_type: "movie", media_tmdb_id: 1147572, post_id: hex(3) }

function handler(store = fixtureSocialStore(fixture(), () => NOW), options: { enabled?: boolean; limit?: number } = {}) {
	const limit = createRateLimit({ limit: options.limit ?? 100, windowMs: 60_000 })
	return {
		store,
		send: (request: Request) =>
			handleWrongTitle(request, { store: () => store, enabled: async () => options.enabled ?? true, limit, env: ENV }),
	}
}

test("a report hides the link from the next read at once, and a retry answers the same report", async () => {
	const { store, send } = handler()
	const first = await send(post({ ...report, reason: "  It is about the 2005 film  " }))
	assert.equal(first.status, 200)
	assert.equal(first.headers.get("cache-control"), "private, no-store")
	const body = await first.json()
	assert.deepEqual(body, { report_id: reportId(NARNIA, hex(3)), hidden: true })
	assert.deepEqual(await read(store), [hex(4), hex(1), hex(9)])
	const again = await send(post(report))
	assert.deepEqual(await again.json(), body)
	// The same post stays on the other title it is linked to.
	assert.equal((await store.readTitle({ mediaType: "tv", tmdbId: 1147572 }, { limit: 5, disabledLanes: [] })).length, 1)
})

test("a report is refused across origins, without JSON, too large, malformed, or for a link that doesn't exist", async () => {
	const { send } = handler()
	assert.equal((await send(post(report, { origin: "https://evil.example" }))).status, 403)
	assert.equal((await send(post(report, { "sec-fetch-site": "cross-site" }))).status, 403)
	const noOrigin = post(report)
	noOrigin.headers.delete("origin")
	assert.equal((await send(noOrigin)).status, 403)
	assert.equal((await send(post(report, { "content-type": "text/plain" }))).status, 415)
	assert.equal((await send(post({ ...report, reason: "x".repeat(3000) }))).status, 413)
	assert.equal((await send(post("{not json"))).status, 400)
	assert.equal((await send(post({ ...report, post_id: "abc" }))).status, 400)
	assert.equal((await send(post({ ...report, media_type: "show" }))).status, 400)
	assert.equal((await send(post({ ...report, extra: 1 }))).status, 400)
	assert.equal((await send(post({ ...report, post_id: hex(99) }))).status, 404)
	assert.equal((await send(new Request(`${ORIGIN}/api/social/wrong-title`, { method: "GET" }))).status, 405)
})

test("a report is refused when the section is off for the viewer, over the rate limit, or when the store fails", async () => {
	assert.equal((await handler(undefined, { enabled: false }).send(post(report))).status, 404)
	const limited = handler(undefined, { limit: 2 })
	assert.equal((await limited.send(post(report))).status, 200)
	assert.equal((await limited.send(post(report))).status, 200)
	const third = await limited.send(post(report))
	assert.equal(third.status, 429)
	assert.equal(third.headers.get("retry-after"), "600")
	const failing = fixtureSocialStore(fixture(), () => NOW)
	failing.report = async () => Promise.reject(new Error("Crate down"))
	const original = console.error
	console.error = () => {}
	try {
		assert.equal((await handler(failing).send(post(report))).status, 503)
	} finally {
		console.error = original
	}
})

test("a dev server's origin is the address it was opened on; production names its own", async () => {
	const { expectedOrigin } = await import("./wrong-title.server.ts")
	const local = new Request("http://alp-laptop.example:3150/api/social/wrong-title")
	assert.equal(expectedOrigin(local, { NODE_ENV: "development" }), "http://alp-laptop.example:3150")
	assert.equal(expectedOrigin(local, { NODE_ENV: "production" }), "https://goodwatch.app")
	assert.equal(expectedOrigin(local, { APP_ORIGIN: "https://staging.example" }), "https://staging.example")
})

test("memory reports hide a post on a store that is only read", async () => {
	const base = fixtureSocialStore(fixture(), () => NOW)
	let writes = 0
	base.report = async () => {
		writes++
		return { reportId: "" }
	}
	const store = withMemoryReports(base)
	await store.report(NARNIA, hex(4), "")
	assert.deepEqual((await readTitleItems(store, NARNIA, [])).map((item) => item.id), [hex(3), hex(1), hex(9)])
	assert.equal(writes, 0)
})

test("the rate limit counts per client and window, and forgets the oldest client when full", () => {
	let time = 0
	const limit = createRateLimit({ limit: 1, windowMs: 1000, maxClients: 2, now: () => time })
	assert.equal(limit.take("a"), true)
	assert.equal(limit.take("a"), false)
	assert.equal(limit.take("b"), true)
	assert.equal(limit.take("c"), true)
	assert.equal(limit.take("a"), true)
	time = 1000
	assert.equal(limit.take("c"), true)
})

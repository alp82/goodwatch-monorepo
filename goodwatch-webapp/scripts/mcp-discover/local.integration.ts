import assert from "node:assert/strict"
import Redis from "ioredis"
import { createReadMcpHandler } from "../../app/server/mcp/endpoint.server"
import { titleKey, parseTitleKey } from "../../app/utils/title-key"
import { VALID_FINGERPRINT_KEYS } from "../../app/server/utils/fingerprint"
import {
	encodeSnapshot,
	encodeRatings,
	chunkKey,
	ratingsChunkKey,
	CURRENT_KEY,
} from "../../app/server/title-snapshot/format.server"
import { discoverView } from "../../app/server/mcp/discover-filters"

// Dedicated disposable services only. No .env, external network or production credentials.
Object.assign(process.env, {
	CRATE_HOSTS: "127.0.0.1",
	CRATE_PORT: "15867",
	CRATE_USER: "crate",
	CRATE_PASS: "",
	REDIS_HOST: "",
	TASTE_REDIS_URL: "redis://127.0.0.1:16867",
	TITLE_FILTER_REDIS_URL: "redis://127.0.0.1:16867",
	TITLE_SNAPSHOT_REDIS_URL: "redis://127.0.0.1:16867",
	WEBAPP_ROLE: "search",
	SEARCH_STORAGE_KEY: "cd".repeat(32),
})
const sql = async (stmt: string, args: unknown[] = []) => {
	const response = await fetch("http://127.0.0.1:15867/_sql", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ stmt, args }),
	})
	assert.ok(response.ok, await response.clone().text())
	return response.json()
}
assert.deepEqual((await sql("SELECT name FROM sys.cluster")).rows, [
	["gw-mcp-search-discover"],
])
const redis = new Redis("redis://127.0.0.1:16867")
const fixture = Array.from({ length: 72 }, (_, i) => {
	const type = i < 64 ? ("movie" as const) : ("show" as const)
	const id = 9000 + i
	return {
		type,
		id,
		key: titleKey(type, id),
		title: `Filter Fixture ${String(i).padStart(2, "0")}`,
		year: 2000 + (i % 27),
		runtime: 60 + i,
		score: 55 + (i % 45),
		genres: i % 3 === 0 ? ["Comedy"] : i % 3 === 1 ? ["Drama"] : ["Animation"],
		anime: i % 3 === 2,
	}
})
const insert = async (table: string, row: Record<string, unknown>) =>
	sql(
		`INSERT INTO ${table} (${Object.keys(row).join(",")}) VALUES (${Object.keys(
			row,
		)
			.map(() => "?")
			.join(
				",",
			)}) ON CONFLICT (${table === "user_setting" ? "user_id,key" : table === "streaming_service" ? "tmdb_id,media_type" : "tmdb_id"}) DO UPDATE SET ${Object.keys(
			row,
		)
			.filter((k) => !["tmdb_id", "media_type", "user_id", "key"].includes(k))
			.map((k) => `${k}=excluded.${k}`)
			.join(",")}`,
		Object.values(row),
	)
for (const [id, name] of [
	[8, "Netflix"],
	[9, "Prime Video"],
] as const)
	await insert("streaming_service", {
		tmdb_id: id,
		media_type: "movie",
		name,
		logo_path: "/local.jpg",
		order_by_country: { DE: id, US: id },
		order_default: id,
	})
await insert("user_setting", {
	user_id: "mcp-member-A",
	key: "streaming_providers_default",
	value: "8",
})
for (const f of fixture)
	await insert(f.type, {
		tmdb_id: f.id,
		title: f.title,
		original_title: f.title,
		release_year: f.year,
		[f.type === "movie" ? "runtime" : "episode_runtime"]:
			f.type === "movie" ? f.runtime : [f.runtime],
		genres: f.genres,
		goodwatch_overall_score_normalized_percent: f.score,
		goodwatch_overall_score_voting_count: 2000 + f.id,
		adult: false,
		poster_path: "/local.jpg",
		streaming_availabilities: [f.id % 2 ? "DE_9" : "DE_8", "US_9"],
	})
for (const table of ["movie", "show", "streaming_service", "user_setting"])
	await sql(`REFRESH TABLE ${table}`)
const version = `mcp-discover-${Date.now()}`
const rows = fixture.map((f, i) => ({
	pointId: f.key,
	genres: f.genres,
	releaseDay: Math.floor(Date.UTC(f.year, 0, 1) / 86400000),
	votes: 2000 + f.id,
	popularity: 100 - i,
	fingerprint: VALID_FINGERPRINT_KEYS.map((key) =>
		key === "warfare" ? 10 : key === "bleakness" ? 2 : 8,
	),
	score: f.score,
	origin: "US",
	hasPoster: true,
	hasBackdrop: false,
	adult: false,
	anime: f.anime,
}))
const { manifest, chunks } = encodeSnapshot({
	version,
	rows,
	keyOrder: VALID_FINGERPRINT_KEYS,
})
const ratings = encodeRatings({
	rows: fixture.map((f, i) => ({
		pointId: f.key,
		ages: { DE: i % 2 ? 6 : 16 },
		estimate: null,
		content: i % 2 ? 0 : 1,
	})),
	ladders: {
		DE: [
			{ age: 0, label: "0" },
			{ age: 6, label: "6" },
			{ age: 12, label: "12" },
			{ age: 16, label: "16" },
			{ age: 18, label: "18" },
		],
	},
})
manifest.ratings = ratings.manifest
for (const [i, chunk] of chunks.entries())
	await redis.set(chunkKey(version, i), Buffer.from(chunk))
for (const [i, chunk] of ratings.chunks.entries())
	await redis.set(ratingsChunkKey(version, i), Buffer.from(chunk))
await redis.set(CURRENT_KEY, JSON.stringify(manifest))
const { getTitleSnapshot, stopTitleSnapshot } = await import(
	"../../app/server/title-snapshot/index.server"
)
const deadline = Date.now() + 20000
while (!getTitleSnapshot() && Date.now() < deadline)
	await new Promise((r) => setTimeout(r, 100))
assert.ok(getTitleSnapshot(), "Real snapshot loader must finish")
const { getMemberViewerContext } = await import(
	"../../app/server/viewer.server"
)
const { loadTaste, stopTasteStore } = await import(
	"../../app/server/taste/index.server"
)
const { filterTitles } = await import(
	"../../app/server/title-filter/index.server"
)
const { createRankedSearch } = await import(
	"../../app/server/mcp/ranked.server"
)
let runs = 0
const rankedSearch = createRankedSearch({
	redis: () => redis,
	run: async () => {
		runs++
		return {
			titles: fixture.map((f) => ({
				media_type: f.type,
				tmdb_id: f.id,
				title: f.title,
				release_year: f.year,
			})),
			ranked: true,
			messages: [],
			chargedNano: 0,
		}
	},
})
const resource = "http://localhost:3336/mcp"
let id = 0
let memberId = "mcp-member-A"
const handler = createReadMcpHandler({
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
				clientId: "discover-fixture",
				scopes: ["mcp:read"],
				expiresAt: Date.now() / 1000 + 60,
				resource: new URL(resource),
				extra: { userId: memberId },
			}
		},
	},
})
async function call(
	name: string,
	args: Record<string, unknown> = {},
	error = false,
) {
	const response = await handler(
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
	const answer = (
		text.startsWith("event:")
			? JSON.parse(text.split("data: ")[1].split("\n")[0])
			: JSON.parse(text)
	).result
	assert.equal(!!answer.isError, error, JSON.stringify(answer))
	if (!error)
		assert.deepEqual(
			JSON.parse(answer.content[0].text),
			answer.structuredContent,
		)
	return answer.structuredContent
}
const ids = (data: { items: { id: string }[] }) =>
	data.items.map((item) => item.id)
const keyIds = (keys: number[]) =>
	keys.map((key) => {
		const { mediaType, tmdbId } = parseTitleKey(key)
		return `${mediaType}:${tmdbId}`
	})
try {
	const options = await call("get_discover_filters")
	assert.equal(options.country, "DE")
	assert.equal(new URL(options.page_url).pathname, "/discover")
	assert.ok(options.genres.includes("Drama"))
	assert.ok(
		options.providers.some(
			(p: { id: number; name: string }) => p.id === 8 && p.name === "Netflix",
		),
	)
	assert.ok(options.saved_provider_ids.includes(8))
	assert.equal(options.facts_available, false) // This fixture has no facts sidecar.
	assert.equal(options.moods.length, 16)
	assert.deepEqual(options.match.minimum_match, [0, 60, 70, 80, 90])
	assert.deepEqual(options.budget.presets[0].args, { max_budget_musd: 4.999 })
	assert.deepEqual(
		options.released.presets.find((p: { key: string }) => p.key === "last-2")
			.args,
		{ released: "recent" },
	)
	assert.deepEqual(options.origin.rest_of_world.args, { rest_of_world: true })
	const first = await call("discover_titles")
	assert.equal(first.items.length, 40)
	assert.equal(first.total, 72)
	assert.equal(first.for_you, true)
	assert.equal(first.availability, "everywhere")
	assert.equal(first.exclude_seen, false)
	assert.equal(new URL(first.page_url).searchParams.get("layout"), "grid")
	for (const item of first.items) {
		assert.ok(item.poster_url)
		assert.ok("match" in item && "match_label" in item)
		assert.ok(item.runtime_minutes > 0)
		assert.equal(item.link, `[${item.name} (${item.year})](${item.url})`)
	}
	const second = await call("discover_titles", { cursor: first.next_cursor })
	assert.equal(second.items.length, 32)
	assert.equal(new Set([...ids(first), ...ids(second)]).size, 72)
	// Regression: blank name searches must use the bounded Discover engine, not
	// fetch/sort the whole SQL catalog (production exhausted its 8s query budget).
	for (const args of [
		{
			exclude_seen: true,
			genres: "Comedy",
			limit: 20,
			on_my_services: true,
			order: "newest",
			type: "show",
		},
		{
			limit: 20,
			max_runtime: 99,
			max_year: 2010,
			min_year: 2000,
			minimum_score: 80,
			type: "movie",
		},
		{},
	]) {
		const expected = await call("discover_titles", args)
		for (const extra of [
			{},
			{ query: "  " },
			{ ranked: true },
			{ query: "", ranked: true },
		]) {
			const actual = await call("search_titles", { ...args, ...extra })
			assert.deepEqual(
				actual,
				expected,
				`query-less search must equal discovery: ${JSON.stringify({ ...args, ...extra })}`,
			)
			if (actual.next_cursor) {
				const next = await call("search_titles", {
					...args,
					...extra,
					cursor: actual.next_cursor,
				})
				const expectedNext = await call("discover_titles", {
					...args,
					cursor: expected.next_cursor,
				})
				assert.deepEqual(next, expectedNext)
			}
		}
	}
	assert.equal(runs, 0, "Query-less ranked requests must never run paid ranking")
	const ctx = await getMemberViewerContext("mcp-member-A", "US")
	const taste = await loadTaste(ctx.viewer)
	// Every new filter/ordering is checked through the public SDK against the site's real shared engine.
	const matrix = [
		// Existing arguments advertised by the shared Discover metadata.
		{ moods: ["tense", "dark", "deep"] },
		{ moods: ["magical", "quirky"] },
		{ moods: ["funny", "feelgood"], match_all: ["moods"] },
		{ genres: ["Drama", "Comedy"], match_all: ["genres"] },
		{ seen_only: true },
		{ wishlist_only: true },
		{ outside_usual: true, minimum_match: 90 },
		{ minimum_match: 60 },
		{ rating_country: "DE", age_limit: 12 },
		{ min_runtime: 90, max_episode_runtime: 35 },
		{ rest_of_world: true },
		{ source_scores: { imdb: 70, metacriticUsers: 70 } },
		// No facts sidecar: these arguments must leave the universe unchanged.
		{ max_budget_musd: 4.999 },
		{ min_box_office_musd: 1000, returns: "hit" },
		{ min_seasons: 2, max_seasons: 3, show_status: "ended" },
		{ max_hours: 599 / 60 },
		{ max_votes: 9999 },
		{ min_votes: 10000, max_votes: 100000 },
		{ max_popularity_rank: 1000 },
		{ min_popularity_rank: 10001 },
		{ min_votes: 1000, max_popularity_rank: 1000 },
		{ type: "show" },
		{ genres: ["Drama"] },
		{ genres: ["Drama", "Comedy"] },
		{ min_year: 2010 },
		{ max_year: 2010 },
		{ min_year: 2010, max_year: 2015 },
		{ min_runtime: 90 },
		{ max_runtime: 90 },
		{ type: "show", min_runtime: 125, max_runtime: 129 },
		{ minimum_score: 75 },
		{ on_my_services: true },
		{ providers: [9] },
		{ anime: "only" },
		{ anime: "none" },
		{ moods: ["funny"] },
		{ themes: ["war"] },
		{ styles: ["animated"] },
		{ minimum_match: 80 },
		{ released: "recent" },
		{ age_limit: 12 },
		{ hide_content: ["violence"] },
		{ show_content: ["violence"] },
		{ exclude_seen: true },
		{ for_you: false },
		{ order: "popularity" },
		{ order: "newest" },
		{ order: "score" },
		{ order: "match" },
		{ order: "newest", for_you: true },
	]
	for (const args of matrix) {
		const view = discoverView(args as never, false)
		const expected = await filterTitles({
			universe: "catalog",
			state: view.state,
			sort: view.sort,
			forYou: view.forYou ? "browse" : null,
			viewer: ctx,
			taste,
		})
		const actual = await call("discover_titles", args)
		assert.deepEqual(
			ids(actual),
			keyIds(expected.keys.slice(0, 40)),
			JSON.stringify(args),
		)
		assert.equal(actual.total, expected.total)
		const fromUrl = new URL(actual.page_url).searchParams
		const { filterStateFromParams, sortFromParams } = await import(
			"../../app/domain/filter-state"
		)
		assert.deepEqual(
			filterStateFromParams(fromUrl, { onMyServices: true, notSeenYet: true }),
			view.state,
		)
		assert.equal(sortFromParams(fromUrl, false), view.sort)
		const names = await call("search_titles", {
			query: "Filter Fixture",
			...args,
		})
		const nameView = discoverView(args as never, false)
		const expectedNames = await filterTitles({
			universe: fixture.map((f) => f.key),
			includeNotInterested: true,
			state: nameView.state,
			sort: args.order ? nameView.sort : "relevance",
			forYou: null,
			viewer: ctx,
			taste,
		})
		assert.deepEqual(
			ids(names),
			keyIds(expectedNames.keys.slice(0, 40)),
			`name ${JSON.stringify(args)}`,
		)
	}
	memberId = "mcp-taste-A"
	const personal = await call("discover_titles", { order: "match" })
	assert.ok(
		personal.items.every(
			(item: { match: number | null }) => item.match !== null,
		),
	)
	const tasteCtx = await getMemberViewerContext(memberId, "US")
	const populated = await loadTaste(tasteCtx.viewer)
	assert.equal(populated.signal, "some")
	for (const args of [
		{},
		{ for_you: false },
		{ minimum_match: 80 },
		{ order: "match" },
	]) {
		const view = discoverView(args as never, false)
		const expected = await filterTitles({
			universe: "catalog",
			state: view.state,
			sort: view.sort,
			forYou: view.forYou ? "browse" : null,
			viewer: tasteCtx,
			taste: populated,
		})
		assert.deepEqual(
			ids(await call("discover_titles", args)),
			keyIds(expected.keys.slice(0, 40)),
		)
	}
	memberId = "mcp-member-A"
	// The catalog's little-known 22-minute Arrival has neither votes nor a poster/snapshot row.
	// It remains findable by name under exact year/runtime filters, independently of browse eligibility.
	const short = await call("search_titles", {
		query: "Arrival",
		type: "movie",
		min_year: 2016,
		max_year: 2016,
		min_runtime: 20,
		max_runtime: 30,
	})
	assert.deepEqual(ids(short), ["movie:472349"])
	assert.equal(short.items[0].runtime_minutes, 22)
	const feature = await call("search_titles", {
		query: "Arrival",
		type: "movie",
		min_runtime: 100,
		max_runtime: 120,
	})
	assert.deepEqual(ids(feature), ["movie:329865"])
	const onMine = await call("discover_titles", { on_my_services: true })
	assert.ok(
		onMine.items.every(
			(item: { id: string }) => Number(item.id.split(":")[1]) % 2 === 0,
		),
	)
	const runtime = await call("discover_titles", {
		type: "show",
		min_runtime: 125,
		max_runtime: 129,
	})
	assert.equal(runtime.total, 5)
	const ranked = await call("search_titles", {
		query: "descriptive fixture",
		ranked: true,
		genres: ["Drama"],
		max_runtime: 120,
		limit: 3,
	})
	assert.ok(ranked.next_cursor)
	const page = await call("search_titles", {
		ranked: true,
		cursor: ranked.next_cursor,
		limit: 3,
	})
	assert.deepEqual(page.filters, ranked.filters)
	assert.equal(page.page_url, ranked.page_url)
	assert.equal(runs, 1)
	const invalid = await call(
		"search_titles",
		{ ranked: true, cursor: ranked.next_cursor, genres: ["Comedy"] },
		true,
	)
	assert.equal(invalid.status, "invalid_cursor")
	const changed = await call("search_titles", {
		query: "descriptive fixture",
		ranked: true,
		genres: ["Comedy"],
	})
	assert.equal(changed.charged_nano, 0)
	assert.equal(
		runs,
		1,
		"Changed filters must reuse the raw cache without paid work",
	)
	console.log(
		JSON.stringify({
			ok: true,
			tools: 2,
			filter_cases: matrix.length,
			parity: "real Discover engine and URL round trips",
			ranked_cursor: true,
			poster_grid: true,
		}),
	)
} finally {
	stopTitleSnapshot()
	stopTasteStore()
	redis.disconnect()
	// Other shared cache clients are intentionally process-scoped, as in the existing probes.
	setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref()
}

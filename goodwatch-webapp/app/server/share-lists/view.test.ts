// Preload CommonJS dependencies before the alias hook rewrites relative imports.
import "node-crate"
import "ioredis"
import "react/jsx-runtime"
import ts from "typescript"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, beforeEach, test } from "node:test"
import { CacheTestRedis as FakeRedis } from "../../utils/cache-test-redis.ts"

// The view imports only plain TS. Write-path coverage also loads the real store's
// JSX designs and Vite raw SVG import, without rendering or replacing validation.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (specifier: string, context: unknown) => unknown,
		): unknown
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (specifier.endsWith(".svg?raw")) {
			return {
				url: new URL(`../../${specifier.slice(2)}`, import.meta.url).href,
				shortCircuit: true,
			}
		}
		return next(specifier, context)
	},
	load(url, context, next) {
		if (url.endsWith(".svg?raw")) {
			return {
				format: "module",
				source: `export default ${JSON.stringify(readFileSync(new URL(url), "utf8"))}`,
				shortCircuit: true,
			}
		}
		if (url.endsWith(".tsx") || url.endsWith("/share-lists/store.server.ts")) {
			return {
				format: "module",
				source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
						jsx: ts.JsxEmit.ReactJSX,
					},
				}).outputText,
				shortCircuit: true,
			}
		}
		return next(url, context)
	},
})
process.env.REDIS_HOST = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const {
	resetPendingResetsForTest,
	cacheEntryKey,
	serializeCacheEntry,
	setRedisClusterForTest,
	cacheInFlightCount,
} = await import("../../utils/cache.ts")
const { renderMetrics, resetMetricsForTest } = await import(
	"../metrics/registry.server.ts"
)
const {
	getListView,
	resetListView,
	getProfilePage,
	getCachedProfileByUserId,
	resetProfileViews,
} = await import("./view.server.ts")
const { getListAvailability } = await import("./availability.server.ts")
const { pageCache, resetPageCache } = await import("../page-cache.server.ts")
const store = await import("./store.server.ts")

type Row = Record<string, unknown>
const id = "AbCd012345"
const user = "owner"
const entries = [1, 2, 3, 4, 5].map((tmdb_id) => ({
	media_type: "movie" as const,
	tmdb_id,
}))
const input = {
	title: "Five films",
	promptId: null,
	design: "podium",
	theme: "ember",
	items: entries.map((e) => `movie:${e.tmdb_id}`),
}
const keyOf = (listId = id) =>
	cacheEntryKey("share-list-view-v1", { id: listId })
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

function listRow(listId = id): Row {
	return {
		id: listId,
		user_id: user,
		title: input.title,
		prompt_id: null,
		design: input.design,
		theme: input.theme,
		items: entries,
		visibility: "public",
		remixed_from: null,
		content_hash: "original",
		created_at: Date.now(),
		updated_at: Date.now(),
		deleted_at: null,
	}
}

class FakeCrate {
	hasCollectionColumn = true
	lists = new Map<string, Row>([[id, listRow()]])
	profiles = new Map<string, Row>([
		[user, { user_id: user, handle: "filmfan", deleted_at: null }],
	])
	visibleLists: Map<string, Row> | undefined
	visibleProfiles: Map<string, Row> | undefined
	handles = new Map<string, Row>()
	statements: string[] = []
	pauseRead: (() => Promise<void>) | undefined
	beforeInsert: ((id: string) => void) | undefined
	failWrite = false
	failRefresh = false

	async execute(
		sql: string,
		params: unknown[] = [],
	): Promise<{ json: unknown[]; rowcount: number }> {
		this.statements.push(sql)
		const statement = sql.replace(/\s+/g, " ")
		if (!this.hasCollectionColumn && statement.includes("collection_metadata"))
			throw Object.assign(
				new Error("ColumnUnknownException: Column collection_metadata unknown"),
				{ code: 4043 },
			)
		const result = (json: unknown[] = []) => ({ json, rowcount: json.length })
		if (statement.startsWith("REFRESH")) {
			if (this.failRefresh) throw new Error("refresh timeout")
			if (statement.includes("doc.user_list"))
				this.visibleLists = structuredClone(this.lists)
			if (statement.includes("doc.user_profile"))
				this.visibleProfiles = structuredClone(this.profiles)
			return result()
		}
		const table = statement.match(/(?:FROM|INTO|UPDATE) ([\w.]+)/)?.[1]
		const rows =
			table === "doc.user_list"
				? this.lists
				: table === "doc.user_profile"
					? this.profiles
					: this.handles
		if (statement.startsWith("SELECT")) {
			if (table === "movie" || table === "show") {
				return result(
					params.map((tmdb_id) => ({
						tmdb_id,
						title: `Title ${tmdb_id}`,
						release_year: 2000,
						score: 80,
					})),
				)
			}
			if (table === "streaming_availability") {
				return result([
					{
						media_type: "movie",
						media_tmdb_id: 1,
						streaming_type: "flatrate",
						streaming_service_id: 8,
						stream_url: `https://example.test/${params[0]}`,
						updated_at: Date.now(),
					},
				])
			}
			if (table === "streaming_service")
				return result([
					{
						tmdb_id: 8,
						name: "Netflix",
						logo_path: "/logo",
						order_by_country: { DE: 1, US: 2 },
					},
				])
			assert.ok(table?.startsWith("doc.user_"), statement)
			const field = statement.match(/WHERE (\w+) = \?/)?.[1]
			// Only primary-key reads see writes before a refresh.
			const readable =
				table === "doc.user_list" && field !== "id"
					? (this.visibleLists ?? rows)
					: table === "doc.user_profile" && field !== "user_id"
						? (this.visibleProfiles ?? rows)
						: rows
			let selected = [...readable.values()].filter(
				(row) => !field || row[field] === params[0],
			)
			if (statement.includes("deleted_at IS NULL"))
				selected = selected.filter((row) => row.deleted_at == null)
			if (statement.includes("visibility = 'public'"))
				selected = selected.filter((row) => row.visibility === "public")
			const snapshot = structuredClone(selected).map((row) => {
				if (!statement.includes("array_slice(items, 1, 5) AS items")) return row
				const { collection_metadata, items, ...rest } = row
				return {
					...rest,
					items: (items as unknown[]).slice(0, 5),
					item_count: (items as unknown[]).length,
					is_collection: statement.includes("NULL IS NOT NULL")
						? false
						: collection_metadata != null,
				}
			})
			if (table === "doc.user_list" && field === "id" && this.pauseRead) {
				const pause = this.pauseRead
				this.pauseRead = undefined
				await pause()
			}
			return result(snapshot)
		}
		if (this.failWrite) throw new Error("write timeout")
		if (table === "doc.user_list")
			this.visibleLists ??= structuredClone(this.lists)
		if (table === "doc.user_profile")
			this.visibleProfiles ??= structuredClone(this.profiles)
		if (statement.startsWith("INSERT")) {
			const columns = statement.match(/\(([^)]+)\) VALUES/)?.[1].split(", ")
			assert.ok(columns, statement)
			const row = Object.fromEntries(
				columns.map((column, i) => [column, params[i]]),
			)
			const key = String(
				table === "doc.user_list"
					? row.id
					: table === "doc.user_profile"
						? row.user_id
						: row.handle,
			)
			if (table === "doc.user_list") this.beforeInsert?.(key)
			if (!rows.has(key)) rows.set(key, row)
			return result()
		}
		if (statement.startsWith("UPDATE")) {
			const [set, where] = statement.split(" SET ")[1].split(" WHERE ")
			const changes: Row = {}
			let index = 0
			for (const assignment of set.split(", ")) {
				const [column, value] = assignment.split(" = ")
				changes[column] = value === "NULL" ? null : params[index++]
			}
			for (const row of rows.values()) {
				let param = index
				const matches = where.split(" AND ").every((condition) => {
					if (condition === "deleted_at IS NULL") return row.deleted_at == null
					const [column, operator] = condition.split(" ")
					const value = params[param++]
					return operator === "="
						? row[column] === value
						: row[column] != null && Number(row[column]) >= Number(value)
				})
				if (matches) Object.assign(row, changes)
			}
			return result()
		}
		throw new Error(`Unhandled statement: ${statement}`)
	}
}

let db: FakeCrate
let redis: FakeRedis
beforeEach(() => {
	db = new FakeCrate()
	redis = new FakeRedis()
	setCrateClientForTest(db)
	setRedisClusterForTest(redis)
	resetPendingResetsForTest()
	resetMetricsForTest()
})
afterEach(async () => {
	await tick()
	assert.equal(cacheInFlightCount(), 0)
	setCrateClientForTest(null)
	setRedisClusterForTest(null)
	resetPendingResetsForTest()
})

test("warm view and availability reads send no Crate statements and count hits", async () => {
	const view = await getListView(id)
	const availability = await getListAvailability(entries, "DE")
	assert.equal(db.statements.length, 5)
	db.statements.length = 0
	assert.deepEqual(await getListView(id), view)
	assert.deepEqual(await getListAvailability(entries, "DE"), availability)
	assert.equal(db.statements.length, 0)
	for (const cache of ["share-list-view-v1", "share-list-availability-v2"]) {
		assert.match(
			renderMetrics(),
			new RegExp(
				`goodwatch_data_cache_requests_total\\{cache="${cache}",result="hit"\\} 1`,
			),
		)
	}
})

test("list reset cancels matching page renders in this process", async () => {
	const makeFlight = (key: string, path: string) => ({
		key,
		path,
		route: "list",
		startedAt: Date.now(),
		joinable: true,
		waiters: new Set<never>(),
		offered: false,
		kind: "request" as const,
		cancelled: false,
	})
	const matching = makeFlight("list:de:query", `/u/filmfan/lists/${id}`)
	const other = makeFlight("other", "/other")
	pageCache.flights.set(matching.key, matching)
	pageCache.flights.set(other.key, other)
	try {
		await resetListView(id)
		assert.equal(pageCache.flights.has(matching.key), false)
		assert.equal(matching.cancelled, true)
		assert.equal(pageCache.flights.has(other.key), true)
	} finally {
		resetPageCache()
	}
})

test("negative views are cached; garbage ids never touch Redis or Crate; create resets its id", async () => {
	db.lists.clear()
	assert.equal(await getListView(id), null)
	assert.equal(db.statements.length, 1)
	assert.equal(await getListView(id), null)
	assert.equal(db.statements.length, 1)
	const reads = redis.reads
	const keys = redis.values.size
	for (const invalid of ["", "short", "../garbage", "a".repeat(11)])
		assert.equal(await getListView(invalid), null)
	assert.equal(redis.reads, reads)
	assert.equal(redis.values.size, keys)
	assert.equal(db.statements.length, 1)
	db.beforeInsert = (newId) =>
		redis.values.set(keyOf(newId), serializeCacheEntry({ found: false }))
	const created = await store.createList(user, input)
	assert.equal(redis.values.has(keyOf(created.id)), false)
	assert.deepEqual((await getListView(created.id))?.list, created)
})

test("all list writes reset warm views, including title, order, visibility, delete and restore", async () => {
	await getListView(id)
	await store.updateList(user, id, { ...input, title: "Renamed" })
	assert.equal((await getListView(id))?.list.title, "Renamed")
	await store.updateList(user, id, {
		...input,
		items: [...input.items].reverse(),
	})
	assert.deepEqual(
		(await getListView(id))?.titles.map((title) => title.key),
		[...input.items].reverse(),
	)
	await store.setListVisibility(user, id, "unlisted")
	const unlisted = await getListView(id)
	assert.equal(unlisted?.list.visibility, "unlisted")
	assert.deepEqual(unlisted?.list, await store.getList(id))
	assert.deepEqual(Object.keys(unlisted ?? {}).sort(), [
		"list",
		"owner",
		"titles",
	])
	assert.deepEqual(await store.publicListsByUser(user), [])
	const count = db.statements.length
	await store.publicListsByUser(user)
	assert.equal(db.statements.length, count + 1)
	await store.deleteList(user, id)
	assert.equal(await getListView(id), null)
	await store.restoreList(user, id)
	assert.ok(await getListView(id))
})

test("profile claim and account deletion reset every owner list, including deleted rows", async () => {
	const otherId = "Other01234"
	db.lists.set(otherId, { ...listRow(otherId), deleted_at: Date.now() })
	db.profiles.clear()
	assert.equal(await getListView(id), null)
	assert.equal(await getListView(otherId), null)
	await store.claimHandle(user, "newhandle")
	assert.equal(redis.values.has(keyOf(otherId)), false)
	assert.equal((await getListView(id))?.owner.handle, "newhandle")
	await getListView(otherId)
	await store.deleteAccountData(user)
	assert.equal(redis.values.has(keyOf(otherId)), false)
	assert.equal(await getListView(id), null)
})

test("stale data is served before a delete, never after its reset", async () => {
	const original = await getListView(id)
	const entry = JSON.parse(redis.values.get(keyOf()) ?? "")
	redis.values.set(
		keyOf(),
		serializeCacheEntry(entry.data, Date.now() - 11_000),
	)
	assert.deepEqual(await getListView(id), original)
	assert.match(renderMetrics(), /cache="share-list-view-v1",result="stale"\} 1/)
	await store.deleteList(user, id)
	await tick()
	assert.equal(await getListView(id), null)
})

test("delete outdates an in-flight view that already read the old row", async () => {
	let release: () => void = () => {}
	let started: () => void = () => {}
	const waiting = new Promise<void>((resolve) => {
		started = resolve
	})
	const blocked = new Promise<void>((resolve) => {
		release = resolve
	})
	db.pauseRead = async () => {
		started()
		await blocked
	}
	const pending = getListView(id)
	await waiting
	await store.deleteList(user, id)
	release()
	assert.ok(await pending)
	assert.equal(redis.values.has(keyOf()), false)
	assert.equal(await getListView(id), null)
})

test("failed DEL bypasses surviving Redis data, throttles retries and recovers", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	await getListView(id)
	const old = redis.values.get(keyOf())
	redis.failDelete = true
	await store.deleteList(user, id)
	const reads = redis.reads
	assert.equal(await getListView(id), null)
	assert.equal(redis.reads, reads)
	assert.equal(redis.values.get(keyOf()), old)
	assert.equal(
		redis.calls.filter(
			(c) => c.command === "gwCacheReset" && c.args[0] === keyOf(),
		).length,
		1,
	)
	t.mock.timers.tick(5000)
	await getListView(id)
	await tick()
	assert.equal(
		redis.calls.filter(
			(c) => c.command === "gwCacheReset" && c.args[0] === keyOf(),
		).length,
		2,
	)
	await getListView(id)
	assert.equal(
		redis.calls.filter(
			(c) => c.command === "gwCacheReset" && c.args[0] === keyOf(),
		).length,
		2,
	)
	redis.failDelete = false
	t.mock.timers.tick(5000)
	assert.equal(await getListView(id), null)
	await tick()
	assert.equal(redis.values.has(keyOf()), false)
	assert.equal(await getListView(id), null)
	db.statements.length = 0
	assert.equal(await getListView(id), null)
	assert.equal(db.statements.length, 0)
})

test("availability keys share title order, separate countries and bypass invalid input", async () => {
	const de = await getListAvailability(entries, "DE")
	const statements = db.statements.length
	assert.deepEqual(await getListAvailability([...entries].reverse(), "de"), de)
	assert.equal(db.statements.length, statements)
	assert.notDeepEqual(await getListAvailability(entries, "US"), de)
	assert.equal(db.statements.length, statements + 2)
	const reads = redis.reads
	const empty = await getListAvailability(entries, "invalid")
	assert.ok(
		Object.values(empty).every(
			(value) => value.state === "none" && !value.offers.length,
		),
	)
	assert.deepEqual(await getListAvailability([], "DE"), {})
	assert.equal(redis.reads, reads)
	assert.equal(db.statements.length, statements + 2)
})

test("write and refresh failures still invalidate; validation failures do not", async () => {
	await getListView(id)
	await assert.rejects(store.updateList(user, id, { ...input, title: "" }))
	assert.equal(redis.deletes, 0)
	for (const failure of ["failWrite", "failRefresh"] as const) {
		await getListView(id)
		db[failure] = true
		await assert.rejects(
			store.updateList(user, id, { ...input, title: "Changed" }),
		)
		assert.equal(redis.values.has(keyOf()), false)
		db[failure] = false
	}
})

test("unconfirmed reset expires after the marker TTL and drops the oldest at its bound", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	redis.failDelete = true
	await resetListView(id)
	const reads = redis.reads
	await getListView(id)
	assert.equal(redis.reads, reads)
	for (let i = 0; i < 1000; i++)
		await resetListView(String(i).padStart(10, "0"))
	await getListView(id)
	assert.equal(redis.reads, reads + 1)
	await resetListView(id)
	t.mock.timers.tick(900_000)
	// Real Redis expires old entries at this point.
	redis.values.clear()
	await getListView(id)
	assert.equal(redis.reads, reads + 2)
})

const profileKey = (userId = user) =>
	cacheEntryKey("share-profile-by-user-v1", { userId })
const pageKey = (handle = "filmfan") =>
	cacheEntryKey("share-profile-page-v1", { handle })
async function warmProfiles() {
	await getCachedProfileByUserId(user)
	await getProfilePage("filmfan")
}
function profilesReset() {
	assert.equal(redis.values.has(profileKey()), false)
	assert.equal(redis.values.has(pageKey()), false)
}
test("profile caches hit without Crate, normalize handles and exclude unlisted lists", async () => {
	db.lists.set("Other01234", {
		...listRow("Other01234"),
		visibility: "unlisted",
	})
	const page = await getProfilePage("FILMFAN")
	assert.deepEqual(
		page?.lists.map((l) => l.id),
		[id],
	)
	const profile = await getCachedProfileByUserId(user)
	db.statements.length = 0
	assert.deepEqual(await getProfilePage("filmfan"), page)
	assert.deepEqual(await getCachedProfileByUserId(user), profile)
	assert.equal(db.statements.length, 0)
	const calls = redis.calls.length
	for (const invalid of ["", "../bad", "a".repeat(100)])
		assert.equal(await getProfilePage(invalid), null)
	assert.equal(redis.calls.length, calls)
	assert.equal(await getProfilePage("unknown"), null)
	const count = db.statements.length
	assert.equal(await getProfilePage("unknown"), null)
	assert.equal(db.statements.length, count)
})
test("profile caches separate users", async () => {
	db.profiles.set("second", { user_id: "second", handle: "otherfan" })
	const profiles = await Promise.all([
		getCachedProfileByUserId(user),
		getCachedProfileByUserId("second"),
	])
	assert.notDeepEqual(profiles[0], profiles[1])
	assert.notEqual(profileKey(), profileKey("second"))
	assert.deepEqual(
		await Promise.all([
			getCachedProfileByUserId(user),
			getCachedProfileByUserId("second"),
		]),
		profiles,
	)
})
for (const operation of [
	"create",
	"update",
	"visibility",
	"delete",
	"restore",
] as const)
	test(`${operation} resets both profile caches`, async () => {
		if (operation === "restore") await store.deleteList(user, id)
		await warmProfiles()
		if (operation === "create") await store.createList(user, input)
		if (operation === "update")
			await store.updateList(user, id, { ...input, title: "Changed" })
		if (operation === "visibility")
			await store.setListVisibility(user, id, "unlisted")
		if (operation === "delete") await store.deleteList(user, id)
		if (operation === "restore") await store.restoreList(user, id)
		profilesReset()
		const page = await getProfilePage("filmfan")
		assert.equal(
			page?.lists.length,
			operation === "create"
				? 2
				: operation === "delete" || operation === "visibility"
					? 0
					: 1,
		)
		if (operation === "update") assert.equal(page?.lists[0].title, "Changed")
	})
for (const withLists of [true, false])
	test(`claim and account deletion reset profiles, lists=${withLists}`, async () => {
		if (!withLists) db.lists.clear()
		db.profiles.clear()
		assert.equal(await getCachedProfileByUserId(user), null)
		assert.equal(await getProfilePage("filmfan"), null)
		await store.claimHandle(user, "filmfan")
		profilesReset()
		await warmProfiles()
		assert.ok(await getCachedProfileByUserId(user))
		await store.deleteAccountData(user)
		profilesReset()
		assert.equal(await getProfilePage("filmfan"), null)
		assert.equal(await getCachedProfileByUserId(user), null)
	})
test("failed owner lookup preserves list reset; failed handle lookup preserves by-user reset", async (t) => {
	await getListView(id)
	await warmProfiles()
	t.mock.method(console, "error", () => {})
	const execute = db.execute.bind(db)
	t.mock.method(db, "execute", async (sql: string, params?: unknown[]) => {
		if (
			sql.startsWith("SELECT user_id FROM doc.user_list") ||
			sql.startsWith("SELECT handle FROM doc.user_profile")
		)
			throw new Error("lookup failed")
		return execute(sql, params)
	})
	setCrateClientForTest(db)
	await resetListView(id)
	assert.equal(redis.values.has(keyOf()), false)
	await resetProfileViews(user)
	assert.equal(redis.values.has(profileKey()), false)
})

test("view lifetime is 10 seconds fresh and 20 seconds physical", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	await getListView(id)
	assert.equal(redis.writes.find((write) => write.key === keyOf())?.ttl, 20)
	t.mock.timers.tick(9999)
	await getListView(id)
	assert.match(renderMetrics(), /cache="share-list-view-v1",result="hit"\} 1/)
	t.mock.timers.tick(2)
	await getListView(id)
	assert.match(renderMetrics(), /cache="share-list-view-v1",result="stale"\} 1/)
	await tick()
	await resetListView(id)
	assert.equal(
		redis.calls.find(
			(call) => call.command === "gwCacheReset" && call.args[0] === keyOf(),
		)?.args[3],
		320,
	)
})

for (const confirmed of [false, true])
	test(`list reset drops a page stored during the data reset: confirmed=${confirmed}`, async (t) => {
		const reset = redis.gwCacheReset.bind(redis)
		redis.failDelete = !confirmed
		t.mock.method(
			redis,
			"gwCacheReset",
			async (...args: Parameters<typeof reset>) => {
				if (args[0] === keyOf()) {
					const variant = { body: Buffer.from("old"), etag: "old", headers: {} }
					pageCache.entries.set("during-reset", {
						key: "during-reset",
						path: `/u/filmfan/lists/${id}`,
						route: "list",
						storedAt: 0,
						freshUntil: 10_000,
						staleUntil: 20_000,
						br: variant,
						gzip: variant,
						identityBody: variant.body,
						identityLength: 3,
						identityEtag: "old",
						headers: {},
						bytes: 0,
					})
				}
				return reset(...args)
			},
		)
		try {
			await resetListView(id)
			assert.equal(pageCache.entries.has("during-reset"), false)
		} finally {
			resetPageCache()
		}
	})

test("profile page lifetime is 10 seconds fresh and 20 seconds physical", async (t) => {
	t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
	await getProfilePage("filmfan")
	assert.equal(redis.writes.find((write) => write.key === pageKey())?.ttl, 20)
	t.mock.timers.tick(9999)
	await getProfilePage("filmfan")
	assert.match(
		renderMetrics(),
		/cache="share-profile-page-v1",result="hit"\} 1/,
	)
	t.mock.timers.tick(2)
	await getProfilePage("filmfan")
	assert.match(
		renderMetrics(),
		/cache="share-profile-page-v1",result="stale"\} 1/,
	)
	await tick()
	await resetProfileViews(user)
	assert.equal(
		redis.calls.find(
			(call) => call.command === "gwCacheReset" && call.args[0] === pageKey(),
		)?.args[3],
		320,
	)
})

for (const confirmed of [false, true])
	test(`profile reset drops a page stored during the data reset: confirmed=${confirmed}`, async (t) => {
		const variant = { body: Buffer.from("old"), etag: "old", headers: {} }
		const storePage = (key: string, path: string) =>
			pageCache.entries.set(key, {
				key,
				path,
				route: "profile",
				storedAt: 0,
				freshUntil: 10_000,
				staleUntil: 20_000,
				br: variant,
				gzip: variant,
				identityBody: variant.body,
				identityLength: 3,
				identityEtag: "old",
				headers: {},
				bytes: 0,
			})
		storePage("before-reset", "/u/filmfan")
		storePage("trailing-slash", "/u/FilmFan/")
		storePage("list-page", `/u/filmfan/lists/${id}`)
		storePage("other-profile", "/u/filmfan2")
		const reset = redis.gwCacheReset.bind(redis)
		redis.failDelete = !confirmed
		t.mock.method(
			redis,
			"gwCacheReset",
			async (...args: Parameters<typeof reset>) => {
				if (args[0] === pageKey()) {
					assert.equal(pageCache.entries.has("before-reset"), false)
					assert.equal(pageCache.entries.has("trailing-slash"), false)
					storePage("during-reset", "/u/FILMFAN/")
				}
				return reset(...args)
			},
		)
		try {
			await resetProfileViews(user)
			assert.equal(pageCache.entries.has("during-reset"), false)
			assert.equal(pageCache.entries.has("list-page"), true)
			assert.equal(pageCache.entries.has("other-profile"), true)
		} finally {
			resetPageCache()
		}
	})

test("a member without a handle saves an ordered private imported list of any length with source notes in the existing list store", async () => {
	db.profiles.clear()
	const created = await store.createList(user, {
		...input,
		title: "A source list with six titles",
		items: ["movie:6", "movie:1", "movie:5", "movie:3", "movie:2", "movie:4"],
		visibility: "private",
		collection: {
			description: "Source description",
			notes: { "movie:6": "First note\nSecond line" },
		},
	})
	assert.equal(created.visibility, "private")
	assert.equal(created.title, "A source list with six titles")
	assert.deepEqual(
		created.items.map((entry) => entry.tmdb_id),
		[6, 1, 5, 3, 2, 4],
	)
	assert.equal(
		(await store.getList(created.id))?.collection?.notes?.["movie:6"],
		"First note\nSecond line",
	)
	await store.deleteList(user, created.id)
	assert.equal(await store.getList(created.id), null)
})

test("private imported lists never enter the public list/card view, even for an owner with a handle", async () => {
	const created = await store.createList(user, {
		...input,
		visibility: "private",
		collection: { description: "Private notes", notes: {} },
	})
	assert.equal(await getListView(created.id), null)
	assert.equal(
		(await store.listsByUser(user)).some((list) => list.id === created.id),
		true,
	)
})

test("an imported list retry cannot adopt an existing list with the same title and titles", async () => {
	db.lists.get(id)!.content_hash = store.contentHash({
		...input,
		theme: "ember",
		items: entries,
	})
	await assert.rejects(
		store.createList(
			user,
			{
				...input,
				visibility: "private",
				collection: { description: "Imported copy", notes: {} },
			},
			{ id },
		),
		(error: unknown) =>
			error instanceof store.ShareListError && error.status === 409,
	)
	assert.equal((await store.getList(id))?.visibility, "public")
})

test("existing list reads work before the collection migration and pick up metadata after it runs", async () => {
	db.hasCollectionColumn = false
	assert.equal((await store.getList(id))?.title, input.title)
	assert.equal((await store.listsByUser(user)).length, 1)
	assert.equal((await store.publicListsByUser(user)).length, 1)
	assert.equal((await getListView(id))?.list.title, input.title)
	db.hasCollectionColumn = true
	db.lists.get(id)!.collection_metadata = JSON.stringify({
		description: "After migration",
		entryNotes: [],
	})
	assert.equal(
		(await store.getList(id))?.collection?.description,
		"After migration",
	)
})

test("existing five-title cards can be created and updated before the collection migration", async () => {
	db.hasCollectionColumn = false
	const created = await store.createList(user, input)
	assert.equal(created.title, input.title)
	const updated = await store.updateList(user, id, {
		...input,
		title: "An updated card",
	})
	assert.equal(updated.title, "An updated card")
})

test("list overviews return five entries and an exact total without transferring collection notes", async () => {
	const all = Array.from({ length: 1000 }, (_, at) => ({
		media_type: "movie",
		tmdb_id: at + 1,
	}))
	db.lists.get(id)!.items = all
	db.lists.get(id)!.collection_metadata = JSON.stringify({
		description: "Source description",
		entryNotes: all.map(() => "A long source note"),
	})
	const [overview] = await store.listsByUser(user)
	assert.equal(overview.items.length, 5)
	assert.equal(overview.itemCount, 1000)
	assert.equal(overview.isCollection, true)
	assert.equal("collection" in overview, false)
	const [visible] = await store.publicListsByUser(user)
	assert.equal(visible.items.length, 5)
	assert.equal(visible.itemCount, 1000)
	assert.equal(visible.isCollection, true)
})

test("remix refuses another members private lists and collections, but allows an owners bounded source", async () => {
	const { getRemixSource } = await import("./remix.server.ts")
	db.lists.get(id)!.visibility = "private"
	assert.equal(await getRemixSource(id, undefined), null)
	assert.equal(await getRemixSource(id, "other-member"), null)
	assert.equal((await getRemixSource(id, user))?.items.length, 5)
	db.lists.get(id)!.visibility = "public"
	assert.equal((await getRemixSource(id, undefined))?.id, id)
	db.lists.get(id)!.collection_metadata = JSON.stringify({
		description: "Private source notes",
		entryNotes: ["secret"],
	})
	db.lists.get(id)!.items = Array.from({ length: 1000 }, (_, at) => ({
		media_type: "movie",
		tmdb_id: at + 1,
	}))
	assert.equal(await getRemixSource(id, undefined), null)
	assert.equal(await getRemixSource(id, "other-member"), null)
	const own = await getRemixSource(id, user)
	assert.equal(own?.items.length, 5)
	assert.equal(own?.itemCount, 1000)
	assert.equal("collection" in own!, false)
})

import "node-crate"
import "ioredis"
import "react"
import "@remix-run/node"
import "zod"
import ts from "typescript"
import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, beforeEach, test } from "node:test"
import { CacheTestRedis } from "../utils/cache-test-redis.ts"

// Keep the real settings schema and reset implementations, without loading UI or auth.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		let source: string | undefined
		if (url.endsWith("/routes/api.user-settings.get.tsx")) {
			const original = readFileSync(new URL(url), "utf8")
			source =
				original.slice(
					original.indexOf("// type definitions"),
					original.indexOf("// API endpoint"),
				) +
				original.slice(
					original.indexOf("export const queryKeyUserSettings"),
					original.indexOf("export const useUserSettings"),
				)
		} else if (url.endsWith("/routes/api.onboarding.media.tsx"))
			source = 'export const queryKeyOnboardingMedia = ["onboarding-media"]'
		else if (url.endsWith("/utils/auth.ts"))
			source =
				'export const getUserIdFromRequest = () => { throw new Error("Unexpected auth") }; export const getAuthFromRequest = getUserIdFromRequest'
		else if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => null`
		else if (url.endsWith("/imdb-import/file.server.ts"))
			source = readFileSync(new URL(url), "utf8")
		if (source !== undefined)
			return {
				format: "module",
				source: ts.transpileModule(source, {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
					},
				}).outputText,
				shortCircuit: true,
			}
		return next(url, context)
	},
})
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
process.env.REC_TASTE_MATCH = "off"
const { setCrateClientForTest, execute, upsert } = await import(
	"../utils/crate.ts"
)
const { setRedisClusterForTest, resetPendingResetsForTest, cacheEntryKey } =
	await import("../utils/cache.ts")
const { getUserData, resetUserDataCache } = await import("./userData.server.ts")
const { getUserSettings, setUserSettings, resetUserSettingsCache } =
	await import("./user-settings.server.ts")
const { updateScores } = await import("./scores.server.ts")
const { updateWishList } = await import("./wishList.server.ts")
const { updateFavorites } = await import("./favorites.server.ts")
const { updateSkipped } = await import("./skipped.server.ts")
const { updateWatchHistory } = await import("./watchHistory.server.ts")
const { finishTitle, undoFinishTitle } = await import(
	"./finish-title.server.ts"
)
const { ratingsChanged } = await import("./imdb-import/apply.server.ts")
const { resetGuestImportCaches } = await import("./guest-import.server.ts")
const { renderMetrics, resetMetricsForTest } = await import(
	"./metrics/registry.server.ts"
)

type Row = Record<string, unknown>
class FakeCrate {
	rows = new Map<string, Row[]>()
	visible = new Map<string, Row[]>()
	statements: string[] = []
	failRefresh = false
	pause: (() => Promise<void>) | undefined
	async execute(raw: string, params: unknown[] = []) {
		const sql = raw.trim().replace(/\s+/g, " ")
		this.statements.push(sql)
		events.push(sql)
		if (sql.startsWith("REFRESH TABLE")) {
			if (this.failRefresh) throw new Error("refresh failed")
			for (const table of sql.slice("REFRESH TABLE ".length).split(", "))
				this.visible.set(table, structuredClone(this.rows.get(table) ?? []))
			return { json: [], rowcount: 1 }
		}
		const table = sql.match(/(?:FROM|INTO|UPDATE) (\w+)/)?.[1]
		assert.ok(table, sql)
		const rows = this.rows.get(table) ?? []
		if (sql.startsWith("SELECT")) {
			const primary = sql.includes("tmdb_id = ?") || sql.includes("key = ?")
			const snapshot = structuredClone(
				(primary ? rows : (this.visible.get(table) ?? [])).filter(
					(r) =>
						r.user_id === params[0] && (!primary || r.tmdb_id === params[1]),
				),
			)
			if (this.pause) {
				const pause = this.pause
				this.pause = undefined
				await pause()
			}
			return { json: snapshot, rowcount: snapshot.length }
		}
		if (sql.startsWith("INSERT")) {
			const columns = sql
				.match(/\(([^)]+)\) VALUES/)?.[1]
				.replace(/"/g, "")
				.split(", ")
			assert.ok(columns, sql)
			const row = Object.fromEntries(columns.map((c, i) => [c, params[i]]))
			const old = rows.find(
				(r) =>
					r.user_id === row.user_id &&
					(table === "user_setting"
						? r.key === row.key
						: r.tmdb_id === row.tmdb_id && r.media_type === row.media_type),
			)
			if (!old) rows.push(row)
			else if (!sql.includes("DO NOTHING")) {
				const created = old.created_at
				Object.assign(old, row, { created_at: created })
			}
			this.rows.set(table, rows)
		} else if (sql.startsWith("UPDATE")) {
			const [assignments, where] = sql.split(" SET ")[1].split(" WHERE ")
			let index = 0
			const changes: Row = {}
			for (const assignment of assignments.split(", ")) {
				const [column, value] = assignment.split(" = ")
				changes[column] =
					value === "CURRENT_TIMESTAMP" ? new Date() : params[index++]
			}
			for (const row of rows) {
				let param = index
				if (
					where
						.split(" AND ")
						.every(
							(condition) => row[condition.split(" = ")[0]] === params[param++],
						)
				)
					Object.assign(row, changes)
			}
		} else if (sql.startsWith("DELETE")) {
			this.rows.set(
				table,
				rows.filter(
					(r) =>
						!(
							r.user_id === params[0] &&
							r.tmdb_id === params[1] &&
							r.media_type === params[2]
						),
				),
			)
		} else throw new Error(`Unhandled: ${sql}`)
		return { json: [], rowcount: 1 }
	}
}
class Redis extends CacheTestRedis {
	async set(key: string, value: string) {
		this.values.set(key, value)
	}
	override async gwCacheReset(
		key: string,
		marker: string,
		token: string,
		ttl: number,
	) {
		events.push(`reset ${key}`)
		return super.gwCacheReset(key, marker, token, ttl)
	}
}
let events: string[]
let db: FakeCrate
let redis: Redis
const user = "member-A"
const params = { user_id: user, tmdb_id: 123, media_type: "movie" as const }
const key = (id = user) => cacheEntryKey("user-data", { user_id: id })
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
beforeEach(() => {
	events = []
	db = new FakeCrate()
	redis = new Redis()
	setCrateClientForTest(db)
	setRedisClusterForTest(redis)
	resetPendingResetsForTest()
	resetMetricsForTest()
})
afterEach(() => {
	setCrateClientForTest(null)
	setRedisClusterForTest(null)
	resetPendingResetsForTest()
})

function lastEventIndex(predicate: (event: string) => boolean) {
	for (let i = events.length - 1; i >= 0; i--)
		if (predicate(events[i])) return i
	return -1
}

function ordered(table: string, cacheKey = key()) {
	const write = lastEventIndex(
		(e) => /^(INSERT|DELETE|UPDATE)/.test(e) && e.includes(table),
	)
	const refresh = lastEventIndex(
		(e) => e.startsWith("REFRESH TABLE") && e.includes(table),
	)
	const reset = events.lastIndexOf(`reset ${cacheKey}`)
	assert.ok(write >= 0 && refresh > write && reset > refresh, events.join("\n"))
	assert.equal(redis.values.has(cacheKey), false)
	assert.ok(
		redis.calls.some(
			(c) => c.command === "gwCacheReset" && c.args[0] === cacheKey,
		),
	)
}

test("warm member reads cost one MGET and no Crate; dates survive JSON", async () => {
	await updateScores({ ...params, score: 7 })
	await updateWishList({ ...params, action: "add" })
	await updateFavorites({ ...params, action: "add" })
	await updateSkipped({ ...params, action: "add" })
	await updateWatchHistory({ ...params, action: "add" })
	db.statements.length = 0
	const first = await getUserData({ user_id: user })
	assert.equal(db.statements.length, 5)
	assert.ok(db.statements.every((s) => s.startsWith("SELECT")))
	db.statements.length = 0
	redis.calls.length = 0
	const second = await getUserData({ user_id: user })
	assert.deepEqual(second, first)
	assert.equal(db.statements.length, 0)
	assert.deepEqual(
		redis.calls.map((c) => c.command),
		["mget"],
	)
	for (const data of [first, second]) {
		for (const collection of [
			data.scores,
			data.wishlist,
			data.watched,
			data.favorites,
			data.skipped,
		])
			assert.ok(collection["movie-123"].updatedAt instanceof Date)
		assert.ok(data.wishlist["movie-123"].createdAt instanceof Date)
		assert.ok(data.wishlist["movie-123"].updatedAt instanceof Date)
	}
})
test("anonymous data and settings bypass Crate, Redis and metrics", async () => {
	const metrics = renderMetrics()
	assert.deepEqual(await getUserData({}), {
		scores: {},
		wishlist: {},
		watched: {},
		favorites: {},
		skipped: {},
	})
	assert.deepEqual(await getUserSettings({}), {})
	assert.equal(db.statements.length, 0)
	assert.equal(redis.calls.length, 0)
	assert.equal(renderMetrics(), metrics)
})
test("two warm members remain isolated even concurrently", async () => {
	await updateScores({ ...params, score: 7 })
	await updateScores({ ...params, user_id: "member-B", score: 3 })
	const a = await getUserData({ user_id: user })
	const b = await getUserData({ user_id: "member-B" })
	assert.notDeepEqual(a, b)
	assert.notEqual(key(), key("member-B"))
	assert.ok(redis.values.has(cacheEntryKey("user-data", { user_id: user })))
	assert.ok(
		redis.values.has(cacheEntryKey("user-data", { user_id: "member-B" })),
	)
	assert.deepEqual(
		await Promise.all([
			getUserData({ user_id: user }),
			getUserData({ user_id: "member-B" }),
		]),
		[a, b],
	)
})
test("updateScores set, change and remove refresh before resetting", async () => {
	for (const score of [7, 4, undefined] as const) {
		await getUserData({ user_id: user })
		await updateScores({ ...params, score })
		ordered("user_score")
		assert.equal(
			(await getUserData({ user_id: user })).scores["movie-123"]?.score,
			score,
		)
	}
})
for (const [name, table, field, write] of [
	["wishlist", "user_wishlist", "wishlist", updateWishList],
	["favorites", "user_favorite", "favorites", updateFavorites],
	["skipped", "user_skipped", "skipped", updateSkipped],
	["watchHistory", "user_watch_history", "watched", updateWatchHistory],
] as const)
	test(`${name} add and remove refresh before resetting`, async () => {
		for (const action of ["add", "remove"] as const) {
			await getUserData({ user_id: user })
			await write({ ...params, action })
			ordered(table)
			assert.equal(
				Boolean((await getUserData({ user_id: user }))[field]["movie-123"]),
				action === "add",
			)
		}
	})
test("finishTitle refreshes both writes", async () => {
	await updateWishList({ ...params, action: "add" })
	await getUserData({ user_id: user })
	await finishTitle(user, 1_000_000_000_123)
	ordered("user_watch_history")
	ordered("user_wishlist")
	const data = await getUserData({ user_id: user })
	assert.ok(data.watched["movie-123"])
	assert.equal(data.wishlist["movie-123"], undefined)
})
test("undoFinishTitle refreshes deletion and restores original wishlist date", async () => {
	await updateWishList({ ...params, action: "add" })
	const undo = await finishTitle(user, 1_000_000_000_123)
	await getUserData({ user_id: user })
	await undoFinishTitle(user, undo)
	ordered("user_watch_history")
	ordered("user_wishlist")
	const data = await getUserData({ user_id: user })
	assert.equal(data.watched["movie-123"], undefined)
	assert.equal(data.wishlist["movie-123"].createdAt.toISOString(), undo.addedAt)
})
test("settings refresh before reset and return new settings immediately", async () => {
	await getUserSettings({ userId: user })
	await setUserSettings({ user_id: user, settings: { country_default: "DE" } })
	ordered("user_setting", cacheEntryKey("user-settings", { userId: user }))
	assert.deepEqual(await getUserSettings({ userId: user }), {
		country_default: "DE",
	})
})
test("IMDb ratingsChanged refreshes and resets; apply and undo invoke it", async () => {
	await getUserData({ user_id: user })
	await upsert({
		table: "user_score",
		data: [{ ...params, score: 8 }],
		conflictColumns: ["user_id", "tmdb_id", "media_type"],
	})
	await execute(
		"UPDATE user_score SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
		[8, user, 123, "movie"],
	)
	await ratingsChanged(user)
	ordered("user_score")
	assert.equal(
		(await getUserData({ user_id: user })).scores["movie-123"].score,
		8,
	)
	const source = readFileSync(
		new URL("./imdb-import/apply.server.ts", import.meta.url),
		"utf8",
	)
	assert.match(source, /if \(wrote\) await ratingsChanged\(userId\)/)
	assert.match(
		source.slice(source.indexOf("export async function undoImport")),
		/await ratingsChanged\(userId\)/,
	)
})
test("guest import finally refreshes both caches", async () => {
	await getUserData({ user_id: user })
	await getUserSettings({ userId: user })
	for (const table of ["user_score", "user_wishlist", "user_setting"])
		await upsert({
			table,
			data: [
				table === "user_setting"
					? { user_id: user, key: "country_default", value: "US" }
					: { ...params, score: 9 },
			],
			conflictColumns: ["user_id"],
		})
	await resetGuestImportCaches(user)
	ordered("user_score")
	ordered("user_wishlist")
	ordered("user_setting", cacheEntryKey("user-settings", { userId: user }))
	const data = await getUserData({ user_id: user })
	assert.equal(data.scores["movie-123"].score, 9)
	assert.ok(data.wishlist["movie-123"])
	assert.deepEqual(await getUserSettings({ userId: user }), {
		country_default: "US",
	})
	assert.match(
		readFileSync(
			new URL("../routes/api.import-guest-interactions.ts", import.meta.url),
			"utf8",
		),
		/finally\s*\{\s*await resetGuestImportCaches\(user.id\)/,
	)
})
test("in-flight pre-write data cannot repopulate the cache", async () => {
	let release = () => {}
	let started = () => {}
	const waiting = new Promise<void>((resolve) => {
		started = resolve
	})
	const blocked = new Promise<void>((resolve) => {
		release = resolve
	})
	db.pause = async () => {
		started()
		await blocked
	}
	const pending = getUserData({ user_id: user })
	await waiting
	await updateScores({ ...params, score: 8 })
	release()
	await pending
	assert.equal(redis.values.has(key()), false)
	db.statements.length = 0
	assert.equal(
		(await getUserData({ user_id: user })).scores["movie-123"].score,
		8,
	)
	assert.equal(db.statements.length, 5)
})
for (const settings of [false, true])
	test(`failed refresh still resets and repeats after two seconds: settings=${settings}`, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		t.mock.method(console, "error", () => {})
		const read = () =>
			settings
				? getUserSettings({ userId: user })
				: getUserData({ user_id: user })
		const cacheKey = settings
			? cacheEntryKey("user-settings", { userId: user })
			: key()
		await read()
		db.failRefresh = true
		await (settings
			? resetUserSettingsCache({ user_id: user })
			: resetUserDataCache({ user_id: user }))
		assert.equal(redis.values.has(cacheKey), false)
		await read()
		assert.equal(redis.values.has(cacheKey), true)
		t.mock.timers.tick(1999)
		await tick()
		assert.equal(redis.values.has(cacheKey), true)
		db.failRefresh = false
		await execute(
			settings ? "REFRESH TABLE user_setting" : "REFRESH TABLE user_score",
		)
		t.mock.timers.tick(1)
		await tick()
		assert.equal(redis.values.has(cacheKey), false)
		assert.equal(
			redis.calls.filter(
				(c) => c.command === "gwCacheReset" && c.args[0] === cacheKey,
			).length,
			2,
		)
	})

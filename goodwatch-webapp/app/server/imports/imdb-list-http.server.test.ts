import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, it } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"
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
		if (url.endsWith("/utils/auth.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source:
					"export const getAuthFromRequest=async({request})=>({user:request.headers.get('x-fixture-member')?{id:request.headers.get('x-fixture-member')}:null,headers:new Headers()})",
			}
		return next(url, context)
	},
})
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const { getImport } = await import("./service.server.ts")
const { action: preview } = await import(
	"../../routes/api.imdb-import.preview.ts"
)
const { action: confirm } = await import(
	"../../routes/api.imports.$id.confirm.ts"
)
afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})
it("the IMDb preview HTTP API requires authenticated explicit list intent, then uses shared confirmation with rewatch consent", async () => {
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 862, imdb_id: "tt0114709", title: "Movie", release_year: 1995 },
		{ tmdb_id: 43, imdb_id: "tt1234567", title: "Show", release_year: 2020 },
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const csv = readFileSync(
		new URL(
			"../imdb-import/fixtures/imdb-watchlist-synthetic.csv",
			import.meta.url,
		),
		"utf8",
	)
	const send = (listKind: unknown, member = "member") =>
		preview({
			request: new Request("https://goodwatch.test/api/imdb-import/preview", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-fixture-member": member,
				},
				body: JSON.stringify({ fileName: "renamed.csv", csv, listKind }),
			}),
			params: {},
			context: {},
		})
	assert.equal((await send("watchlist", "")).status, 401)
	assert.equal((await send(undefined)).status, 400)
	assert.equal((await send("guess")).status, 400)
	assert.equal(db.imports.length, 0)
	const response = await send("watchlist")
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	const result = await response.json()
	assert.equal(result.import.source, "imdb_list")
	const invoke = (member: string, choice: unknown) =>
		confirm({
			request: new Request("https://goodwatch.test/confirm", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-fixture-member": member,
				},
				body: JSON.stringify({
					kinds: ["want", "rating"],
					conflictChoice: "keep",
					watchDates: "preserve",
					wishlistRewatch: choice,
				}),
			}),
			params: { id: result.import.id },
			context: {},
		})
	assert.equal((await invoke("other", true)).status, 404)
	assert.equal((await invoke("member", "true")).status, 400)
	assert.equal((await invoke("member", true)).status, 200)
	for (let i = 0; i < 100; i++) {
		if ((await getImport("member", result.import.id)).status === "done") break
		await new Promise((r) => setTimeout(r, 5))
	}
	assert.equal((await getImport("member", result.import.id)).status, "done")
	assert.equal(db.wishlist.length, 2)
})

it("requires a Ratings or Watchlist choice for legacy headers and previews the chosen meaning", async () => {
	const csv = readFileSync(
		new URL(
			"../imdb-import/fixtures/imdb-legacy-synthetic.csv",
			import.meta.url,
		),
		"utf8",
	)
	const send = (listKind?: string) =>
		preview({
			request: new Request("https://goodwatch.test/api/imdb-import/preview", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-fixture-member": "member",
				},
				body: JSON.stringify({ fileName: "old-export.csv", csv, listKind }),
			}),
			params: {},
			context: {},
		})
	const missing = await send()
	assert.equal(missing.status, 400)
	assert.match((await missing.json()).error, /old ratings or Watchlist export/i)
	let row: Record<string, unknown> | null = null
	setCrateClientForTest({
		async execute(sql: string, params: unknown[] = []) {
			const s = sql.trim().replace(/\s+/g, " ")
			if (s.startsWith("REFRESH ")) return { json: [] }
			if (s.startsWith("SELECT tmdb_id, imdb_id FROM movie "))
				return { json: [{ tmdb_id: 862, imdb_id: "tt0114709" }] }
			if (
				s.startsWith("SELECT tmdb_id, imdb_id FROM show ") ||
				s.startsWith("SELECT tmdb_id, media_type, score FROM user_score ") ||
				s.startsWith(
					"SELECT tmdb_id, media_type, applied_score FROM doc.user_import_item ",
				) ||
				/^SELECT .* FROM doc\.user_import WHERE user_id = \?/.test(s)
			)
				return { json: [] }
			if (s.startsWith("INSERT INTO doc.user_import_item ")) return { json: [] }
			if (s.startsWith("INSERT INTO doc.user_import ")) {
				row = {
					id: params[0],
					user_id: params[1],
					source: "imdb",
					status: "preview",
					file_name: params[2],
					counts: params[3],
					created_at: params[4],
					updated_at: params[5],
					processed: 0,
					total: 0,
					added: 0,
					updated: 0,
					kept: 0,
					failed: 0,
					finished_at: null,
					conflict_choice: null,
					error: null,
				}
				return { json: [] }
			}
			if (/^SELECT .* FROM doc\.user_import WHERE id = \?$/.test(s))
				return { json: row ? [row] : [] }
			throw new Error(`Unexpected legacy preview SQL: ${s}`)
		},
	})
	const ratings = await send("ratings")
	assert.equal(ratings.status, 200)
	const rated = (await ratings.json()).import
	assert.equal(rated.counts.rows, 1)
	assert.equal("source" in rated, false)
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 862, imdb_id: "tt0114709", title: "Movie", release_year: 1995 },
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	const watchlist = await send("watchlist")
	assert.equal(watchlist.status, 200)
	assert.equal((await watchlist.json()).import.kinds.want, 1)
})

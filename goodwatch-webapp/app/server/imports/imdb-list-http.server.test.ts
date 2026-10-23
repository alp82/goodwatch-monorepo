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

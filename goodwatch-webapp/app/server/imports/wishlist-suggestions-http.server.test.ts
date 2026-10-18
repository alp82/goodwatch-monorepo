import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { afterEach, it } from "node:test"
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

// Authentication is outside the importer: issue ordinary member/no-member responses at that boundary.
registerHooks({
	load(url, context, next) {
		if (url.endsWith("/utils/auth.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source: `export const getAuthFromRequest=async({request})=>({user:request.headers.get('x-fixture-member')?{id:request.headers.get('x-fixture-member')}:null,headers:new Headers()});export const getUserIdFromRequest=async()=>null;`,
			}
		return next(url, context)
	},
})
const { setImportDbForTest } = await import("./store.server.ts")
const { previewImport } = await import("./service.server.ts")
afterEach(() => setImportDbForTest())
it("protects suggestion previews and rejects unbounded or caller-supplied search parameters", async () => {
	const { loader } = await import("../../routes/api.imports.$id.suggestions.ts")
	const db = new ImportDb()
	setImportDbForTest(db)
	const parent = await previewImport(
		"member",
		"wishlist",
		"capture.json",
		new TextEncoder().encode(
			JSON.stringify({
				format: "goodwatch-wishlist",
				version: 1,
				source: "netflix",
				completeness: "unknown",
				items: [{ title: "Synthetic", mediaType: "unknown", sourceId: "123" }],
			}),
		),
	)
	const load = (query = "", member: string | null = "member", method = "GET") =>
		loader({
			request: new Request(
				`https://example.test/api/imports/${parent.id}/suggestions${query}`,
				{ method, headers: member ? { "x-fixture-member": member } : {} },
			),
			params: { id: parent.id },
			context: {},
		})
	const unauth = await load("", null)
	assert.equal(unauth.status, 401)
	assert.equal(unauth.headers.get("Cache-Control"), "private, no-store")
	for (const query of [
		"?offset=-1",
		"?offset=1.5",
		"?offset=50001",
		"?offset=0&offset=10",
		"?q=Synthetic",
		"?limit=50000",
		"?offset=9007199254740992",
	]) {
		const response = await load(query)
		assert.equal(response.status, 400, query)
		assert.equal((await response.json()).code, "wishlist_search_invalid")
	}
	const post = await load("", "member", "POST")
	assert.equal(post.status, 405)
	assert.equal((await post.json()).code, "method_not_allowed")
})

it("returns only owned read-only suggestion pages without exposing the import payload", async () => {
	const { loader } = await import("../../routes/api.imports.$id.suggestions.ts")
	const db = new ImportDb()
	setImportDbForTest(db)
	const parent = await previewImport(
		"member",
		"wishlist",
		"capture.json",
		new TextEncoder().encode(
			JSON.stringify({
				format: "goodwatch-wishlist",
				version: 1,
				source: "other-service",
				completeness: "unknown",
				items: [
					{
						title: "Private source title",
						mediaType: "unknown",
						sourceId: "local-id",
					},
				],
			}),
		),
	)
	const load = (member: string) =>
		loader({
			request: new Request(
				`https://example.test/api/imports/${parent.id}/suggestions`,
				{ headers: { "x-fixture-member": member } },
			),
			params: { id: parent.id },
			context: {},
		})
	assert.equal((await load("other-member")).status, 404)
	const response = await load("member")
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	const body = await response.json()
	assert.equal(body.total, 1)
	assert.equal(body.groups[0].state, "manual")
	assert.equal(body.groups[0].representativeIndex, 0)
	assert.equal(body.nextOffset, null)
	assert.equal(JSON.stringify(body).includes("Private source title"), false)
	assert.equal(JSON.stringify(body).includes('"payload"'), false)
})

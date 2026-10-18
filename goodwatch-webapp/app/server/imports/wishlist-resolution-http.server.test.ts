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
const { action } = await import("../../routes/api.imports.$id.resolve.ts")
const { loader } = await import("../../routes/api.imports.$id.matches.ts")
afterEach(() => setImportDbForTest())

it("authenticates the resolution HTTP boundary, bounds actual body bytes and returns stable codes alongside authored messages", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			title: "Toy Story",
			release_year: 1995,
			imdb_id: "tt0114709",
		},
	]
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
				items: [
					{ title: "Synthetic", mediaType: "unknown", sourceId: "native" },
				],
			}),
		),
	)
	const send = (
		body: string,
		member: string | null = "member",
		extraHeaders: Record<string, string> = {},
	) =>
		action({
			request: new Request(
				`https://example.test/api/imports/${parent.id}/resolve`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(member ? { "x-fixture-member": member } : {}),
						...extraHeaders,
					},
					body,
				},
			),
			params: { id: parent.id },
			context: {},
		})
	const input = JSON.stringify({
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const unauth = await send(input, null)
	assert.equal(unauth.status, 401)
	assert.equal(unauth.headers.get("Cache-Control"), "private, no-store")
	assert.equal((await send(input, "other-member")).status, 404)
	const bodyHeaders: Record<string, string>[] = [
		{},
		{ "Content-Length": "50000" },
	]
	for (const headers of bodyHeaders) {
		const oversized = await send(" ".repeat(32769), "member", headers)
		assert.equal(oversized.status, 413)
		const error = await oversized.json()
		assert.equal(error.code, "wishlist_body_too_large")
		assert.notEqual(error.error, error.code)
	}
	const invalid = await send(
		'{"choices":[{"index":0,"target":null}],"observations":[]}',
	)
	assert.equal(invalid.status, 400)
	assert.equal((await invalid.json()).code, "wishlist_resolution_invalid")
	const response = await send(input)
	assert.equal(response.status, 201)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	const body = await response.json()
	assert.equal(body.parentImportId, parent.id)
	assert.notEqual(body.import.id, parent.id)
	assert.equal(db.wishlist.length, 0)
	const groups = await loader({
		request: new Request(
			`https://example.test/api/imports/${body.import.id}/matches`,
			{ headers: { "x-fixture-member": "member" } },
		),
		params: { id: body.import.id },
		context: {},
	})
	assert.equal(groups.status, 200)
	const groupBody = await groups.json()
	assert.equal(groupBody.groups[0].item.wishlistResolution.title, "Toy Story")
	assert.equal(JSON.stringify(groupBody).includes('"payload"'), false)
	const badSearch = await loader({
		request: new Request(
			`https://example.test/api/imports/${body.import.id}/matches?index=bad&q=Toy`,
			{ headers: { "x-fixture-member": "member" } },
		),
		params: { id: body.import.id },
		context: {},
	})
	assert.equal(badSearch.status, 400)
	assert.equal((await badSearch.json()).code, "wishlist_search_invalid")
	const entry = await loader({
		request: new Request(
			`https://example.test/api/imports/${body.import.id}/matches?entry=0`,
			{ headers: { "x-fixture-member": "member" } },
		),
		params: { id: body.import.id },
		context: {},
	})
	assert.equal(entry.status, 200)
	assert.equal((await entry.json()).group.representativeIndex, 0)
	for (const extra of ["q=Toy", "index=0", "offset=0", "type=movie"]) {
		const mixed = await loader({
			request: new Request(
				`https://example.test/api/imports/${body.import.id}/matches?entry=0&${extra}`,
				{ headers: { "x-fixture-member": "member" } },
			),
			params: { id: body.import.id },
			context: {},
		})
		assert.equal(mixed.status, 400)
		assert.equal((await mixed.json()).code, "wishlist_search_invalid")
	}
})

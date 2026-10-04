// Preload CommonJS dependencies before the alias hook rewrites relative imports.
import "@remix-run/node"
import "node-crate"
import "ioredis"
import "react/jsx-runtime"
import ts from "typescript"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"

// Load the real card designs and raw SVG without rendering components.
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
		if (url.endsWith(".tsx")) {
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
import type { ListView } from "./view.server.ts"
const { createShareListPageLoader, createProfilePageLoader } = await import("./page-loaders.server.ts")
const { pageHeaders } = await import("../../utils/headers.ts")
const { applyCachePolicy } = await import("../cache-identity.server.ts")
const { SHARE_LIST_PAGE_CACHE_CONTROL } = await import("../../utils/auth-cookie.ts")

const view: ListView = {
	list: {
		id: "AbCd012345", userId: "owner", title: "Five films", promptId: null,
		design: "podium", theme: "ember", items: [{ media_type: "movie", tmdb_id: 1 }],
		visibility: "public", remixedFrom: null, contentHash: "original",
		createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
	},
	owner: { userId: "owner", handle: "filmfan" },
	titles: [{
		key: "movie:1", type: "movie", title: "One", year: 2000,
		poster: null, backdrop: null, genre: null, score: 80,
	}],
}
const args = (handle = "filmfan") => ({
	request: new Request("https://goodwatch.test/u/filmfan", {
		headers: { "GW-Cache-Identity": "anon;US;en" },
	}),
	params: { handle, id: view.list.id },
	context: {},
})
function assertPolicy(response: Response, expected: string) {
	assert.equal(response.headers.get("Cache-Control"), expected)
	const headers = new Headers(pageHeaders({
		parentHeaders: new Headers({ "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" }),
		loaderHeaders: response.headers,
		actionHeaders: new Headers(),
		errorHeaders: new Headers(),
	}))
	applyCachePolicy(args().request, response.status, headers)
	assert.equal(headers.get("Cache-Control"), expected)
	if (expected === SHARE_LIST_PAGE_CACHE_CONTROL)
		assert.equal(headers.get("GW-Cache-Identity"), "anon;US;en")
}
const listDeps = (viewerId: string | null = null, unlisted = false) => ({
	getListView: async () => ({
		...view, list: { ...view.list, visibility: unlisted ? "unlisted" as const : "public" as const },
	}),
	ensureShareCard: () => {},
	getUserIdFromRequest: async () => viewerId ?? undefined,
	getUserSettings: async () => ({ country_default: "DE", streaming_providers_default: "8" }),
	getListAvailability: async () => ({}),
})

for (const [viewerId, unlisted, isOwner] of [
	[null, false, false],
	[null, true, false],
	["member", false, false],
	["owner", false, true],
] as const)
	test(`list loader: viewer=${viewerId}, unlisted=${unlisted}`, async () => {
		let ensured = false
		const response = await createShareListPageLoader({
			...listDeps(viewerId, unlisted),
			ensureShareCard: (value) => {
				assert.equal(value.list.id, view.list.id)
				ensured = true
			},
			getListAvailability: async (items, country) => {
				assert.deepEqual(items, view.list.items)
				assert.equal(country, viewerId ? "DE" : "US")
				return {}
			},
		})(args())
		assert.equal(ensured, true)
		assertPolicy(response, viewerId == null && !unlisted ? SHARE_LIST_PAGE_CACHE_CONTROL : "private, no-store")
		const data = await response.json()
		assert.equal(data.list.unlisted, unlisted)
		assert.equal(data.isOwner, isOwner)
		assert.deepEqual(data.items, view.titles)
		if (viewerId) assert.ok(data.owned.includes(8))
	})

const hidden = { ...view.list, id: "Hidden1234", visibility: "unlisted" as const }
const profileDeps = (viewerId: string | null = null) => ({
	getProfilePage: async () => ({ profile: view.owner, lists: [view.list], titles: view.titles }),
	getUserIdFromRequest: async () => viewerId ?? undefined,
	listsByUser: async (userId: string) => {
		assert.equal(viewerId, "owner")
		assert.equal(userId, "owner")
		return [view.list, hidden]
	},
	resolveCardTitles: async () => {
		assert.equal(viewerId, "owner")
		return view.titles
	},
})
for (const viewerId of [null, "member", "owner"])
	test(`profile loader: viewer=${viewerId}`, async () => {
		const response = await createProfilePageLoader(profileDeps(viewerId))(args())
		assertPolicy(response, viewerId == null ? SHARE_LIST_PAGE_CACHE_CONTROL : "private, no-store")
		const data = await response.json()
		assert.equal(data.isOwner, viewerId === "owner")
		assert.deepEqual(data.profile, { handle: "filmfan" })
		assert.deepEqual(data.lists.map((list: { id: string }) => list.id),
			viewerId === "owner" ? [view.list.id, hidden.id] : [view.list.id])
		for (const list of data.lists) {
			assert.deepEqual(list.items, view.titles)
			assert.equal("visibility" in list, viewerId === "owner")
		}
		if (viewerId === "owner") assert.equal(data.lists[1].visibility, "unlisted")
	})

test("missing lists and profiles throw private 404 responses", async () => {
	for (const loader of [
		createShareListPageLoader({ ...listDeps(), getListView: async () => null }),
		createProfilePageLoader({ ...profileDeps(), getProfilePage: async () => null }),
	])
		await assert.rejects(() => loader(args()), (error: unknown) => {
			assert.ok(error instanceof Response)
			assert.equal(error.status, 404)
			assertPolicy(error, "private, no-store")
			return true
		})
})

test("wrong list handles and differently cased profile handles redirect permanently", async () => {
	for (const [loader, handle, path] of [
		[createShareListPageLoader(listDeps()), "wrong", `/u/filmfan/lists/${view.list.id}`],
		[createProfilePageLoader(profileDeps()), "FilmFan", "/u/filmfan"],
	] as const) {
		const response = await loader(args(handle))
		assert.equal(response.status, 301)
		assert.equal(response.headers.get("Location"), path)
	}
})

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
const { createShareListPageLoader, createProfilePageLoader } = await import(
	"./page-loaders.server.ts"
)
const { pageHeaders } = await import("../../utils/headers.ts")
const { applyCachePolicy } = await import("../cache-identity.server.ts")
const { SHARE_LIST_PAGE_CACHE_CONTROL } = await import(
	"../../utils/auth-cookie.ts"
)

const view: ListView = {
	list: {
		id: "AbCd012345",
		userId: "owner",
		title: "Five films",
		promptId: null,
		design: "podium",
		theme: "ember",
		items: [{ media_type: "movie", tmdb_id: 1 }],
		visibility: "public",
		remixedFrom: null,
		contentHash: "original",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	},
	owner: { userId: "owner", handle: "filmfan" },
	titles: [
		{
			key: "movie:1",
			type: "movie",
			title: "One",
			year: 2000,
			poster: null,
			backdrop: null,
			genre: null,
			score: 80,
		},
	],
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
	const headers = new Headers(
		pageHeaders({
			parentHeaders: new Headers({
				"Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200",
			}),
			loaderHeaders: response.headers,
			actionHeaders: new Headers(),
			errorHeaders: new Headers(),
		}),
	)
	applyCachePolicy(args().request, response.status, headers)
	assert.equal(headers.get("Cache-Control"), expected)
	if (expected === SHARE_LIST_PAGE_CACHE_CONTROL)
		assert.equal(headers.get("GW-Cache-Identity"), "anon;US;en")
}
const listDeps = (viewerId: string | null = null, unlisted = false) => ({
	getListView: async () => ({
		...view,
		list: {
			...view.list,
			visibility: unlisted ? ("unlisted" as const) : ("public" as const),
		},
	}),
	ensureShareCard: () => {},
	getUserIdFromRequest: async () => viewerId ?? undefined,
	getUserSettings: async () => ({
		country_default: "DE",
		streaming_providers_default: "8",
	}),
	getOwnServices: async () => ({}),
	getOwnerScores: async () => ({}),
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
			// Only a member with saved services needs their services: the rows show nobody else's.
			getOwnServices: async (member, titles) => {
				assert.ok(viewerId)
				assert.equal(member.country, "DE")
				assert.ok(member.services.includes(8))
				assert.deepEqual(
					titles,
					view.list.items.map((e) => ({
						mediaType: e.media_type,
						tmdbId: e.tmdb_id,
					})),
				)
				return { "movie-1": [{ id: 8, name: "Service 8", logoPath: "/8.png" }] }
			},
			// The owner's score ends the rows of someone else's list.
			getOwnerScores: async (ownerId, viewer, entries) => {
				assert.equal(isOwner, false)
				assert.equal(ownerId, "owner")
				assert.equal(viewer, viewerId ? "member" : "guest")
				assert.deepEqual(entries, view.list.items)
				return { "movie:1": 7 }
			},
		})(args())
		assert.equal(ensured, true)
		assertPolicy(
			response,
			viewerId == null && !unlisted
				? SHARE_LIST_PAGE_CACHE_CONTROL
				: "private, no-store",
		)
		const data = await response.json()
		assert.equal(data.list.unlisted, unlisted)
		assert.equal(data.isOwner, isOwner)
		assert.deepEqual(data.items, view.titles)
		assert.deepEqual(
			data.services,
			viewerId
				? { "movie:1": [{ id: 8, name: "Service 8", logoPath: "/8.png" }] }
				: null,
		)
		assert.deepEqual(data.ownerScores, isOwner ? null : { "movie:1": 7 })
	})

const overview = (list: ListView["list"]) => {
	const { collection, ...rest } = list
	return {
		...rest,
		items: list.items.slice(0, 5),
		itemCount: list.items.length,
		isCollection: !!collection,
	}
}
const hidden = {
	...view.list,
	id: "Hidden1234",
	visibility: "unlisted" as const,
}
const profileDeps = (viewerId: string | null = null) => ({
	getProfilePage: async () => ({
		profile: view.owner,
		lists: [overview(view.list)],
		titles: view.titles,
	}),
	getUserIdFromRequest: async () => viewerId ?? undefined,
	listsByUser: async (userId: string) => {
		assert.equal(viewerId, "owner")
		assert.equal(userId, "owner")
		return [overview(view.list), overview(hidden)]
	},
	resolveCardTitles: async () => {
		assert.equal(viewerId, "owner")
		return view.titles
	},
})
for (const viewerId of [null, "member", "owner"])
	test(`profile loader: viewer=${viewerId}`, async () => {
		const response = await createProfilePageLoader(profileDeps(viewerId))(
			args(),
		)
		assertPolicy(
			response,
			viewerId == null ? SHARE_LIST_PAGE_CACHE_CONTROL : "private, no-store",
		)
		const data = await response.json()
		assert.equal(data.isOwner, viewerId === "owner")
		assert.deepEqual(data.profile, { handle: "filmfan" })
		assert.deepEqual(
			data.lists.map((list: { id: string }) => list.id),
			viewerId === "owner" ? [view.list.id, hidden.id] : [view.list.id],
		)
		for (const list of data.lists) {
			assert.deepEqual(list.items, view.titles)
			assert.equal("visibility" in list, viewerId === "owner")
		}
		if (viewerId === "owner") assert.equal(data.lists[1].visibility, "unlisted")
	})

test("missing lists and profiles throw private 404 responses", async () => {
	for (const loader of [
		createShareListPageLoader({ ...listDeps(), getListView: async () => null }),
		createProfilePageLoader({
			...profileDeps(),
			getProfilePage: async () => null,
		}),
	])
		await assert.rejects(
			() => loader(args()),
			(error: unknown) => {
				assert.ok(error instanceof Response)
				assert.equal(error.status, 404)
				assertPolicy(error, "private, no-store")
				return true
			},
		)
})

test("wrong list handles and differently cased profile handles redirect permanently", async () => {
	for (const [loader, handle, path] of [
		[
			createShareListPageLoader(listDeps()),
			"wrong",
			`/u/filmfan/lists/${view.list.id}`,
		],
		[createProfilePageLoader(profileDeps()), "FilmFan", "/u/filmfan"],
	] as const) {
		const response = await loader(args(handle))
		assert.equal(response.status, 301)
		assert.equal(response.headers.get("Location"), path)
	}
})

test("an imported list is owner-only until shared, shows all ordered titles and source notes, and does not need a handle", async () => {
	const { createCollectionPageLoader } = await import(
		"./collection-page.server.ts"
	)
	let viewer: string | undefined
	let titlesRead = 0
	const list: ListView["list"] = {
		...view.list,
		visibility: "private",
		collection: {
			description: "Source description",
			notes: { "movie:1": "Source note" },
		},
	}
	const load = createCollectionPageLoader({
		getList: async () => list,
		getUserIdFromRequest: async () => viewer,
		resolveCardTitles: async () => {
			titlesRead++
			return view.titles
		},
	})
	for (const user of [undefined, "another-member"]) {
		viewer = user
		await assert.rejects(
			load(args()),
			(error: unknown) => error instanceof Response && error.status === 404,
		)
	}
	assert.equal(titlesRead, 0)
	viewer = "owner"
	const response = await load(args())
	assertPolicy(response, "private, no-store")
	const data = await response.json()
	assert.ok(data.list.collection)
	assert.equal(data.list.collection.notes?.["movie:1"], "Source note")
	list.visibility = "unlisted"
	viewer = undefined
	assert.equal((await load(args())).status, 200)
})

test("My lists shows a members imported private lists without forcing a handle or the five-title editor", async () => {
	const { createMyListsPageLoader } = await import(
		"./collection-page.server.ts"
	)
	const load = createMyListsPageLoader({
		getUserIdFromRequest: async () => "owner",
		getProfileByUserId: async () => null,
		listsByUser: async (user) => {
			assert.equal(user, "owner")
			return [
				{
					...view.list,
					visibility: "private" as const,
					collection: { description: "", notes: {} },
				},
			].map(overview)
		},
	})
	const response = await load(args())
	assert.equal(response.status, 200)
	assertPolicy(response, "private, no-store")
	const data = await response.json()
	assert.equal(data.lists[0].id, view.list.id)
	assert.equal(data.lists[0].title, "Five films")
})

test("profile cards keep imported-list previews small while reporting the full list size", async () => {
	const list = {
		...view.list,
		collection: { description: "", notes: {} },
		items: Array.from({ length: 6 }, (_, at) => ({
			media_type: "movie" as const,
			tmdb_id: at + 1,
		})),
	}
	const load = createProfilePageLoader({
		getProfilePage: async () => ({
			profile: view.owner,
			lists: [overview(list)],
			titles: view.titles,
		}),
		getUserIdFromRequest: async () => "owner",
		listsByUser: async () => [overview(list)],
		resolveCardTitles: async (entries) => {
			assert.equal(entries.length, 5)
			return view.titles
		},
	})
	const data = await (await load(args())).json()
	assert.equal(data.lists[0].collection, true)
	assert.equal(data.lists[0].itemCount, 6)
})

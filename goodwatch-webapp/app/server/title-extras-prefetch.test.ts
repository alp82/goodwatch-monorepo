// Loaded before the alias hook, which rewrites relative imports.
import "@tanstack/react-query"
import assert from "node:assert/strict"
import { test } from "node:test"

import "./title-filter/test-alias.ts"
const { prefetchTitleExtras: prefetchTitleExtrasState } = await import(
	"./title-extras-prefetch.ts"
)
const {
	genreLinksOf,
	genreLinksQueryKey,
	mergeDehydratedStates,
	movieCollectionQueryKey,
} = await import("../utils/title-extras.ts")

const ALL = [
	{ id: 28, name: "Action" },
	{ id: 18, name: "Drama" },
	{ id: 878, name: "Science Fiction" },
]
const collection = async ({ collectionId }: { collectionId: string }) => ({
	collectionId,
	movies: [{ tmdb_id: 603, title: "The Matrix" }] as never[],
})
const keysOf = (state: { queries: { queryKey: readonly unknown[] }[] }) =>
	state.queries.map((query) => query.queryKey)

test("genre links keep the list's order and only the named genres", () => {
	assert.deepEqual(
		genreLinksOf(ALL, ["Science Fiction", "Action", "Unknown"]),
		[
			{ id: 28, name: "Action" },
			{ id: 878, name: "Science Fiction" },
		],
	)
})

test("the state holds the header's genre links and the collection under the hooks' keys", async () => {
	const state = await prefetchTitleExtrasState({
		genres: ["Action", "Science Fiction", "Drama"],
		movieSeries: { id: 2344, movie_ids: [603, 604] },
		budgetMs: 1000,
		lookups: { genres: async () => ALL, collection },
	})
	assert.deepEqual(keysOf(state), [
		[...genreLinksQueryKey(["Action", "Science Fiction"])],
		[...movieCollectionQueryKey("2344", "603,604")],
	])
	assert.deepEqual(state.queries[0].state.data, [
		{ id: 28, name: "Action" },
		{ id: 878, name: "Science Fiction" },
	])
	assert.equal(
		(state.queries[1].state.data as { collectionId: string }).collectionId,
		"2344",
	)
})

test("a title without genres or a collection gets an empty state and no lookup", async () => {
	let calls = 0
	const state = await prefetchTitleExtrasState({
		genres: [],
		movieSeries: null,
		budgetMs: 1000,
		lookups: {
			genres: async () => {
				calls++
				return ALL
			},
			collection: async (params) => {
				calls++
				return collection(params)
			},
		},
	})
	assert.deepEqual(state.queries, [])
	assert.equal(calls, 0)
})

test("a failed lookup is left out and the other one stays", async (t) => {
	t.mock.method(console, "error", () => {})
	const state = await prefetchTitleExtrasState({
		genres: ["Action"],
		movieSeries: { id: 2344, movie_ids: [603] },
		budgetMs: 1000,
		lookups: {
			genres: async () => ALL,
			collection: async () => {
				throw new Error("Crate is down")
			},
		},
	})
	assert.deepEqual(keysOf(state), [[...genreLinksQueryKey(["Action"])]])
})

test("a lookup slower than the budget is left out", async () => {
	let release: () => void = () => {}
	const slow = new Promise<void>((resolve) => {
		release = resolve
	})
	const started = Date.now()
	const state = await prefetchTitleExtrasState({
		genres: ["Action"],
		movieSeries: { id: 2344, movie_ids: [603] },
		budgetMs: 20,
		lookups: {
			genres: async () => ALL,
			collection: async (params) => {
				await slow
				return collection(params)
			},
		},
	})
	release()
	assert.ok(Date.now() - started < 500)
	assert.deepEqual(keysOf(state), [[...genreLinksQueryKey(["Action"])]])
})

test("merged states keep every query", () => {
	const a = { mutations: [], queries: [{ queryKey: ["a"] }] } as never
	const b = { mutations: [], queries: [{ queryKey: ["b"] }] } as never
	assert.deepEqual(keysOf(mergeDehydratedStates(a, null, b)), [["a"], ["b"]])
})

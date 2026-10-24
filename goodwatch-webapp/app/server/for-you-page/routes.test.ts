import "@remix-run/node"
import "zod"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const state = {
	userId: null as string | null,
	progress: null as unknown,
	keys: [] as number[],
	language: undefined as string | undefined,
}
Object.assign(globalThis, { forYouRouteTest: state })
const stubs: Record<string, string> = {
	"~/server/media-payload.server":
		"export const presentCatalogLoader = load => load; export const apiDisplayLanguage = request => new URL(request.url).searchParams.get('displayLanguage') ?? undefined; export const liveMediaLanguage = async () => 'de'",
	"~/utils/auth":
		"export async function getUserIdFromRequest() { return globalThis.forYouRouteTest.userId }",
	"~/server/viewer.server":
		"export async function getViewerContext() { return {viewer:{kind:'member',userId:'test'}} }",
	"~/server/taste/index.server":
		"export async function loadTaste() { return {} }",
	"~/server/for-you-page/details.server":
		"export async function getForYouDetails(ctx,taste,keys) { globalThis.forYouRouteTest.keys = keys; globalThis.forYouRouteTest.language = ctx.language; return {} }",
	"~/server/for-you-page/page.server":
		"export async function loadForYouGuest(request, progress) { globalThis.forYouRouteTest.progress = progress; return {taste:null,posters:[],guestRatings:0} }",
}
const { registerHooks } = nodeModule as unknown as {
	registerHooks: (hooks: {
		resolve: (
			specifier: string,
			context: { parentURL?: string },
			next: (specifier: string, context: unknown) => unknown,
		) => unknown
	}) => void
}
registerHooks({
	resolve(specifier, context, next) {
		const source = stubs[specifier]
		return source
			? next(`data:text/javascript,${encodeURIComponent(source)}`, context)
			: next(specifier, context)
	},
})
const pool = await import("../../routes/api.for-you.pool.ts")
const details = await import("../../routes/api.for-you.details.ts")
const args = (request: Request) => ({ request, params: {}, context: {} })
const url = "http://localhost/api/for-you/pool"

test("pool API requires a member for GET and validates guest POST bodies and size", async () => {
	const get = await pool.loader(args(new Request(url)))
	assert.equal(get.status, 401)
	const post = await pool.action(
		args(
			new Request(url, {
				method: "POST",
				body: JSON.stringify({
					guest: { interactions: [], country: "DE", services: [8] },
				}),
			}),
		),
	)
	assert.equal(post.status, 200)
	assert.equal(post.headers.get("Cache-Control"), "private, no-store")
	assert.deepEqual(await post.json(), {
		taste: null,
		posters: [],
		guestRatings: 0,
	})
	assert.deepEqual(state.progress, {
		interactions: [],
		country: "DE",
		services: [8],
	})
	for (const body of [
		"{",
		JSON.stringify({ guest: { interactions: "bad" } }),
		" ".repeat(256 * 1024 + 1),
	]) {
		assert.equal(
			(await pool.action(args(new Request(url, { method: "POST", body }))))
				.status,
			400,
		)
	}
	assert.equal(
		(await pool.action(args(new Request(url, { method: "PUT" })))).status,
		405,
	)
	state.userId = "test"
	assert.equal((await pool.loader(args(new Request(url)))).status, 200)
})

test("details API locks guests, validates batches and converts title keys", async () => {
	const make = (keys: string) =>
		args(new Request(`http://localhost/api/for-you/details?keys=${keys}`))
	state.userId = null
	assert.equal((await details.loader(make("movie-1"))).status, 401)
	state.userId = "test"
	for (const keys of [
		"",
		"movie-0",
		"movie-1,invalid",
		"movie-1000000000000",
		Array(13).fill("movie-1").join(","),
	])
		assert.equal((await details.loader(make(keys))).status, 400)
	const response = await details.loader(make("movie-1,show-2,movie-1"))
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	assert.deepEqual(state.keys, [1e12 + 1, 2e12 + 2])
	assert.equal(state.language, "de")
	await details.loader(make("movie-1&displayLanguage=fr"))
	assert.equal(state.language, "fr")
})

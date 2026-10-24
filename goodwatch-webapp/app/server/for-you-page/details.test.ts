import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { Taste } from "../taste/index.server.ts"
import type { ViewerContext } from "../viewer.server.ts"

const state = {
	queries: [] as { sql: string; params: unknown[] }[],
	overlays: [] as string[],
	reads: [] as string[],
}
Object.assign(globalThis, { forYouDetailTest: state })
const stubs: Record<string, string> = {
	"~/utils/crate": `export async function query(sql, params) { globalThis.forYouDetailTest.queries.push({sql,params}); return params[0].map(tmdb_id => ({tmdb_id,overview:'Canonical overview'})) }`,
	"~/utils/cache":
		"export const withRedisDeadline = p => p; export const getRedisCluster = () => ({ get: async key => { globalThis.forYouDetailTest.reads.push(key); return null } });",
	"~/server/media-overlay.server": `export async function overlayTitles(rows, language) { globalThis.forYouDetailTest.overlays.push(language); return rows.map(r => ({...r,title:'Localized title',overview:'Localized overview'})) }`,
	"~/server/title-cards.server": `export async function getTitleCards(keys) { return keys.map(key => ({key,media_type:key>=2e12?'show':'movie',tmdb_id:key%1e12,title:'Title',poster_path:'/poster',backdrop_path:'/backdrop',runtime:90,tagline:'Tagline',services:[]})) }`,
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
const { getForYouDetails, readOverviews } = await import("./details.server.ts")

test("details batch primary-key reads, localize overview and reuse memory without writes", async () => {
	const ctx = { language: "de" } as ViewerContext
	const result = await getForYouDetails(ctx, {} as Taste, [1e12 + 1, 2e12 + 2])
	assert.equal(result["movie-1"].overview, "Localized overview")
	assert.equal(result["show-2"].title, "Localized title")
	assert.equal(result["movie-1"].runtime, 90)
	assert.equal(state.queries.length, 2)
	assert.ok(
		state.queries.every(
			(q) =>
				q.sql.startsWith("SELECT") &&
				q.sql.includes("synopsis AS overview") &&
				q.sql.includes("tmdb_id = ANY(?)"),
		),
	)
	assert.deepEqual(state.reads, [
		"for-you-overview:v1:1000000000001",
		"for-you-overview:v1:2000000000002",
	])
	await readOverviews([1e12 + 1, 2e12 + 2])
	assert.equal(state.queries.length, 2)
	assert.equal(state.reads.length, 2)
	await assert.rejects(readOverviews(Array(13).fill(1e12 + 1)), RangeError)
})

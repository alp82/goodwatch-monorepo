// The multi-title writers behind MCP batches: Wishlist and Not interested changes for many titles go out as one
// statement per change and media type, and a deferred scope collapses the member data resets of many writes into
// one. Against a Crate stand-in that records statements; made-up IDs only.
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
import { beforeEach, test } from "node:test"

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
		else if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => null`
		if (source === undefined) return next(url, context)
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
	},
})
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { holdTasteRebuildsForTest } = await import("./taste/member.server.ts")
holdTasteRebuildsForTest()
const { setCrateClientForTest } = await import("../utils/crate.ts")
const { updateWishList } = await import("./wishList.server.ts")
const { updateWishListMany, updateNotInterestedMany } = await import(
	"./library-many.server.ts"
)
const { withDeferredUserDataReset, resetUserDataCache } = await import(
	"./userData.server.ts"
)

const statements: { sql: string; params: unknown[] }[] = []
beforeEach(() => {
	statements.length = 0
	setCrateClientForTest({
		async execute(raw, params = []) {
			const sql = raw.trim().replace(/\s+/g, " ")
			statements.push({ sql, params })
			const tuples = sql.startsWith("INSERT")
				? (sql.match(/\(\?/g)?.length ?? 0)
				: sql.startsWith("DELETE")
					? Math.max(0, params.length - 2)
					: 1
			return { json: [], rowcount: tuples }
		},
	})
})
const of = (prefix: string) =>
	statements.filter((statement) => statement.sql.startsWith(prefix))
const MEMBER = "member-test"

test("Adding 50 titles to the Wishlist is one insert, one Not interested clear per media type and one reset", async () => {
	const titles = [
		...Array.from({ length: 40 }, (_, i) => ({
			tmdb_id: 500 + i,
			media_type: "movie" as const,
		})),
		...Array.from({ length: 10 }, (_, i) => ({
			tmdb_id: 900 + i,
			media_type: "show" as const,
		})),
	]
	const result = await updateWishListMany({
		user_id: MEMBER,
		titles: [...titles, titles[0]],
		action: "add",
	})
	assert.equal(result.rowcount, 50)
	const inserts = of("INSERT INTO user_wishlist")
	assert.equal(inserts.length, 1)
	assert.match(
		inserts[0].sql,
		/ON CONFLICT \("user_id", "tmdb_id", "media_type"\) DO NOTHING$/,
	)
	assert.equal(inserts[0].params.length, 50 * 5, "duplicates are written once")
	assert.deepEqual(
		of("DELETE FROM user_not_interested").map((s) => s.params.slice(0, 2)),
		[
			[MEMBER, "movie"],
			[MEMBER, "show"],
		],
	)
	assert.equal(
		of("REFRESH TABLE user_score").length,
		1,
		"one member data refresh",
	)
})

test("Removing many Wishlist titles and setting Not interested take one statement per media type", async () => {
	await updateWishListMany({
		user_id: MEMBER,
		titles: [
			{ tmdb_id: 501, media_type: "movie" },
			{ tmdb_id: 502, media_type: "movie" },
			{ tmdb_id: 901, media_type: "show" },
		],
		action: "remove",
	})
	assert.deepEqual(
		of("DELETE FROM user_wishlist").map((s) => s.params),
		[
			[MEMBER, "movie", 501, 502],
			[MEMBER, "show", 901],
		],
	)
	statements.length = 0
	await updateNotInterestedMany({
		user_id: MEMBER,
		titles: [
			{ tmdb_id: 503, media_type: "movie" },
			{ tmdb_id: 902, media_type: "show" },
		],
		action: "add",
	})
	assert.equal(of("INSERT INTO user_not_interested").length, 1)
	assert.equal(
		of("DELETE FROM user_wishlist").length,
		2,
		"set takes them off the Wishlist",
	)
	assert.equal(of("REFRESH TABLE user_score").length, 1)
})

test("A deferred scope holds every member data reset back to one at its end", async () => {
	let refreshesInside = -1
	await withDeferredUserDataReset(async () => {
		for (const tmdb_id of [601, 602, 603])
			await updateWishList({
				user_id: MEMBER,
				tmdb_id,
				media_type: "movie",
				action: "add",
			})
		await resetUserDataCache({ user_id: MEMBER })
		refreshesInside = of("REFRESH TABLE user_score").length
	})
	assert.equal(refreshesInside, 0)
	assert.equal(of("REFRESH TABLE user_score").length, 1)
	// Outside a scope, every reset refreshes at once, as before.
	await resetUserDataCache({ user_id: MEMBER })
	assert.equal(of("REFRESH TABLE user_score").length, 2)
})

test("A deferred scope still resets when its work throws", async () => {
	await assert.rejects(
		withDeferredUserDataReset(async () => {
			await resetUserDataCache({ user_id: MEMBER })
			throw new Error("write failed")
		}),
		/write failed/,
	)
	assert.equal(of("REFRESH TABLE user_score").length, 1)
})

import "node-crate"
import "ioredis"
import "react"
import "@remix-run/node"
import "zod"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { moneyHeist } from "./episode-fixtures.test-support.ts"
import type { Param } from "./store.server.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"

// The same Node-only auth/snapshot shims as tracking.test.ts. The resolver,
// parser, preview, journal reads and tracking planner all run their real code.
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
		if (url.endsWith("/utils/auth.ts"))
			source =
				'export const getUserIdFromRequest = () => { throw new Error("Unexpected auth") }; export const getAuthFromRequest = getUserIdFromRequest'
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
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { previewImport, getImportItems } = await import("./service.server.ts")

test("Trakt preview keeps canonical TMDB identities and reports specials without dropping them", async (t) => {
	const catalog = [
		{
			tmdb_id: 101,
			show_id: 1668,
			season_number: 4,
			episode_number: 23,
			name: "The One with Ross's Wedding",
			tvdb_id: null,
		},
		{
			tmdb_id: 201,
			show_id: 2316,
			season_number: 4,
			episode_number: 14,
			name: "Goodbye, Toby",
			tvdb_id: null,
		},
		...moneyHeist,
	]
	type Row = Record<string, unknown>
	const imports: Row[] = []
	const items: Row[] = []
	setCrateClientForTest(new FakeTrackingCrate())
	setImportDbForTest({
		select: async <T extends {}>(sql: string, params: Param[]) => {
			let result: Row[]
			if (sql.includes("FROM show WHERE"))
				result = [{ tmdb_id: 1668 }, { tmdb_id: 2316 }, { tmdb_id: 71446 }]
			else if (sql.includes("FROM episode WHERE"))
				result = catalog
					.filter((e) => e.show_id === params[0])
					.map((e) => ({ ...e }))
			else if (sql.includes("FROM doc.user_import WHERE"))
				result = imports.filter((r) => r.id === params[0])
			else if (sql.includes("FROM doc.user_import_item"))
				result = items.filter((r) => r.import_id === params[0])
			else if (/FROM user_(score|wishlist|favorite|watch_log)/.test(sql))
				result = []
			else throw new Error(`Unexpected SELECT: ${sql}`)
			return result as T[]
		},
		run: async (sql, params) => {
			if (sql.startsWith("REFRESH")) return { rowcount: 0 }
			if (sql.startsWith("INSERT INTO doc.user_import_item")) {
				const columns = sql
					.slice(sql.indexOf("(") + 1, sql.indexOf(")"))
					.split(",")
				for (let i = 0; i < params.length; i += columns.length)
					items.push(
						Object.fromEntries(
							columns.map((column, j) => [column, params[i + j]]),
						),
					)
			} else if (sql.startsWith("INSERT INTO doc.user_import ")) {
				imports.push({
					id: params[0],
					user_id: params[1],
					source: params[2],
					status: "preview",
					file_name: params[3],
					counts: params[4],
					total: params[5],
					created_at: params[6],
					updated_at: params[7],
					warnings: params[8],
					kinds: params[9],
					finished_at: null,
					options: null,
				})
			} else throw new Error(`Unexpected write: ${sql}`)
			return { rowcount: 1 }
		},
	})
	t.after(() => {
		setImportDbForTest()
		setCrateClientForTest(null)
	})
	t.mock.method(globalThis, "fetch", async () => {
		throw new Error("Trakt must not require TMDB requests")
	})
	const row = (
		historyId: number,
		show: number,
		episodeId: number | null,
		season: number,
		episode: number,
	) => ({
		id: historyId,
		type: "episode",
		watched_at: "2024-01-02T12:00:00Z",
		show: { title: "Show", year: 1994, ids: { tmdb: show } },
		episode: { season, number: episode, ids: { tmdb: episodeId } },
	})
	const zip = zipFixture({
		"watched-history-1.json": JSON.stringify([
			row(1, 1668, 101, 4, 24),
			row(2, 2316, 201, 4, 19),
			row(3, 71446, 1014, 2, 1),
			row(4, 1668, 999, 4, 23),
			row(5, 2316, null, 4, 14),
		]),
	})
	const summary = await previewImport("member", "trakt", "trakt.zip", zip)
	const receipt = await getImportItems("member", summary.id, undefined, 0, 50)
	assert.deepEqual(
		receipt.items.map((i) => [i.outcome, i.episodeTmdbId, i.season, i.episode]),
		[
			["new", 101, 4, 23],
			["new", 201, 4, 14],
			["new", 1014, 0, 14],
			["unmatched", 999, 4, 23],
			["new", 201, 4, 14],
		],
	)
	assert.equal(summary.counts.new, 4)
	assert.equal(summary.counts.unmatched, 1)
	assert.equal(receipt.items[2].episodeSpecial, true)
	assert.match(receipt.items[2].reason ?? "", /special/i)
	assert.ok(summary.warnings.some((w) => /special/i.test(w)))
	assert.match(receipt.items[3].reason ?? "", /episode ID/i)
})

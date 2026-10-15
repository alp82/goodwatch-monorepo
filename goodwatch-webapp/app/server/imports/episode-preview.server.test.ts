import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { friends, moneyHeist, office } from "./episode-fixtures.test-support.ts"
import type { Param } from "./store.server.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { previewImport, getImportItems } = await import("./service.server.ts")

test("Trakt preview keeps canonical TMDB identities and reports specials without dropping them", async (t) => {
	const catalog = [...friends, ...office, ...moneyHeist]

	type Row = Record<string, unknown>
	const imports: Row[] = []
	const items: Row[] = []
	const trackingDb = new FakeTrackingCrate()
	setCrateClientForTest(trackingDb)
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
			["new", 101, 4, 23],
			["new", 201, 4, 14],
		],
	)
	assert.equal(summary.counts.new, 5)
	assert.equal(summary.counts.unmatched, 0)
	assert.equal(receipt.items[2].episodeSpecial, true)
	assert.match(receipt.items[2].reason ?? "", /special/i)
	assert.ok(summary.warnings.some((w) => /special/i.test(w)))
	assert.equal(receipt.items[3].reason, null)
	assert.equal("episodeSpecial" in receipt.items[0], false)
	assert.equal(receipt.items[0].episodeNumbering, "tmdb")
	const { importWatchId } = await import("./tracking.server.ts")
	trackingDb.seed("user_watch_log", [
		{
			user_id: "member",
			watch_id: importWatchId("trakt", "trakt:watch:3"),
			media_type: "show",
			tmdb_id: 71446,
			episode_tmdb_id: 1014,
			season_number: 0,
			episode_number: 14,
			watched_at: Date.parse("2024-01-02T12:00:00Z"),
			watched_at_precision: "moment",
			origin: "import",
			import_id: "earlier",
			group_id: null,
			pass: 1,
			created_at: Date.now(),
			updated_at: Date.now(),
		},
	])
	const repeated = await previewImport("member", "trakt", "trakt.zip", zip)
	const repeatedItems = await getImportItems(
		"member",
		repeated.id,
		undefined,
		0,
		50,
	)
	assert.equal(repeatedItems.items[2].outcome, "unchanged")
	assert.equal(
		repeatedItems.items[2].reason,
		"This episode maps to a TMDB special. It is imported but does not count toward regular show progress. This watch is already in your GoodWatch watch log.",
	)
})

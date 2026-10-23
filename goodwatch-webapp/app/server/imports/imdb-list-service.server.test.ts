import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { afterEach, it } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { getImportItems, confirmImport, getImport, undoImport } = await import(
	"./service.server.ts"
)
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const { clearResultCacheForTest } = await import("./result-catalog.server.ts")
const fixture = readFileSync(
	new URL(
		"../imdb-import/fixtures/imdb-watchlist-synthetic.csv",
		import.meta.url,
	),
	"utf8",
)
const { createImdbFilePreview } = await import(
	"../imdb-import/dispatch.server.ts"
)

afterEach(() => {
	clearResultCacheForTest()
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})

function setup() {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Synthetic movie",
			release_year: 1995,
		},
		{
			tmdb_id: 43,
			imdb_id: "tt1234567",
			title: "Synthetic show",
			release_year: 2020,
		},
	]
	db.watches = [{ user_id: "member", tmdb_id: 862, media_type: "movie" }]
	const tracking = new FakeTrackingCrate()
	tracking.seed("user_watch_log", [
		{
			user_id: "member",
			watch_id: "prior-watch",
			media_type: "movie",
			tmdb_id: 862,
			episode_tmdb_id: null,
			season_number: null,
			episode_number: null,
			watched_at: Date.parse("2015-01-01"),
			watched_at_precision: "day",
			origin: "single",
			import_id: null,
			group_id: null,
			pass: 1,
			created_at: 1,
			updated_at: 1,
		},
	])
	setImportDbForTest(db)
	setCrateClientForTest(tracking)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	return { db, tracking }
}
async function finished(id: string) {
	for (let i = 0; i < 200; i++) {
		const result = await getImport("member", id)
		if (result.status === "done" || result.status === "failed") return result
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail("Import did not finish")
}
it("previews IMDb Watchlist wants and ratings, requires separate rewatch consent, preserves Created dates, and undoes only its writes", async () => {
	for (const wishlistRewatch of [false, true]) {
		const { db, tracking } = setup()
		const preview = await createImdbFilePreview(
			"member",
			"watchlist.csv",
			fixture,
			"watchlist",
		)
		assert.ok("source" in preview)
		if (!("source" in preview)) assert.fail("Expected the shared list preview")
		assert.equal(preview.source, "imdb_list")
		assert.equal(preview.kinds.want, 2)
		assert.equal(preview.kinds.rating, 1)
		assert.equal(preview.wishlistRewatchChoiceCount, 1)
		if (process.env.IMDB_PREVIEW_OUTPUT) {
			writeFileSync(process.env.IMDB_PREVIEW_OUTPUT, JSON.stringify(preview))
			writeFileSync(
				`${process.env.IMDB_PREVIEW_OUTPUT}.items.json`,
				JSON.stringify(
					await getImportItems("member", preview.id, undefined, 0, 200),
				),
			)
		}
		await confirmImport("member", preview.id, {
			kinds: ["want", "rating"],
			conflictChoice: "keep",
			wishlistRewatch,
			watchDates: "preserve",
		})
		assert.equal((await finished(preview.id)).status, "done")
		assert.equal(db.wishlist.length, wishlistRewatch ? 2 : 1)
		assert.equal(
			new Date(
				String(db.wishlist.find((row) => row.tmdb_id === 43)?.created_at),
			)
				.toISOString()
				.slice(0, 10),
			"2022-05-06",
		)
		if (wishlistRewatch)
			assert.equal(
				new Date(
					String(db.wishlist.find((row) => row.tmdb_id === 862)?.created_at),
				)
					.toISOString()
					.slice(0, 10),
				"2020-02-01",
			)
		assert.equal(db.scores[0].score, 7)
		assert.deepEqual(
			tracking.table("user_watch_log").map((row) => row.watch_id),
			["prior-watch"],
		)
		await undoImport("member", preview.id)
		assert.equal(db.wishlist.length, 0)
		assert.equal(db.scores.length, 0)
		assert.deepEqual(
			tracking.table("user_watch_log").map((row) => row.watch_id),
			["prior-watch"],
		)
	}
})

it("never treats an unconfirmed list-shaped IMDb file as Watchlist and keeps custom-list membership out of Want to See", async () => {
	const { db } = setup()
	await assert.rejects(
		createImdbFilePreview("member", "watchlist.csv", fixture),
		/same columns/,
	)
	assert.equal(db.imports.length, 0)
	const preview = await createImdbFilePreview(
		"member",
		"watchlist.csv",
		fixture,
		"custom-list",
	)
	assert.ok("source" in preview)
	if (!("source" in preview)) assert.fail("Expected native list preview")
	assert.equal(preview.kinds.want, 0)
	await confirmImport("member", preview.id, {
		kinds: ["want", "rating"],
		conflictChoice: "keep",
		wishlistRewatch: true,
		watchDates: "preserve",
	})
	assert.equal((await finished(preview.id)).status, "done")
	assert.equal(db.wishlist.length, 0)
	assert.equal(db.scores[0].score, 7)
	await undoImport("member", preview.id)
	assert.equal(db.scores.length, 0)
})

it("offers Seen shows as rewatch wishes while keeping their show status and original source added date", async () => {
	const { db, tracking } = setup()
	tracking.seed("user_watch_state", [
		{
			user_id: "member",
			media_type: "show",
			tmdb_id: 43,
			state: "seen",
			pass: 1,
			state_changed_at: 1,
			seen_press_group: null,
			seen_press_from: null,
			rate_prompt_dismissed_at: null,
			seen_question: "answered",
			created_at: 1,
			updated_at: 1,
		},
	])
	const preview = await createImdbFilePreview(
		"member",
		"watchlist.csv",
		fixture,
		"watchlist",
	)
	assert.ok("source" in preview)
	if (!("source" in preview)) assert.fail("Expected list preview")
	assert.equal(preview.wishlistRewatchChoiceCount, 2)
	await confirmImport("member", preview.id, {
		kinds: ["want"],
		conflictChoice: "keep",
		wishlistRewatch: true,
		watchDates: "preserve",
	})
	assert.equal((await finished(preview.id)).status, "done")
	assert.equal(db.wishlist.length, 2)
	assert.equal(tracking.table("user_watch_state")[0].state, "seen")
	await undoImport("member", preview.id)
	assert.equal(db.wishlist.length, 0)
	assert.equal(tracking.table("user_watch_state")[0].state, "seen")
})

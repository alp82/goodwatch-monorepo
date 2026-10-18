import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, it } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { previewImport, getImportItems, confirmImport, getImport, undoImport } =
	await import("./service.server.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const { clearResultCacheForTest } = await import("./result-catalog.server.ts")

afterEach(() => {
	clearResultCacheForTest()
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})

it("uploads shared Wishlist JSON, reviews typed title-year matches, confirms only wishes and safely undoes them", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const file = new TextEncoder().encode(
		JSON.stringify({
			format: "goodwatch-wishlist",
			version: 1,
			source: "test-capture",
			completeness: "partial",
			profileLabel: "Family",
			items: [
				{
					title: "Toy Story",
					year: 1995,
					mediaType: "movie",
					sourceId: "provider-42",
				},
				{
					title: "Toy Story",
					year: 1995,
					mediaType: "unknown",
					sourceId: "unknown-42",
				},
			],
		}),
	)
	const preview = await previewImport(
		"member",
		"wishlist",
		"wishlist.json",
		file,
	)
	assert.equal(preview.counts.new, 1)
	assert.equal(preview.counts.unmatched, 1)
	assert.equal(preview.kinds.watch, 0)
	assert.equal(preview.kinds.rating, 0)
	assert.equal(db.wishlist.length, 0)
	const rows = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.equal(rows.items[0].tmdbId, 862)
	assert.equal(rows.items[0].wishlistEvidence?.sourceId, "provider-42")
	assert.equal(rows.items[1].outcome, "unmatched")
	await confirmImport("member", preview.id, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	for (let attempt = 0; attempt < 100; attempt++) {
		if ((await getImport("member", preview.id)).status === "done") break
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	const done = await getImport("member", preview.id)
	assert.equal(done.status, "done")
	assert.equal(done.applied.added, 1)
	assert.equal(db.wishlist.length, 1)
	assert.equal(db.watches.length, 0)
	assert.equal(db.scores.length, 0)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(db.wishlist.length, 0)
})

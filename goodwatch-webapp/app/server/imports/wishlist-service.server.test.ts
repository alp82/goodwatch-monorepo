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
const {
	previewImport,
	getImportItems,
	confirmImport,
	getImport,
	undoImport,
	resolveWishlistImport,
} = await import("./service.server.ts")
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

async function finished(id: string) {
	for (let attempt = 0; attempt < 100; attempt++) {
		const result = await getImport("member", id)
		if (result.status === "done") return result
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail("Import did not finish")
}
function setupV11() {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
	]
	const tracking = new FakeTrackingCrate()
	setImportDbForTest(db)
	setCrateClientForTest(tracking)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	return { db, tracking }
}
const uploadV11 = (items: unknown[]) =>
	previewImport(
		"member",
		"wishlist",
		"v1.1.json",
		new TextEncoder().encode(
			JSON.stringify({
				format: "goodwatch-wishlist",
				version: 1.1,
				source: "synthetic",
				completeness: "complete",
				items,
			}),
		),
	)

it("offers source-Seen titles as explicit rewatch wishes and never writes watches, ratings or Seen", async () => {
	const { db, tracking } = setupV11()
	const before = structuredClone(tracking.table("user_watch_state"))
	for (const choice of ["keep", "source"] as const) {
		const preview = await uploadV11([
			{
				title: "Toy Story",
				mediaType: "movie",
				tmdbId: 862,
				sourceSeen: true,
				sourceSeenAt: "2026-10-01",
			},
		])
		const row = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items[0]
		assert.equal(row.outcome, "conflict")
		assert.match(row.reason ?? "", /Seen at the source.*Want to rewatch/)
		await confirmImport("member", preview.id, {
			kinds: ["want", "watch", "rating", "show_status"],
			conflictChoice: choice,
			watchDates: "preserve",
		})
		const done = await finished(preview.id)
		assert.equal(done.applied.added, choice === "source" ? 1 : 0)
		assert.equal(db.wishlist.length, choice === "source" ? 1 : 0)
		assert.deepEqual(db.watches, [])
		assert.deepEqual(db.scores, [])
		assert.deepEqual(tracking.table("user_watch_state"), before)
		if (choice === "source") {
			await undoImport("member", preview.id)
			assert.deepEqual(db.wishlist, [])
			assert.deepEqual(db.watches, [])
			assert.deepEqual(db.scores, [])
			assert.deepEqual(tracking.table("user_watch_state"), before)
		}
	}
})

it("holds a season, episode and whole-show duplicate as one unselected show choice, retaining every original row", async () => {
	const { db, tracking } = setupV11()
	for (const wishlistShows of [false, true]) {
		const preview = await uploadV11([
			{ title: "Toy Story", mediaType: "show", tmdbId: 862 },
			{ title: "Toy Story", mediaType: "season", tmdbId: 862, season: 2 },
			{
				title: "Toy Story",
				mediaType: "episode",
				tmdbId: 862,
				season: 3,
				episode: 4,
			},
		])
		const rows = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items
		assert.deepEqual(
			rows.map((row) => row.outcome),
			["conflict", "unsupported", "unsupported"],
		)
		assert.equal(rows[0].wishlistShowChoice, true)
		assert.match(rows[0].reason ?? "", /Want to See the show/)
		assert.equal(preview.wishlistShowChoiceCount, 1)
		assert.equal(preview.wishlistRewatchChoiceCount, 0)
		assert.deepEqual(
			rows.map((row) => [
				row.wishlistOriginal?.mediaType,
				row.wishlistOriginal?.season,
				row.wishlistOriginal?.episode,
			]),
			[
				["show", undefined, undefined],
				["season", 2, undefined],
				["episode", 3, 4],
			],
		)
		await confirmImport("member", preview.id, {
			kinds: ["want"],
			conflictChoice: "source",
			watchDates: "preserve",
			wishlistShows,
		})
		assert.equal(
			(await finished(preview.id)).applied.added,
			wishlistShows ? 1 : 0,
		)
		assert.equal(db.wishlist.length, wishlistShows ? 1 : 0)
		assert.deepEqual(db.watches, [])
		assert.deepEqual(db.scores, [])
		assert.deepEqual(tracking.table("user_watch_state"), [])
	}
})

it("requires the show choice independently of rewatch and preserves show tracking states", async () => {
	for (const state of [
		"not_started",
		"watching",
		"on_hold",
		"dropped",
		"seen",
	] as const) {
		for (const wishlistShows of [false, true]) {
			for (const conflictChoice of ["keep", "source"] as const) {
				const { db, tracking } = setupV11()
				const storedState = {
					user_id: "member",
					tmdb_id: 862,
					media_type: "show",
					state,
					pass: 1,
					state_changed_at: "2026-10-01",
					created_at: "2026-10-01",
					updated_at: "2026-10-01",
				}
				tracking.table("user_watch_state").push(storedState)
				tracking.refresh("user_watch_state")
				const preview = await uploadV11([
					{
						title: "Toy Story",
						mediaType: "episode",
						tmdbId: 862,
						season: 2,
						episode: 4,
						sourceSeen: true,
					},
				])
				const expected =
					state === "not_started" || state === "seen" ? "conflict" : "unchanged"
				assert.equal(
					(await getImportItems("member", preview.id, undefined, 0, 50))
						.items[0].outcome,
					expected,
				)
				await confirmImport("member", preview.id, {
					kinds: ["want"],
					conflictChoice,
					wishlistShows,
					watchDates: "preserve",
				})
				const add =
					expected === "conflict" &&
					wishlistShows &&
					conflictChoice === "source"
				assert.equal((await finished(preview.id)).applied.added, add ? 1 : 0)
				assert.deepEqual(tracking.table("user_watch_state"), [storedState])
				assert.deepEqual(tracking.table("user_watch_log"), [])
				assert.deepEqual(db.watches, [])
				assert.deepEqual(db.scores, [])
			}
		}
	}
})

it("keeps a season's show namespace and original coordinates when another row is resolved or cleared", async () => {
	setupV11()
	const parent = await uploadV11([
		{
			title: "Toy Story",
			mediaType: "season",
			tmdbId: 862,
			season: 2,
			sourceSeen: true,
		},
		{ title: "Unknown", mediaType: "unknown", sourceId: "unknown" },
	])
	const original = (await getImportItems("member", parent.id, undefined, 0, 50))
		.items[0].wishlistOriginal
	const child = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 1, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const row = (
		await getImportItems("member", child.import.id, undefined, 0, 50)
	).items[0]
	assert.equal(row.mediaType, "show")
	assert.equal(row.outcome, "conflict")
	assert.deepEqual(row.wishlistOriginal, original)
	const cleared = await resolveWishlistImport("member", child.import.id, {
		choices: [{ index: 1, target: null }],
	})
	assert.deepEqual(
		(await getImportItems("member", cleared.import.id, undefined, 0, 50))
			.items[0].wishlistOriginal,
		original,
	)
})

it("keeps conflicting season IDs held for a show match and retains the show choice after resolution", async () => {
	const { db } = setupV11()
	db.catalog.push({
		tmdb_id: 13,
		imdb_id: "tt0109830",
		title: "Other show",
		release_year: 1994,
	})
	const parent = await uploadV11([
		{
			title: "Toy Story",
			mediaType: "season",
			season: 2,
			tmdbId: 862,
			imdbId: "tt0109830",
		},
	])
	assert.equal(parent.counts.unmatched, 1)
	await assert.rejects(
		() =>
			resolveWishlistImport("member", parent.id, {
				choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 13 } }],
			}),
		{ code: "wishlist_resolution_invalid" },
	)
	const child = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "show", tmdbId: 13 } }],
	})
	const row = (
		await getImportItems("member", child.import.id, undefined, 0, 50)
	).items[0]
	assert.equal(row.outcome, "conflict")
	assert.equal(row.wishlistShowChoice, true)
	assert.equal(row.wishlistOriginal?.imdbId, "tt0109830")
	assert.equal(row.wishlistOriginal?.season, 2)
	await confirmImport("member", child.import.id, {
		kinds: ["want"],
		conflictChoice: "source",
		watchDates: "preserve",
	})
	assert.equal((await finished(child.import.id)).applied.added, 0)
	assert.deepEqual(db.wishlist, [])
})

it("combines source-Seen duplicate evidence in either source order without rewriting originals", async () => {
	for (const reverse of [false, true]) {
		setupV11()
		const rows = [
			{
				title: "Toy Story",
				mediaType: "movie",
				tmdbId: 862,
				sourceSeen: false,
			},
			{ title: "Toy Story", mediaType: "movie", tmdbId: 862, sourceSeen: true },
		]
		const preview = await uploadV11(reverse ? rows.reverse() : rows)
		const items = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items
		assert.equal(items[0].outcome, "conflict")
		assert.equal(items[1].outcome, "unsupported")
		assert.equal(items[0].wishlistRewatchChoice, true)
		assert.deepEqual(
			items.map((row) => row.wishlistOriginal?.wishlistEvidence.sourceSeen),
			reverse ? [true, false] : [false, true],
		)
	}
})

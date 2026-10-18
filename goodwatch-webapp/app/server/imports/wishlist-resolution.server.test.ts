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
	getImportResult,
	getWishlistMatchingGroups,
	getWishlistMatchGroup,
	searchWishlistMatches,
	getSkippedCsv,
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

const upload = (items: unknown[]) =>
	previewImport(
		"member",
		"wishlist",
		"capture.json",
		new TextEncoder().encode(
			JSON.stringify({
				format: "goodwatch-wishlist",
				version: 1,
				source: "netflix",
				completeness: "partial",
				items,
			}),
		),
	)
function setup() {
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
	return db
}
async function finished(id: string) {
	for (let i = 0; i < 100; i++) {
		const row = await getImport("member", id)
		if (row.status === "done") return row
		await new Promise((r) => setTimeout(r, 5))
	}
	assert.fail("Import did not finish")
}
it("derives a Wishlist preview from an explicit catalog choice while preserving unknown source identity through receipt and Undo", async () => {
	const db = setup()
	const parent = await upload([
		{
			title: "Original source title",
			mediaType: "unknown",
			sourceId: "provider-42",
			tmdbId: 42,
		},
	])
	assert.equal(parent.counts.unmatched, 1)
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	assert.notEqual(derived.import.id, parent.id)
	assert.equal(derived.parentImportId, parent.id)
	assert.equal(derived.import.counts.new, 1)
	const row = (
		await getImportItems("member", derived.import.id, undefined, 0, 50)
	).items[0]
	assert.equal(row.tmdbId, 862)
	assert.equal(row.wishlistEvidence?.mediaType, "unknown")
	assert.equal(row.wishlistOriginal?.tmdbId, 42)
	assert.equal(row.wishlistOriginal?.mediaType, "unknown")
	assert.equal(row.wishlistResolution?.tmdbId, 862)
	assert.equal((await getImport("member", parent.id)).counts.unmatched, 1)
	assert.equal(db.wishlist.length, 0)
	await confirmImport("member", derived.import.id, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finished(derived.import.id)).applied.added, 1)
	assert.equal(db.wishlist.length, 1)
	assert.equal(db.watches.length, 0)
	assert.equal(db.scores.length, 0)
	assert.ok(await getImportResult("member", derived.import.id))
	await undoImport("member", derived.import.id)
	assert.equal(db.wishlist.length, 0)
})
it("resolves a duplicate native-ID group together, preserves separate same-title IDs, and clears previously suppressed source rows", async () => {
	const db = setup()
	db.catalog.push({
		tmdb_id: 658039,
		imdb_id: "tt7654321",
		title: "Another movie",
		release_year: 2020,
	})
	const parent = await upload([
		{ title: "Same title", mediaType: "unknown", sourceId: "shared" },
		{ title: "Same title", mediaType: "unknown", sourceId: "shared" },
		{ title: "Same title", mediaType: "unknown", sourceId: "different" },
	])
	const first = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const firstRows = (
		await getImportItems("member", first.import.id, undefined, 0, 50)
	).items
	assert.deepEqual(
		firstRows.map((x) => x.outcome),
		["new", "unsupported", "unmatched"],
	)
	assert.equal(firstRows[1].wishlistOriginal?.mediaType, "unknown")
	const second = await resolveWishlistImport("member", first.import.id, {
		choices: [{ index: 2, target: { mediaType: "movie", tmdbId: 5338654 } }],
	})
	const secondRows = (
		await getImportItems("member", second.import.id, undefined, 0, 50)
	).items
	assert.deepEqual(
		secondRows.map((x) => x.tmdbId),
		[862, 862, 658039],
	)
	const cleared = await resolveWishlistImport("member", second.import.id, {
		choices: [{ index: 1, target: null }],
	})
	const clearRows = (
		await getImportItems("member", cleared.import.id, undefined, 0, 50)
	).items
	assert.deepEqual(
		clearRows.map((x) => x.outcome),
		["unmatched", "unmatched", "new"],
	)
	assert.equal(clearRows[0].wishlistResolution, undefined)
	assert.equal(clearRows[1].wishlistResolution, undefined)
	assert.equal(clearRows[2].wishlistResolution?.tmdbId, 658039)
	await assert.rejects(
		() =>
			resolveWishlistImport("member", parent.id, {
				choices: [
					{ index: 0, target: { mediaType: "movie", tmdbId: 862 } },
					{ index: 1, target: { mediaType: "movie", tmdbId: 658039 } },
				],
			}),
		{ code: "wishlist_source_choice_conflict", status: 400 },
	)
})

it("lists bounded matching groups after every resolution, preserving duplicate evidence without private journal data", async () => {
	const db = setup()
	const parent = await upload([
		{ title: "First label", mediaType: "unknown", sourceId: "same" },
		{ title: "Second label", mediaType: "unknown", sourceId: "same" },
		{ title: "Third label", mediaType: "unknown", sourceId: "same" },
		{ title: "Fourth label", mediaType: "unknown", sourceId: "same" },
		...Array.from({ length: 51 }, (_, i) => ({
			title: `Separate ${i}`,
			mediaType: "unknown",
			sourceId: `other-${i}`,
		})),
		{ title: "Invalid", mediaType: "unknown", tmdbId: "bad" },
	])
	assert.equal(parent.wishlistMatchCount, 52)
	const list = await getWishlistMatchingGroups("member", parent.id, 0)
	assert.equal(list.total, 52)
	assert.equal(list.offset, 0)
	assert.equal(list.groups.length, 50)
	assert.equal(list.hasMore, true)
	assert.equal(list.groups[0].entryCount, 4)
	assert.equal(list.groups[0].evidenceVariants.length, 3)
	assert.equal(list.groups[0].hasMoreEvidence, true)
	assert.equal(list.groups[0].representativeIndex, 0)
	assert.equal("payload" in list.groups[0].item, false)
	assert.equal("_preview" in list.groups[0].item, false)
	const next = await getWishlistMatchingGroups("member", parent.id, 50)
	assert.equal(next.groups.length, 2)
	assert.equal(next.hasMore, false)
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const updated = await getWishlistMatchingGroups(
		"member",
		derived.import.id,
		0,
	)
	assert.equal(derived.import.wishlistMatchCount, 52)
	assert.equal(updated.groups[0].item.wishlistResolution?.tmdbId, 862)
	assert.equal(
		(await getImportItems("member", derived.import.id, "invalid", 0, 50)).total,
		1,
	)
})
it("searches bounded local catalog candidates for one owned unknown row without auto-resolving it", async () => {
	const db = setup()
	const parent = await upload([
		{ title: "Source label", mediaType: "unknown", sourceId: "native-1" },
	])
	const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = await import(
		"undici"
	)
	const previousDispatcher = getGlobalDispatcher()
	const agent = new MockAgent()
	agent.disableNetConnect()
	setGlobalDispatcher(agent)
	const previousHost = process.env.CRATE_HOSTS
	process.env.CRATE_HOSTS = "wishlist-match-fixture.invalid"
	setCrateClientForTest(null)
	const statements: string[] = []
	const originalSelect = db.select.bind(db)
	db.select = async (sql, params) => {
		if (sql.includes("FROM doc.user_import_item")) {
			assert.match(sql, /AND row_index = \?/)
			assert.deepEqual(params, [parent.id, "member", 0])
		}
		return originalSelect(sql, params)
	}
	try {
		for (const type of ["movie", "show"]) {
			agent
				.get("http://wishlist-match-fixture.invalid:4200")
				.intercept({
					path: "/_sql",
					method: "POST",
					body: (body) => {
						const q = JSON.parse(String(body))
						if (!q.stmt.includes(`FROM ${type} `)) return false
						assert.deepEqual(q.args, ["Toy"])
						statements.push(q.stmt)
						return true
					},
				})
				.reply(200, {
					cols: ["tmdb_id", "title", "release_year", "poster_path"],
					rows: [
						[
							type === "movie" ? 862 : 42,
							type === "movie" ? "Toy Story" : "Toy Show",
							type === "movie" ? 1995 : 2020,
							null,
						],
					],
					rowcount: 1,
				})
		}
		const found = await searchWishlistMatches("member", parent.id, {
			index: 0,
			query: "Toy",
		})
		assert.deepEqual(
			found.candidates.map((x) => [x.mediaType, x.tmdbId, x.title, x.year]),
			[
				["movie", 862, "Toy Story", 1995],
				["show", 42, "Toy Show", 2020],
			],
		)
		assert.equal(new Set(statements).size, 2)
		assert.ok(
			statements.every(
				(sql) =>
					sql.includes("MATCH((title,original_title), ?)") &&
					sql.includes("LIMIT 10") &&
					!sql.includes("lower("),
			),
		)
		assert.equal((await getImport("member", parent.id)).counts.unmatched, 1)
		assert.equal(db.wishlist.length, 0)
	} finally {
		setGlobalDispatcher(previousDispatcher)
		await agent.close()
		if (previousHost === undefined)
			Reflect.deleteProperty(process.env, "CRATE_HOSTS")
		else process.env.CRATE_HOSTS = previousHost
		setCrateClientForTest(null)
	}
})

it("never falls back to source IMDb or title/year when a selected catalog target disappears during preview creation", async () => {
	class DisappearingDb extends ImportDb {
		lookups = 0
		override async select<T extends {}>(
			sql: string,
			params: Parameters<ImportDb["select"]>[1],
		): Promise<T[]> {
			const result = await super.select<T>(sql, params)
			if (sql.includes("FROM movie WHERE tmdb_id IN") && ++this.lookups === 1)
				this.catalog = this.catalog.filter((row) => row.tmdb_id !== 862)
			return result
		}
	}
	const db = new DisappearingDb()
	db.catalog = [
		{
			tmdb_id: 862,
			title: "Selected title",
			release_year: 1995,
			imdb_id: "tt0114709",
		},
		{
			tmdb_id: 999,
			title: "Source title",
			release_year: 2000,
			imdb_id: "tt9999999",
		},
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const parent = await upload([
		{
			title: "Source title",
			year: 2000,
			mediaType: "unknown",
			imdbId: "tt9999999",
		},
	])
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const item = (
		await getImportItems("member", derived.import.id, undefined, 0, 50)
	).items[0]
	assert.equal(item.outcome, "unmatched")
	assert.equal(item.tmdbId, null)
	assert.equal(item.wishlistResolution?.tmdbId, 862)
	assert.equal(item.wishlistOriginal?.imdbId, "tt9999999")
	assert.equal(
		db.catalogQueries.some(
			(query) =>
				query.sql.includes("imdb_id IN") || query.sql.includes("lower(title)"),
		),
		false,
	)
})
it("keeps the first source occurrence when an earlier title/year match duplicates a later explicit catalog ID", async () => {
	setup()
	const parent = await upload([
		{
			title: "Toy Story",
			year: 1995,
			mediaType: "movie",
			sourceId: "first",
			addedAt: "2026-01-01",
		},
		{
			title: "Later source label",
			mediaType: "movie",
			tmdbId: 862,
			sourceId: "second",
			addedAt: "2026-02-01",
		},
	])
	const rows = (await getImportItems("member", parent.id, undefined, 0, 50))
		.items
	assert.deepEqual(
		rows.map((row) => row.outcome),
		["new", "unsupported"],
	)
	assert.equal(rows[0].addedAt, "2026-01-01")
	assert.equal(rows[0].wishlistEvidence?.sourceId, "first")
})
it("rejects resolver bypasses, missing targets, foreign imports and historical unknown rows without reconstructing source evidence", async () => {
	const db = setup()
	const parent = await upload([
		{ title: "Unknown", mediaType: "unknown", sourceId: "one" },
		{ title: "Invalid", mediaType: "unknown", tmdbId: "bad" },
		{ title: "Known", mediaType: "movie", tmdbId: 862 },
	])
	const target = { mediaType: "movie", tmdbId: 862 }
	for (const input of [
		{ choices: [] },
		{ choices: [{ index: 0, target: { ...target, title: "Injected title" } }] },
		{ choices: [{ index: 0, target }], observations: [] },
		{
			choices: [
				{ index: 0, target },
				{ index: 0, target },
			],
		},
		{ choices: Array.from({ length: 101 }, (_, index) => ({ index, target })) },
	]) {
		await assert.rejects(
			() => resolveWishlistImport("member", parent.id, input),
			{ code: "wishlist_resolution_invalid", status: 400 },
		)
	}
	await assert.rejects(
		() =>
			resolveWishlistImport("member", parent.id, {
				choices: [{ index: 1, target }],
			}),
		{ code: "wishlist_row_not_resolvable", status: 400 },
	)
	await assert.rejects(
		() =>
			resolveWishlistImport("member", parent.id, {
				choices: [{ index: 2, target }],
			}),
		{ code: "wishlist_row_not_resolvable", status: 400 },
	)
	await assert.rejects(
		() =>
			resolveWishlistImport("member", parent.id, {
				choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 123456 } }],
			}),
		{ code: "wishlist_target_missing", status: 400 },
	)
	await assert.rejects(
		() =>
			resolveWishlistImport("someone-else", parent.id, {
				choices: [{ index: 0, target }],
			}),
		{ status: 404 },
	)
	const stored = db.items.find(
		(item) => item.import_id === parent.id && item.row_index === 0,
	)
	assert.ok(stored)
	const payload = JSON.parse(String(stored.payload))
	payload.wishlistOriginal = undefined
	stored.payload = JSON.stringify(payload)
	await assert.rejects(
		() =>
			resolveWishlistImport("member", parent.id, {
				choices: [{ index: 0, target }],
			}),
		{ code: "wishlist_snapshot_required", status: 409 },
	)
	assert.equal(db.wishlist.length, 0)
	assert.equal(db.imports.length, 1)
})

it("names the selected catalog work in import, skipped and Undo results even if catalog enrichment later disappears", async () => {
	const db = setup()
	const parent = await upload([
		{
			title: "Different source label",
			year: 2000,
			mediaType: "unknown",
			sourceId: "same",
		},
		{
			title: "Duplicate source label",
			year: 2001,
			mediaType: "unknown",
			sourceId: "same",
		},
	])
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	await confirmImport("member", derived.import.id, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await finished(derived.import.id)
	db.catalog = []
	clearResultCacheForTest()
	const receipt = await getImportResult("member", derived.import.id)
	const affected = receipt.sections
		.flatMap((section) => section.rows)
		.find((row) => row.title)
	assert.equal(affected?.title?.title, "Toy Story")
	assert.equal(affected?.title?.year, 1995)
	const skipped = await getSkippedCsv("member", derived.import.id)
	assert.ok(skipped.includes("Toy Story"))
	assert.equal(skipped.includes("Duplicate source label"), false)
	const source = (
		await getImportItems("member", derived.import.id, undefined, 0, 50)
	).items[0]
	assert.equal(source.wishlistOriginal?.title, "Different source label")
	assert.equal(source.wishlistOriginal?.year, 2000)
	await undoImport("member", derived.import.id)
	const undone = await getImportResult("member", derived.import.id)
	assert.equal(
		undone.sections.flatMap((section) => section.rows).find((row) => row.title)
			?.title?.title,
		"Toy Story",
	)
})

it("loads one owned matching group by any source entry, including duplicate leaves beyond the first list page", async () => {
	setup()
	const parent = await upload([
		...Array.from({ length: 51 }, (_, index) => ({
			title: `Source ${index}`,
			mediaType: "unknown",
			sourceId: `native-${index}`,
		})),
		{ title: "Duplicate leaf", mediaType: "unknown", sourceId: "native-50" },
		{ title: "Invalid", mediaType: "unknown", tmdbId: "bad" },
	])
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 51, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const result = await getWishlistMatchGroup("member", derived.import.id, 51)
	assert.equal(result.group.representativeIndex, 50)
	assert.equal(result.group.entryCount, 2)
	assert.equal(result.group.item.wishlistResolution?.tmdbId, 862)
	assert.deepEqual(
		result.group.evidenceVariants.map((variant) => variant.title),
		["Source 50", "Duplicate leaf"],
	)
	await assert.rejects(
		() => getWishlistMatchGroup("other-member", derived.import.id, 51),
		{ status: 404 },
	)
	await assert.rejects(
		() => getWishlistMatchGroup("member", derived.import.id, 52),
		{ code: "wishlist_row_not_resolvable", status: 400 },
	)
})
it("never groups title-only observations that lack a native identity", async () => {
	setup()
	const parent = await upload([
		{ title: "Same label", mediaType: "unknown" },
		{ title: "Same label", mediaType: "unknown" },
	])
	assert.equal(parent.wishlistMatchCount, 2)
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	assert.deepEqual(
		(
			await getImportItems("member", derived.import.id, undefined, 0, 50)
		).items.map((row) => row.outcome),
		["new", "unmatched"],
	)
})
it("keeps Seen by default, requires explicit rewatch, claims concurrent Confirm once and preserves the watch on Undo", async () => {
	const db = setup()
	const watch = {
		user_id: "member",
		tmdb_id: 862,
		media_type: "movie",
		watch_id: "existing-watch",
	}
	db.watches.push(watch)
	const parent = await upload([
		{ title: "Source movie", mediaType: "unknown", sourceId: "native" },
	])
	const first = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	assert.equal(first.import.counts.conflict, 1)
	await confirmImport("member", first.import.id, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await finished(first.import.id)
	assert.equal(db.wishlist.length, 0)
	const rewatch = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const options = {
		kinds: ["want" as const],
		conflictChoice: "source" as const,
		watchDates: "preserve" as const,
	}
	await Promise.all([
		confirmImport("member", rewatch.import.id, options),
		confirmImport("member", rewatch.import.id, options),
	])
	assert.equal((await finished(rewatch.import.id)).applied.added, 1)
	assert.equal(db.wishlist.length, 1)
	assert.deepEqual(db.watches, [watch])
	await assert.rejects(
		() =>
			resolveWishlistImport("member", rewatch.import.id, {
				choices: [{ index: 0, target: null }],
			}),
		{ code: "wishlist_preview_required", status: 409 },
	)
	await assert.rejects(
		() => getWishlistMatchGroup("member", rewatch.import.id, 0),
		{ code: "wishlist_preview_required", status: 409 },
	)
	await undoImport("member", rewatch.import.id)
	assert.equal(db.wishlist.length, 0)
	assert.deepEqual(db.watches, [watch])
})

it("keeps effective IMDb identity consistent with a selected target in skipped CSV and restores the source IMDb when cleared", async () => {
	setup()
	const parent = await upload([
		{
			title: "Source work",
			mediaType: "unknown",
			sourceId: "same",
			imdbId: "tt9999999",
		},
		{
			title: "Source duplicate",
			mediaType: "unknown",
			sourceId: "same",
			imdbId: "tt9999999",
		},
	])
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const rows = (
		await getImportItems("member", derived.import.id, undefined, 0, 50)
	).items
	assert.deepEqual(
		rows.map((row) => row.imdbId),
		["tt0114709", "tt0114709"],
	)
	assert.deepEqual(
		rows.map((row) => row.wishlistOriginal?.imdbId),
		["tt9999999", "tt9999999"],
	)
	const skipped = await getSkippedCsv("member", derived.import.id)
	assert.ok(skipped.includes("Toy Story"))
	assert.ok(skipped.includes("tt0114709"))
	assert.equal(skipped.includes("tt9999999"), false)
	const cleared = await resolveWishlistImport("member", derived.import.id, {
		choices: [{ index: 1, target: null }],
	})
	const originalRows = (
		await getImportItems("member", cleared.import.id, undefined, 0, 50)
	).items
	assert.deepEqual(
		originalRows.map((row) => row.imdbId),
		["tt9999999", "tt9999999"],
	)
	assert.deepEqual(
		originalRows.map((row) => row.outcome),
		["unmatched", "unmatched"],
	)
	assert.ok(originalRows.every((row) => row.wishlistResolution === undefined))
})

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

// Ported from #708 JustWatch P3: wrong TMDB identity collides with a valid wish.
it("holds the P3 Inception ID disagreement before suppressing the separate Matrix wish", async () => {
	const db = setup()
	db.catalog = [
		{
			tmdb_id: 603,
			imdb_id: "tt0133093",
			title: "The Matrix",
			release_year: 1999,
		},
		{
			tmdb_id: 27205,
			imdb_id: "tt1375666",
			title: "Inception",
			release_year: 2010,
		},
	]
	const parent = await upload([
		{
			title: "The Matrix",
			year: 1999,
			mediaType: "movie",
			tmdbId: 603,
			imdbId: "tt0133093",
			sourceId: "tm1008",
		},
		{
			title: "Inception",
			year: 2010,
			mediaType: "movie",
			tmdbId: 603,
			imdbId: "tt1375666",
			sourceId: "tm1009",
		},
	])
	const rows = (await getImportItems("member", parent.id, undefined, 0, 50))
		.items
	assert.deepEqual(
		rows.map((row) => [row.outcome, row.tmdbId]),
		[
			["new", 603],
			["unmatched", null],
		],
	)
	assert.equal(parent.wishlistMatchCount, 1)
	const group = (await getWishlistMatchGroup("member", parent.id, 1)).group
	assert.deepEqual(
		group.item.wishlistIdConflict?.candidates.map((c) => [
			c.suppliedId,
			c.tmdbId,
		]),
		[
			["tmdb", 603],
			["imdb", 27205],
		],
	)
	assert.deepEqual(group.item.wishlistIdConflict?.suggestion, {
		mediaType: "movie",
		tmdbId: 27205,
		signal: "metadata",
	})
	const chosen = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 1, target: { mediaType: "movie", tmdbId: 27205 } }],
	})
	const resolved = (
		await getImportItems("member", chosen.import.id, undefined, 0, 50)
	).items[1]
	assert.equal(resolved.outcome, "new")
	assert.deepEqual(resolved.wishlistOriginal, rows[1].wishlistOriginal)
	assert.deepEqual(resolved.wishlistEvidence, rows[1].wishlistEvidence)
	const cleared = await resolveWishlistImport("member", chosen.import.id, {
		choices: [{ index: 1, target: null }],
	})
	assert.equal(cleared.import.counts.unmatched, 1)
	assert.equal(db.wishlist.length, 0)
})

for (const interaction of ["want", "watch", "rating", "show_status"] as const) {
	it(`prefers the sole candidate with an existing ${interaction} interaction over row metadata`, async () => {
		const db = setup()
		const mediaType = interaction === "show_status" ? "show" : "movie"
		db.catalog = [
			{
				tmdb_id: 101,
				imdb_id: "tt0000101",
				title: "Known",
				release_year: 2000,
				media_type: mediaType,
			},
			{
				tmdb_id: 202,
				imdb_id: "tt0000202",
				title: "Source",
				release_year: 2020,
				media_type: mediaType,
			},
		]
		const identity = { user_id: "member", tmdb_id: 101, media_type: mediaType }
		if (interaction === "want") db.wishlist.push(identity)
		if (interaction === "watch") db.watches.push(identity)
		if (interaction === "rating")
			db.scores.push({
				...identity,
				score: 8,
				updated_at: "2026-01-01",
				_seq_no: 1,
				_primary_term: 1,
			})
		if (interaction === "show_status")
			db.showStates.push({ ...identity, state: "on_hold" })
		const preview = await upload([
			{
				title: "Source",
				year: 2020,
				mediaType,
				tmdbId: 101,
				imdbId: "tt0000202",
			},
		])
		const row = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items[0]
		assert.deepEqual(row.wishlistIdConflict?.suggestion, {
			mediaType,
			tmdbId: 101,
			signal: "interaction",
		})
		assert.equal(row.outcome, "unmatched")
	})
}

for (const [first, second, expected] of [
	[80, 20, 101],
	[20, 80, 202],
	[30, 25, null],
	[30, 30, null],
	[null, 50, null],
] as const) {
	it(`uses only a clear popularity advantage (${first} versus ${second}) when higher-trust evidence ties`, async () => {
		const db = setup()
		db.catalog = [
			{
				tmdb_id: 101,
				imdb_id: "tt0000101",
				title: "Same",
				release_year: 2000,
				popularity: first,
			},
			{
				tmdb_id: 202,
				imdb_id: "tt0000202",
				title: "Same",
				release_year: 2000,
				popularity: second,
			},
		]
		const preview = await upload([
			{
				title: "Same",
				year: 2000,
				mediaType: "movie",
				tmdbId: 101,
				imdbId: "tt0000202",
			},
		])
		const row = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items[0]
		assert.equal(row.outcome, "unmatched")
		assert.deepEqual(
			row.wishlistIdConflict?.suggestion,
			expected === null
				? null
				: { mediaType: "movie", tmdbId: expected, signal: "popularity" },
		)
	})
}

for (const mediaType of ["movie", "show"] as const) {
	it(`keeps ID conflict candidates in the declared ${mediaType} namespace despite colliding numeric IDs`, async () => {
		const db = setup()
		const otherType = mediaType === "movie" ? "show" : "movie"
		db.catalog = [
			{
				tmdb_id: 101,
				imdb_id: "tt0000101",
				title: "Typed first",
				release_year: 2000,
				media_type: mediaType,
			},
			{
				tmdb_id: 202,
				imdb_id: "tt0000202",
				title: "Typed second",
				release_year: 2020,
				media_type: mediaType,
			},
			{
				tmdb_id: 101,
				imdb_id: "tt0000202",
				title: "Other namespace",
				release_year: 2000,
				media_type: otherType,
			},
		]
		// An interaction with the other namespace must not affect this row's default.
		db.wishlist.push({ user_id: "member", tmdb_id: 101, media_type: otherType })
		const preview = await upload([
			{
				title: "Typed second",
				year: 2020,
				mediaType,
				tmdbId: 101,
				imdbId: "tt0000202",
			},
		])
		const row = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items[0]
		assert.equal(row.outcome, "unmatched")
		assert.deepEqual(
			row.wishlistIdConflict?.candidates.map((candidate) => [
				candidate.mediaType,
				candidate.tmdbId,
				candidate.title,
			]),
			[
				[mediaType, 101, "Typed first"],
				[mediaType, 202, "Typed second"],
			],
		)
		assert.equal(row.wishlistIdConflict?.suggestion?.signal, "metadata")
	})
}
it("never applies an unresolved hold or suppresses it as a duplicate, in either source order", async () => {
	for (const reverse of [false, true]) {
		const db = setup()
		db.catalog = [
			{ tmdb_id: 101, imdb_id: "tt0000101", title: "One", release_year: 2000 },
			{ tmdb_id: 202, imdb_id: "tt0000202", title: "Two", release_year: 2020 },
		]
		const entries = [
			{ title: "One", mediaType: "movie", tmdbId: 101, imdbId: "tt0000101" },
			{ title: "Two", mediaType: "movie", tmdbId: 101, imdbId: "tt0000202" },
			{
				title: "Two again",
				mediaType: "movie",
				tmdbId: 101,
				imdbId: "tt0000202",
			},
		]
		const preview = await upload(reverse ? entries.reverse() : entries)
		assert.equal(preview.counts.new, 1)
		assert.equal(preview.counts.unmatched, 2)
		assert.equal(preview.counts.unsupported, 0)
		await confirmImport("member", preview.id, {
			kinds: ["want"],
			conflictChoice: "source",
			watchDates: "preserve",
		})
		assert.equal((await finished(preview.id)).applied.added, 1)
		assert.deepEqual(
			db.wishlist.map((row) => row.tmdb_id),
			[101],
		)
	}
})
it("treats a retired movie ID and its canonical IMDb target as agreement", async () => {
	const db = setup()
	db.catalog = [
		{
			tmdb_id: 658039,
			imdb_id: "tt7654321",
			title: "Canonical",
			release_year: 2020,
		},
	]
	const preview = await upload([
		{
			title: "Canonical",
			mediaType: "movie",
			tmdbId: 5338654,
			imdbId: "tt7654321",
		},
	])
	const row = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items[0]
	assert.equal(row.outcome, "new")
	assert.equal(row.tmdbId, 658039)
	assert.equal(row.wishlistIdConflict, undefined)
	assert.equal(preview.wishlistMatchCount, 0)
})

it("uses year to distinguish same-title candidates after both have interactions, ahead of popularity", async () => {
	const db = setup()
	db.catalog = [
		{
			tmdb_id: 101,
			imdb_id: "tt0000101",
			title: "Dune",
			release_year: 1984,
			popularity: 10,
		},
		{
			tmdb_id: 202,
			imdb_id: "tt0000202",
			title: "Dune",
			release_year: 2021,
			popularity: 100,
		},
	]
	db.wishlist = [101, 202].map((tmdb_id) => ({
		user_id: "member",
		tmdb_id,
		media_type: "movie",
	}))
	const preview = await upload([
		{
			title: "Dune",
			year: 1984,
			mediaType: "movie",
			tmdbId: 101,
			imdbId: "tt0000202",
		},
	])
	const row = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items[0]
	assert.deepEqual(row.wishlistIdConflict?.suggestion, {
		mediaType: "movie",
		tmdbId: 101,
		signal: "metadata",
	})
	assert.equal(row.outcome, "unmatched")
})
it("does not rank interaction kinds or preselect when both candidates have interactions and no other evidence separates them", async () => {
	const db = setup()
	db.catalog = [
		{ tmdb_id: 101, imdb_id: "tt0000101", title: "Same", release_year: 2000 },
		{ tmdb_id: 202, imdb_id: "tt0000202", title: "Same", release_year: 2000 },
	]
	db.wishlist.push({ user_id: "member", tmdb_id: 101, media_type: "movie" })
	db.watches.push({ user_id: "member", tmdb_id: 202, media_type: "movie" })
	const preview = await upload([
		{
			title: "Same",
			year: 2000,
			mediaType: "movie",
			tmdbId: 101,
			imdbId: "tt0000202",
		},
	])
	const row = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items[0]
	assert.equal(row.outcome, "unmatched")
	assert.equal(row.wishlistIdConflict?.suggestion, null)
})

for (const interaction of ["show_state", "want", "rating", "watch"] as const) {
	it(`ignores a movie ${interaction} with the same numeric ID as a conflicting show candidate`, async () => {
		const db = setup()
		db.catalog = [
			{
				tmdb_id: 101,
				imdb_id: "tt0000101",
				title: "Other show",
				release_year: 2000,
				media_type: "show",
			},
			{
				tmdb_id: 202,
				imdb_id: "tt0000202",
				title: "Source show",
				release_year: 2020,
				media_type: "show",
			},
		]
		const movie = { user_id: "member", tmdb_id: 101, media_type: "movie" }
		if (interaction === "show_state")
			db.showStates.push({ ...movie, state: "seen" })
		if (interaction === "want") db.wishlist.push(movie)
		if (interaction === "watch") db.watches.push(movie)
		if (interaction === "rating")
			db.scores.push({
				...movie,
				score: 8,
				updated_at: "2026-01-01",
				_seq_no: 1,
				_primary_term: 1,
			})
		const preview = await upload([
			{
				title: "Source show",
				year: 2020,
				mediaType: "show",
				tmdbId: 101,
				imdbId: "tt0000202",
			},
		])
		const row = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items[0]
		assert.deepEqual(row.wishlistIdConflict?.suggestion, {
			mediaType: "show",
			tmdbId: 202,
			signal: "metadata",
		})
	})
}

it("holds all typed candidates when a supplied IMDb ID identifies multiple catalog titles", async () => {
	const db = setup()
	db.catalog = [
		{
			tmdb_id: 101,
			imdb_id: "tt0000101",
			title: "First",
			release_year: 2000,
			popularity: 10,
		},
		{
			tmdb_id: 202,
			imdb_id: "tt0000202",
			title: "Second",
			release_year: 2001,
			popularity: 20,
		},
		{
			tmdb_id: 303,
			imdb_id: "tt0000202",
			title: "Third",
			release_year: 2002,
			popularity: 80,
		},
	]
	const preview = await upload([
		{
			title: "Source label",
			mediaType: "movie",
			tmdbId: 101,
			imdbId: "tt0000202",
		},
	])
	const row = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items[0]
	assert.equal(row.outcome, "unmatched")
	assert.equal(row.tmdbId, null)
	assert.deepEqual(
		row.wishlistIdConflict?.candidates.map((c) => [c.suppliedId, c.tmdbId]),
		[
			["tmdb", 101],
			["imdb", 202],
			["imdb", 303],
		],
	)
	assert.deepEqual(row.wishlistIdConflict?.suggestion, {
		mediaType: "movie",
		tmdbId: 303,
		signal: "popularity",
	})
	const group = (await getWishlistMatchGroup("member", preview.id, 0)).group
	assert.equal(group.item.wishlistIdConflict?.candidates.length, 3)
})

for (const otherType of ["show", null] as const) {
	it(`keeps a movie TMDB match when its IMDb ID resolves ${otherType ? "only in the show namespace" : "to nothing"}`, async () => {
		const db = setup()
		db.catalog = [
			{
				tmdb_id: 101,
				imdb_id: "tt0000101",
				title: "Movie",
				release_year: 2000,
				media_type: "movie",
			},
		]
		if (otherType)
			db.catalog.push({
				tmdb_id: 202,
				imdb_id: "tt0000202",
				title: "Show",
				release_year: 2020,
				media_type: otherType,
			})
		const preview = await upload([
			{ title: "Movie", mediaType: "movie", tmdbId: 101, imdbId: "tt0000202" },
		])
		const row = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items[0]
		assert.equal(row.outcome, "new")
		assert.equal(row.tmdbId, 101)
		assert.equal(row.wishlistIdConflict, undefined)
	})
}
it("keeps Dropped as a show identity signal ahead of metadata", async () => {
	const db = setup()
	db.catalog = [
		{
			tmdb_id: 101,
			imdb_id: "tt0000101",
			title: "Known",
			release_year: 2000,
			media_type: "show",
		},
		{
			tmdb_id: 202,
			imdb_id: "tt0000202",
			title: "Source",
			release_year: 2020,
			media_type: "show",
		},
	]
	db.showStates.push({
		user_id: "member",
		tmdb_id: 101,
		media_type: "show",
		state: "dropped",
	})
	const preview = await upload([
		{
			title: "Source",
			year: 2020,
			mediaType: "show",
			tmdbId: 101,
			imdbId: "tt0000202",
		},
	])
	const row = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items[0]
	assert.equal(row.outcome, "unmatched")
	assert.deepEqual(row.wishlistIdConflict?.suggestion, {
		mediaType: "show",
		tmdbId: 101,
		signal: "interaction",
	})
	assert.equal(db.showStates[0].state, "dropped")
})
for (const thirdPopularity of [80, null] as const) {
	it(`leaves no default among multiple IMDb matches when the third popularity is ${thirdPopularity}`, async () => {
		const db = setup()
		db.catalog = [
			{
				tmdb_id: 101,
				imdb_id: "tt0000101",
				title: "First",
				release_year: 2000,
				popularity: 80,
			},
			{
				tmdb_id: 202,
				imdb_id: "tt0000202",
				title: "Second",
				release_year: 2001,
				popularity: 20,
			},
			{
				tmdb_id: 303,
				imdb_id: "tt0000202",
				title: "Third",
				release_year: 2002,
				popularity: thirdPopularity,
			},
		]
		const preview = await upload([
			{ title: "Source", mediaType: "movie", tmdbId: 101, imdbId: "tt0000202" },
		])
		const row = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items[0]
		assert.equal(row.outcome, "unmatched")
		assert.equal(row.wishlistIdConflict?.suggestion, null)
	})
}

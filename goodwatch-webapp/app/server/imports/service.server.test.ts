import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import type { ImportOptions } from "../../domain/imports.ts"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")

const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { getMovieTracking, getShowTracking } = await import(
	"../tracking.server.ts"
)
const {
	previewImport,
	previewParsedImport,
	getImportItems,
	confirmImport,
	getImport,
	undoImport,
	getImportResult,
	getImportResultPage,
} = await import("./service.server.ts")
const { setImportDbForTest, itemRows } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const { clearResultCacheForTest } = await import("./result-catalog.server.ts")

type Row = Record<string, unknown>
function requiredRow(row: Row | undefined): Row {
	if (!row) throw new Error("Expected the fake import row to exist.")
	return row
}
const options: ImportOptions = {
	kinds: ["favorite"],
	conflictChoice: "source",
	watchDates: "preserve",
}

async function waitFor(db: ImportDb, status: string) {
	for (let i = 0; i < 100; i++) {
		if (db.imports[0].status === status) return
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail(`import stayed ${db.imports[0].status}: ${db.imports[0].error}`)
}

afterEach(() => {
	clearResultCacheForTest()
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})

describe("native import service", () => {
	it("enforces ownership and applies then safely undoes a durable receipt", async () => {
		const db = new ImportDb()
		db.seed()
		setImportDbForTest(db)
		setImportEffectsForTest(async () => {})
		await assert.rejects(
			() => getImport("someone-else", String(db.imports[0].id)),
			/couldn't find/,
		)
		await confirmImport("member", String(db.imports[0].id), options)
		await waitFor(db, "done")
		assert.equal(db.favorites.length, 1)
		assert.ok(
			JSON.parse(String(db.items[0].payload)).journal,
			"before/after receipt is stored before completion",
		)
		await undoImport("member", String(db.imports[0].id))
		assert.equal(db.favorites.length, 0)
		assert.equal(db.imports[0].status, "undone")
	})

	it("resumes an interrupted row and undo preserves a later edit", async () => {
		const db = new ImportDb()
		db.seed()
		db.failFavoriteOnce = true
		setImportDbForTest(db)
		setImportEffectsForTest(async () => {})
		await confirmImport("member", String(db.imports[0].id), options)
		await waitFor(db, "failed")
		assert.ok(
			JSON.parse(String(db.items[0].payload)).journal,
			"the receipt survives the failed write",
		)
		await confirmImport("member", String(db.imports[0].id), options)
		await waitFor(db, "done")
		assert.equal(db.favorites.length, 1)
		db.favorites[0].updated_at = new Date("2026-10-10T00:00:00Z")
		await undoImport("member", String(db.imports[0].id))
		assert.equal(
			db.favorites.length,
			1,
			"a row edited after the import is not removed",
		)
	})

	it("resumes dependent rating and review writes on one title, then undoes both", async () => {
		const db = new ImportDb()
		db.seed()
		db.failScoreOnce = true
		db.imports[0].total = 2
		db.imports[0].counts = JSON.stringify({
			rows: 2,
			new: 2,
			unchanged: 0,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		})
		db.items = [
			{
				...db.items[0],
				kind: "rating",
				source_key: "rating:one",
				payload: JSON.stringify({
					key: "rating:one",
					kind: "rating",
					mediaType: "movie",
					title: "One",
					year: 2024,
					tmdbId: 42,
					imdbId: null,
					score: 8,
					index: 0,
					outcome: "new",
					reason: null,
					_preview: null,
				}),
			},
			{
				...db.items[0],
				row_index: 1,
				kind: "review",
				source_key: "review:one",
				payload: JSON.stringify({
					key: "review:one",
					kind: "review",
					mediaType: "movie",
					title: "One",
					year: 2024,
					tmdbId: 42,
					imdbId: null,
					review: "Source review",
					index: 1,
					outcome: "new",
					reason: null,
					_preview: null,
				}),
			},
		]
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const ratingOptions: ImportOptions = {
			...options,
			kinds: ["rating", "review"],
		}
		await confirmImport("member", String(db.imports[0].id), ratingOptions)
		await waitFor(db, "failed")
		await confirmImport("member", String(db.imports[0].id), ratingOptions)
		await waitFor(db, "done")
		assert.deepEqual(
			db.scores.map(({ score, review }) => ({ score, review })),
			[{ score: 8, review: "Source review" }],
		)
		await undoImport("member", String(db.imports[0].id))
		assert.equal(db.scores.length, 0)
	})

	it("journals rejected watch rows as kept without invoking tracking", async () => {
		const db = new ImportDb()
		db.seed()
		Object.assign(db.items[0], {
			kind: "watch",
			outcome: "invalid",
			source_key: "watch:bad",
			payload: JSON.stringify({
				key: "watch:bad",
				kind: "watch",
				mediaType: "movie",
				title: "Bad",
				year: 2024,
				tmdbId: 42,
				imdbId: null,
				index: 0,
				outcome: "invalid",
				reason: "Bad date",
			}),
		})
		setImportDbForTest(db)
		setImportEffectsForTest(async () => {})
		await confirmImport("member", String(db.imports[0].id), {
			...options,
			kinds: ["watch"],
		})
		await waitFor(db, "done")
		assert.equal(db.items[0].apply_state, "kept")
		assert.equal(
			db.items.some((item) => item.kind === "state"),
			false,
		)
	})

	it("keeps a pending synthetic watch plan out of generic resume processing", async () => {
		const db = new ImportDb()
		db.seed()
		db.items.push({
			...db.items[0],
			row_index: 1,
			kind: "state",
			source_key: "state:movie:42",
			apply_state: null,
			payload: JSON.stringify({
				title: { mediaType: "movie", tmdbId: 42 },
				watches: [],
			}),
		})
		setImportDbForTest(db)
		assert.deepEqual(
			(await itemRows("member", String(db.imports[0].id), true)).map(
				(item) => item.kind,
			),
			["favorite"],
		)
		assert.equal(db.items[1].apply_state, null)
	})
})

describe("import and Undo result", () => {
	type Observation = {
		kind: string
		tmdbId: number | null
		title: string
		year?: number | null
		mediaType?: "movie" | "show"
		outcome?: string
		reason?: string | null
		[field: string]: unknown
	}
	/** One confirmed-ready import of `observations`, in file order. */
	function seedImport(db: ImportDb, observations: Observation[]) {
		db.seed()
		const id = String(db.imports[0].id)
		db.imports[0].source = "csv"
		db.imports[0].file_name = "my-movies.csv"
		db.imports[0].total = observations.length
		db.items = observations.map(
			(
				{
					kind,
					tmdbId,
					title,
					year = 2024,
					mediaType = "movie",
					outcome = "new",
					reason = null,
					...rest
				},
				index,
			) => ({
				import_id: id,
				row_index: index,
				user_id: "member",
				kind,
				source_key: `csv:${kind}:${index}`,
				payload: JSON.stringify({
					key: `csv:${kind}:${index}`,
					kind,
					mediaType,
					title,
					year,
					tmdbId,
					imdbId: null,
					index,
					outcome,
					reason,
					...rest,
				}),
				outcome,
				reason,
				tmdb_id: tmdbId,
				media_type: mediaType,
				current_score: null,
				apply_state: null,
			}),
		)
		return id
	}
	const section = (result: { sections: { key: string }[] }, key: string) => {
		const found = result.sections.find((s) => s.key === key)
		if (!found)
			assert.fail(
				`no ${key} section in ${result.sections.map((s) => s.key).join(", ")}`,
			)
		return found as Extract<
			(typeof result.sections)[number],
			{ key: string }
		> & {
			count: number
			total: number
			rows: {
				title: {
					title: string
					year: number | null
					posterPath: string | null
				} | null
				changes: unknown[]
			}[]
		}
	}

	it("lists ratings added and replaced with their old and new values, under the catalog's titles and posters", async () => {
		const db = new ImportDb()
		const id = seedImport(db, [
			{
				kind: "rating",
				tmdbId: 693134,
				title: "dune part two",
				score: 9,
				_preview: null,
			},
			{
				kind: "rating",
				tmdbId: 329865,
				title: "Arrival",
				year: 2016,
				score: 9,
				outcome: "conflict",
				_preview: {
					score: 7,
					review: null,
					updatedAt: "2026-01-01T00:00:00.000Z",
					seq: 3,
					term: 1,
				},
			},
		])
		db.scores.push({
			user_id: "member",
			tmdb_id: 329865,
			media_type: "movie",
			score: 7,
			review: null,
			created_at: new Date("2026-01-01T00:00:00Z"),
			updated_at: new Date("2026-01-01T00:00:00Z"),
			_seq_no: 3,
			_primary_term: 1,
		})
		db.catalog = [
			{
				tmdb_id: 693134,
				imdb_id: null,
				title: "Dune: Part Two",
				release_year: 2024,
				poster_path: "/dune.jpg",
			},
			{
				tmdb_id: 329865,
				imdb_id: null,
				title: "Arrival",
				release_year: 2016,
				poster_path: "/arrival.jpg",
			},
		]
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		await confirmImport("member", id, { ...options, kinds: ["rating"] })
		await waitFor(db, "done")

		const result = await getImportResult("member", id)
		assert.equal(result.operation, "import")
		assert.equal(result.titles, 2)
		assert.deepEqual(
			section(result, "ratings_added").rows.map((row) => [
				row.title?.title,
				row.title?.year,
				row.title?.posterPath,
				row.changes,
			]),
			[
				[
					"Dune: Part Two",
					2024,
					"/dune.jpg",
					[{ type: "rating-added", score: 9 }],
				],
			],
		)
		assert.deepEqual(
			section(result, "ratings_replaced").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[["Arrival", [{ type: "rating-replaced", from: 7, to: 9 }]]],
		)
	})

	it("records the Not interested choice that importing Want to See clears, and lists both", async () => {
		const db = new ImportDb()
		const id = seedImport(db, [
			{ kind: "want", tmdbId: 1064213, title: "Anora" },
			{ kind: "want", tmdbId: 1100, title: "Conclave" },
		])
		db.notInterested.push({
			user_id: "member",
			tmdb_id: 1064213,
			media_type: "movie",
			created_at: new Date("2025-03-01T00:00:00Z"),
			updated_at: new Date("2025-03-02T00:00:00Z"),
			_seq_no: 4,
			_primary_term: 1,
		})
		setImportDbForTest(db)
		setImportEffectsForTest(async () => {})
		await confirmImport("member", id, { ...options, kinds: ["want"] })
		await waitFor(db, "done")
		assert.equal(db.notInterested.length, 0)

		const result = await getImportResult("member", id)
		assert.deepEqual(
			section(result, "want_added").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[
				["Anora", [{ type: "list-added", list: "want_to_see" }]],
				["Conclave", [{ type: "list-added", list: "want_to_see" }]],
			],
		)
		assert.deepEqual(
			section(result, "lists_cleared").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[
				[
					"Anora",
					[
						{
							type: "list-cleared",
							list: "not_interested",
							because: "want",
							undoRestores: false,
						},
					],
				],
			],
		)
		assert.equal(result.titles, 2)
	})

	/** Dune and Past Lives (movies) and The Bear (a show with eight aired episodes), in both fakes. */
	function watchFixture() {
		const db = new ImportDb()
		db.catalog = [
			{
				tmdb_id: 693134,
				imdb_id: null,
				title: "Dune: Part Two",
				release_year: 2024,
				poster_path: "/dune.jpg",
			},
			{
				tmdb_id: 666277,
				imdb_id: null,
				title: "Past Lives",
				release_year: 2023,
				poster_path: null,
			},
			{
				tmdb_id: 136315,
				imdb_id: null,
				title: "The Bear",
				release_year: 2022,
				poster_path: "/bear.jpg",
			},
		]
		db.episodes = Array.from({ length: 8 }, (_, i) => ({
			show_id: 136315,
			tmdb_id: 9001 + i,
			season_number: 1,
			episode_number: i + 1,
			name: `Episode ${i + 1}`,
			tvdb_id: null,
			air_date: Date.UTC(2022, 5, 23),
			removed_at: null,
		}))
		const trackingDb = new FakeTrackingCrate()
		trackingDb.seed("episode", db.episodes)
		trackingDb.seed("user_wishlist", [
			{
				user_id: "member",
				tmdb_id: 693134,
				media_type: "movie",
				created_at: Date.UTC(2024, 0, 1),
				updated_at: Date.UTC(2024, 0, 1),
			},
		])
		trackingDb.seed("user_not_interested", [
			{
				user_id: "member",
				tmdb_id: 136315,
				media_type: "show",
				created_at: Date.UTC(2024, 0, 2),
				updated_at: Date.UTC(2024, 0, 2),
			},
		])
		setImportDbForTest(db)
		setCrateClientForTest(trackingDb)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const watch = (
			key: string,
			tmdbId: number,
			mediaType: "movie" | "show",
			watchedAt: string | null,
			episode?: number,
		) => ({
			key,
			kind: "watch" as const,
			mediaType,
			title: mediaType === "movie" ? "Movie" : "The Bear",
			year: null,
			tmdbId,
			imdbId: null,
			watchedAt,
			precision: watchedAt ? ("day" as const) : ("unknown" as const),
			...(episode
				? {
						episodeTmdbId: 9000 + episode,
						season: 1,
						episode,
						episodeNumbering: "tmdb" as const,
					}
				: {}),
		})
		const parsed = {
			source: "trakt" as const,
			warnings: [],
			observations: [
				watch("dune", 693134, "movie", "2024-03-09T00:00:00.000Z"),
				watch("past-lives", 666277, "movie", null),
				watch("bear-1", 136315, "show", "2023-06-23T00:00:00.000Z", 1),
				watch("bear-2", 136315, "show", "2023-06-23T00:00:00.000Z", 2),
				watch("bear-3", 136315, "show", "2023-06-24T00:00:00.000Z", 3),
			],
		}
		return { db, trackingDb, parsed }
	}

	it("lists watches per title with their days, the show status they set and the lists they cleared", async () => {
		const { db, parsed } = watchFixture()
		const preview = await previewParsedImport(
			"member",
			"history.json",
			parsed,
			"synthetic",
		)
		await confirmImport("member", preview.id, { ...options, kinds: ["watch"] })
		await waitFor(db, "done")

		const result = await getImportResult("member", preview.id)
		const watches = section(result, "watches_added")
		assert.equal(watches.count, 5)
		assert.deepEqual(
			watches.rows.map((row) => [row.title?.title, row.changes]),
			[
				[
					"Dune: Part Two",
					[
						{
							type: "watches-added",
							watches: {
								count: 1,
								first: null,
								last: null,
								firstDay: "2024-03-09",
								lastDay: "2024-03-09",
								undated: 0,
							},
							status: null,
						},
					],
				],
				[
					"Past Lives",
					[
						{
							type: "watches-added",
							watches: {
								count: 1,
								first: null,
								last: null,
								firstDay: null,
								lastDay: null,
								undated: 1,
							},
							status: null,
						},
					],
				],
				[
					"The Bear",
					[
						{
							type: "watches-added",
							watches: {
								count: 3,
								first: { season: 1, episode: 1 },
								last: { season: 1, episode: 3 },
								firstDay: "2023-06-23",
								lastDay: "2023-06-24",
								undated: 0,
							},
							status: { from: null, to: "watching" },
						},
					],
				],
			],
		)
		assert.deepEqual(
			section(result, "lists_cleared").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[
				[
					"Dune: Part Two",
					[
						{
							type: "list-cleared",
							list: "want_to_see",
							because: "watched",
							undoRestores: false,
						},
					],
				],
				[
					"The Bear",
					[
						{
							type: "list-cleared",
							list: "not_interested",
							because: "watched",
							undoRestores: false,
						},
					],
				],
			],
		)
		assert.equal(result.titles, 3)
	})

	it("lists what stayed as it was and the rows it couldn't import, with their reasons", async () => {
		const db = new ImportDb()
		const id = seedImport(db, [
			{
				kind: "rating",
				tmdbId: 496243,
				title: "Parasite",
				score: 10,
				outcome: "unchanged",
			},
			{ kind: "want", tmdbId: 872585, title: "Oppenheimer" },
			{
				kind: "rating",
				tmdbId: null,
				title: "Kurzfilmnacht Vol. 3",
				year: 2021,
				score: 6,
				outcome: "unmatched",
				reason:
					"This title could not be matched uniquely in the GoodWatch catalog.",
			},
			{
				kind: "watch",
				tmdbId: null,
				title: "Heat",
				year: 1995,
				outcome: "invalid",
				reason: "WatchedDate must be a calendar date (YYYY-MM-DD).",
			},
			{
				kind: "favorite",
				tmdbId: 157336,
				title: "Interstellar",
				outcome: "unchanged",
			},
		])
		db.wishlist.push({
			user_id: "member",
			tmdb_id: 872585,
			media_type: "movie",
			created_at: new Date("2025-01-01T00:00:00Z"),
			updated_at: new Date("2025-01-01T00:00:00Z"),
			_seq_no: 2,
			_primary_term: 1,
		})
		db.catalog = [
			{
				tmdb_id: 496243,
				imdb_id: null,
				title: "Parasite",
				release_year: 2019,
				poster_path: "/parasite.jpg",
			},
		]
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		await confirmImport("member", id, {
			...options,
			kinds: ["rating", "want", "watch"],
		})
		await waitFor(db, "done")

		const result = await getImportResult("member", id)
		assert.equal(result.titles, 0)
		assert.deepEqual(
			section(result, "kept").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[
				[
					"Parasite",
					[
						{
							type: "kept",
							kind: "rating",
							reason: "Already the same in GoodWatch.",
						},
					],
				],
				[
					"Oppenheimer",
					[
						{
							type: "kept",
							kind: "want",
							reason: "Already on Want to See, or already watched.",
						},
					],
				],
			],
		)
		assert.deepEqual(
			section(result, "skipped").rows.map((row) => [row.title, row.changes]),
			[
				[
					null,
					[
						{
							type: "skipped",
							kind: "rating",
							label: "Kurzfilmnacht Vol. 3 (2021)",
							row: 3,
							reason:
								"This title could not be matched uniquely in the GoodWatch catalog.",
						},
					],
				],
				[
					null,
					[
						{
							type: "skipped",
							kind: "watch",
							label: "Heat (1995)",
							row: 4,
							reason: "WatchedDate must be a calendar date (YYYY-MM-DD).",
						},
					],
				],
			],
		)
	})

	/** Anora to Want to See (clearing Not interested), Dune and Shōgun rated, Arrival's 7 replaced by a 9. */
	async function importForUndo(db: ImportDb) {
		const id = seedImport(db, [
			{ kind: "want", tmdbId: 1064213, title: "Anora" },
			{
				kind: "rating",
				tmdbId: 693134,
				title: "Dune: Part Two",
				score: 9,
				_preview: null,
			},
			{
				kind: "rating",
				tmdbId: 329865,
				title: "Arrival",
				year: 2016,
				score: 9,
				outcome: "conflict",
				_preview: {
					score: 7,
					review: null,
					updatedAt: "2026-01-01T00:00:00.000Z",
					seq: 3,
					term: 1,
				},
			},
			{
				kind: "rating",
				tmdbId: 126308,
				title: "Shōgun",
				mediaType: "show",
				score: 9,
				_preview: null,
			},
		])
		db.scores.push({
			user_id: "member",
			tmdb_id: 329865,
			media_type: "movie",
			score: 7,
			review: null,
			created_at: new Date("2026-01-01T00:00:00Z"),
			updated_at: new Date("2026-01-01T00:00:00Z"),
			_seq_no: 3,
			_primary_term: 1,
		})
		db.notInterested.push({
			user_id: "member",
			tmdb_id: 1064213,
			media_type: "movie",
			created_at: new Date("2025-03-01T00:00:00Z"),
			updated_at: new Date("2025-03-01T00:00:00Z"),
			_seq_no: 4,
			_primary_term: 1,
		})
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		await confirmImport("member", id, {
			...options,
			kinds: ["rating", "want"],
		})
		await waitFor(db, "done")
		// The member rates Shōgun again after the import.
		Object.assign(requiredRow(db.scores.find((x) => x.tmdb_id === 126308)), {
			score: 10,
			updated_at: new Date("2027-01-01T00:00:00Z"),
			_seq_no: 999,
		})
		return id
	}
	const undoResult = (result: Awaited<ReturnType<typeof getImportResult>>) =>
		result.sections.map((s) => [
			s.key,
			s.rows.map((row) => [row.title?.title, row.changes]),
		])

	it("lists reviews the import added or replaced, and that Undo took back", async () => {
		const db = new ImportDb()
		const id = seedImport(db, [
			{
				kind: "review",
				tmdbId: 693134,
				title: "Dune: Part Two",
				review: "Sand.",
				_preview: null,
			},
			{
				kind: "review",
				tmdbId: 329865,
				title: "Arrival",
				review: "Language.",
				outcome: "conflict",
				_preview: {
					score: 7,
					review: "Old",
					updatedAt: "2026-01-01T00:00:00.000Z",
					seq: 3,
					term: 1,
				},
			},
		])
		db.scores.push({
			user_id: "member",
			tmdb_id: 329865,
			media_type: "movie",
			score: 7,
			review: "Old",
			created_at: new Date("2026-01-01T00:00:00Z"),
			updated_at: new Date("2026-01-01T00:00:00Z"),
			_seq_no: 3,
			_primary_term: 1,
		})
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		await confirmImport("member", id, { ...options, kinds: ["review"] })
		await waitFor(db, "done")
		assert.deepEqual(
			section(await getImportResult("member", id), "reviews").rows.map(
				(row) => [row.title?.title, row.changes],
			),
			[
				["Dune: Part Two", [{ type: "review-added" }]],
				["Arrival", [{ type: "review-replaced" }]],
			],
		)
		await undoImport("member", id)
		assert.deepEqual(
			section(await getImportResult("member", id), "reviews_reverted").rows.map(
				(row) => [row.title?.title, row.changes],
			),
			[
				["Dune: Part Two", [{ type: "review-removed" }]],
				["Arrival", [{ type: "review-restored" }]],
			],
		)
	})

	it("serves the first titles of each section, and the rest a page at a time", async () => {
		const db = new ImportDb()
		const select = db.select.bind(db)
		let reads = 0
		db.select = (sql, params) => {
			if (sql.includes("apply_state, watch_id, undo_outcome FROM")) reads++
			return select(sql, params)
		}
		const resultReads = () => reads
		const id = seedImport(
			db,
			Array.from({ length: 30 }, (_, i) => ({
				kind: "rating",
				tmdbId: 100 + i,
				title: `Film ${i + 1}`,
				score: 8,
				_preview: null,
			})),
		)
		db.catalog = [
			{
				tmdb_id: 128,
				imdb_id: null,
				title: "Film 29 (catalog)",
				release_year: 2001,
				poster_path: "/29.jpg",
			},
		]
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		await confirmImport("member", id, { ...options, kinds: ["rating"] })
		await waitFor(db, "done")

		const first = section(await getImportResult("member", id), "ratings_added")
		assert.equal(first.total, 30)
		assert.equal(first.count, 30)
		assert.deepEqual(
			first.rows.map((row) => row.title?.title),
			Array.from({ length: 25 }, (_, i) => `Film ${i + 1}`),
		)
		const page = await getImportResultPage("member", id, "ratings_added", 25, 3)
		assert.equal(page.total, 30)
		assert.deepEqual(
			page.rows.map((row) => [row.title?.title, row.title?.posterPath]),
			[
				["Film 26", null],
				["Film 27", null],
				["Film 28", null],
			],
		)
		assert.equal(
			resultReads(),
			1,
			"pages of a finished import reuse its result instead of reading every row again",
		)
		const last = await getImportResultPage(
			"member",
			id,
			"ratings_added",
			28,
			50,
		)
		assert.deepEqual(
			last.rows.map((row) => [row.title?.title, row.title?.posterPath]),
			[
				["Film 29 (catalog)", "/29.jpg"],
				["Film 30", null],
			],
		)
	})

	it("records what Undo did per row and leads with what it couldn't put back", async () => {
		const db = new ImportDb()
		const id = await importForUndo(db)
		await undoImport("member", id)
		assert.deepEqual(
			db.scores.map((x) => [x.tmdb_id, x.score]),
			[
				[329865, 7],
				[126308, 10],
			],
		)

		const result = await getImportResult("member", id)
		assert.equal(result.operation, "undo")
		assert.equal(result.titles, 3)
		assert.deepEqual(undoResult(result), [
			[
				"not_restored",
				[["Anora", [{ type: "not-restored", list: "not_interested" }]]],
			],
			[
				"ratings_removed",
				[["Dune: Part Two", [{ type: "rating-removed", score: 9 }]]],
			],
			[
				"ratings_restored",
				[["Arrival", [{ type: "rating-restored", from: 9, to: 7 }]]],
			],
			[
				"want_removed",
				[["Anora", [{ type: "list-removed", list: "want_to_see" }]]],
			],
			["left", [["Shōgun", [{ type: "left", kind: "rating" }]]]],
		])
	})

	it("after Undo lists the watches it removed and leaves a show status the member changed", async () => {
		const { db, trackingDb, parsed } = watchFixture()
		const preview = await previewParsedImport(
			"member",
			"history.json",
			parsed,
			"synthetic",
		)
		await confirmImport("member", preview.id, { ...options, kinds: ["watch"] })
		await waitFor(db, "done")
		// The member puts The Bear on hold after the import.
		const bear = requiredRow(
			trackingDb
				.table("user_watch_state")
				.find((row) => row.tmdb_id === 136315),
		)
		Object.assign(bear, {
			state: "on_hold",
			updated_at: Number(bear.updated_at) + 1000,
			_seq_no: 999,
		})
		await undoImport("member", preview.id)
		assert.equal(
			(await getShowTracking("member", 136315)).state?.state,
			"on_hold",
		)
		assert.deepEqual((await getShowTracking("member", 136315)).log, [])

		const result = await getImportResult("member", preview.id)
		const watches = section(result, "watches_removed")
		assert.equal(watches.count, 5)
		assert.deepEqual(
			watches.rows.map((row) => [
				row.title?.title,
				(row.changes[0] as { status: unknown }).status,
			]),
			[
				["Dune: Part Two", null],
				["Past Lives", null],
				["The Bear", null],
			],
		)
		assert.deepEqual(
			section(result, "not_restored").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[
				["Dune: Part Two", [{ type: "not-restored", list: "want_to_see" }]],
				["The Bear", [{ type: "not-restored", list: "not_interested" }]],
			],
		)
		assert.deepEqual(
			section(result, "left").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[["The Bear", [{ type: "left", kind: "show_status" }]]],
		)
		assert.equal(result.titles, 3)
	})

	/** Friends imported as Dropped, without watches, taking it off Want to See. */
	async function importDroppedStatus() {
		const db = new ImportDb()
		db.catalog = [
			{
				tmdb_id: 1668,
				imdb_id: null,
				title: "Friends",
				release_year: 1994,
				poster_path: null,
			},
		]
		const trackingDb = new FakeTrackingCrate()
		trackingDb.seed("user_wishlist", [
			{
				user_id: "member",
				tmdb_id: 1668,
				media_type: "show",
				created_at: Date.UTC(2024, 0, 1),
				updated_at: Date.UTC(2024, 0, 1),
			},
		])
		setImportDbForTest(db)
		setCrateClientForTest(trackingDb)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const preview = await previewParsedImport(
			"member",
			"statuses.json",
			{
				source: "trakt",
				warnings: [],
				observations: [
					{
						key: "status:1668",
						kind: "show_status",
						mediaType: "show",
						title: "Friends",
						year: 1994,
						tmdbId: 1668,
						imdbId: null,
						showStatus: "dropped",
					},
				],
			},
			"synthetic",
		)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
		})
		await waitFor(db, "done")
		return { db, trackingDb, id: preview.id }
	}

	it("after Undo of a show status without watches lists the status and the Want to See it put back", async () => {
		const { id } = await importDroppedStatus()
		const preview = { id }
		const imported = await getImportResult("member", preview.id)
		assert.deepEqual(
			imported.sections.map((s) => [s.key, s.rows.map((row) => row.changes)]),
			[
				[
					"statuses_set",
					[[{ type: "status-set", status: { from: null, to: "dropped" } }]],
				],
				[
					"lists_cleared",
					[
						[
							{
								type: "list-cleared",
								list: "want_to_see",
								because: "status",
								undoRestores: true,
							},
						],
					],
				],
			],
		)

		await undoImport("member", preview.id)
		const undone = await getImportResult("member", preview.id)
		assert.deepEqual(
			undone.sections.map((s) => [s.key, s.rows.map((row) => row.changes)]),
			[
				[
					"statuses_restored",
					[
						[
							{
								type: "status-restored",
								status: { from: "dropped", to: null },
							},
						],
					],
				],
				["lists_restored", [[{ type: "list-restored", list: "want_to_see" }]]],
			],
		)
		assert.equal(undone.titles, 1)
	})

	it("keeps what Undo did when an interrupted Undo is resumed", async () => {
		const db = new ImportDb()
		const id = await importForUndo(db)
		db.failWishlistDeleteOnce = true
		await assert.rejects(
			() => undoImport("member", id),
			/injected interruption/,
		)
		assert.equal(db.imports[0].status, "failed")
		await undoImport("member", id)
		assert.equal(db.imports[0].status, "undone")
		assert.deepEqual(undoResult(await getImportResult("member", id)), [
			[
				"not_restored",
				[["Anora", [{ type: "not-restored", list: "not_interested" }]]],
			],
			[
				"ratings_removed",
				[["Dune: Part Two", [{ type: "rating-removed", score: 9 }]]],
			],
			[
				"ratings_restored",
				[["Arrival", [{ type: "rating-restored", from: 9, to: 7 }]]],
			],
			[
				"want_removed",
				[["Anora", [{ type: "list-removed", list: "want_to_see" }]]],
			],
			["left", [["Shōgun", [{ type: "left", kind: "rating" }]]]],
		])
	})

	it("reads a rating and a Want to See the member removed after the import as left, not taken back", async () => {
		const db = new ImportDb()
		const id = await importForUndo(db)
		// The member removes Dune's imported rating and takes Anora off Want to See.
		db.scores = db.scores.filter((x) => x.tmdb_id !== 693134)
		db.wishlist = db.wishlist.filter((x) => x.tmdb_id !== 1064213)
		await undoImport("member", id)
		const result = await getImportResult("member", id)
		assert.deepEqual(
			section(result, "left").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[
				["Anora", [{ type: "left", kind: "want" }]],
				["Dune: Part Two", [{ type: "left", kind: "rating" }]],
				["Shōgun", [{ type: "left", kind: "rating" }]],
			],
		)
		assert.equal(
			result.sections.some(
				(s) => s.key === "ratings_removed" || s.key === "want_removed",
			),
			false,
		)
	})

	it("lists a row that couldn't be saved, with how to retry it", async () => {
		const db = new ImportDb()
		const id = seedImport(db, [
			{
				kind: "rating",
				tmdbId: 693134,
				title: "Dune: Part Two",
				score: 9,
				_preview: null,
			},
		])
		db.failScoreOnce = true
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		await confirmImport("member", id, { ...options, kinds: ["rating"] })
		await waitFor(db, "failed")
		assert.deepEqual(
			section(await getImportResult("member", id), "skipped").rows.map(
				(row) => row.changes,
			),
			[
				[
					{
						type: "skipped",
						kind: "rating",
						label: "Dune: Part Two (2024)",
						row: 1,
						reason: "Couldn't be saved. Import the file again to retry.",
					},
				],
			],
		)
	})

	it("lists a rating Undo could not put back under Not put back, not as left", async () => {
		const db = new ImportDb()
		const id = await importForUndo(db)
		// An older journal kept the earlier rating without its dates.
		const arrival = requiredRow(db.items.find((x) => x.tmdb_id === 329865))
		const payload = JSON.parse(String(arrival.payload))
		payload.journal.before.createdAt = undefined
		arrival.payload = JSON.stringify(payload)
		await undoImport("member", id)
		const result = await getImportResult("member", id)
		assert.deepEqual(
			section(result, "not_restored").rows.map((row) => [
				row.title?.title,
				row.changes,
			]),
			[
				["Anora", [{ type: "not-restored", list: "not_interested" }]],
				["Arrival", [{ type: "not-reverted", kind: "rating" }]],
			],
		)
		assert.deepEqual(
			section(result, "left").rows.map((row) => row.title?.title),
			["Shōgun"],
		)
	})

	it("reads a row as taken back when Undo stopped right after writing it", async () => {
		const db = new ImportDb()
		const id = await importForUndo(db)
		// Undo puts Arrival's 7 back, then stops before it records that.
		db.failUndoOutcomeOnce = "reverted"
		await assert.rejects(
			() => undoImport("member", id),
			/injected interruption/,
		)
		await undoImport("member", id)
		assert.deepEqual(undoResult(await getImportResult("member", id)), [
			[
				"not_restored",
				[["Anora", [{ type: "not-restored", list: "not_interested" }]]],
			],
			[
				"ratings_removed",
				[["Dune: Part Two", [{ type: "rating-removed", score: 9 }]]],
			],
			[
				"ratings_restored",
				[["Arrival", [{ type: "rating-restored", from: 9, to: 7 }]]],
			],
			[
				"want_removed",
				[["Anora", [{ type: "list-removed", list: "want_to_see" }]]],
			],
			["left", [["Shōgun", [{ type: "left", kind: "rating" }]]]],
		])
	})

	it("reads a show status as put back when Undo stopped right after restoring it", async () => {
		const { db, id } = await importDroppedStatus()
		db.failUndoOutcomeOnce = "reverted"
		await assert.rejects(
			() => undoImport("member", id),
			/injected interruption/,
		)
		await undoImport("member", id)
		const undone = await getImportResult("member", id)
		assert.deepEqual(
			undone.sections.map((s) => [s.key, s.rows.map((row) => row.changes)]),
			[
				[
					"statuses_restored",
					[
						[
							{
								type: "status-restored",
								status: { from: "dropped", to: null },
							},
						],
					],
				],
				["lists_restored", [[{ type: "list-restored", list: "want_to_see" }]]],
			],
		)
	})

	it("reads a show status the member removed after the import as left", async () => {
		const { db, trackingDb, id } = await importDroppedStatus()
		trackingDb.rows.set(
			"user_watch_state",
			trackingDb
				.table("user_watch_state")
				.filter((row) => row.tmdb_id !== 1668),
		)
		await undoImport("member", id)
		const undone = await getImportResult("member", id)
		assert.deepEqual(
			undone.sections.map((s) => [s.key, s.rows.map((row) => row.changes)]),
			[
				["not_restored", [[{ type: "not-restored", list: "want_to_see" }]]],
				["left", [[{ type: "left", kind: "show_status" }]]],
			],
		)
		assert.equal(db.imports[0].status, "undone")
	})
})

it("CSV preview matches IDs in priority order and only unique exact title/year, then applies and undoes its receipt", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
		{
			tmdb_id: 655,
			imdb_id: "tt0087884",
			title: "Paris, Texas",
			release_year: 1984,
		},
		{ tmdb_id: 10, imdb_id: "tt10", title: "Ambiguous", release_year: 2000 },
		{ tmdb_id: 11, imdb_id: "tt11", title: "Ambiguous", release_year: 2000 },
	]
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewImport(
		"member",
		"csv",
		"export.csv",
		Buffer.from(
			"tmdbID,imdbID,Title,Year,Rating10,Extra\n862,tt0087884,Wrong,1995,8,x\n999,tt0087884,Wrong,1984,5,x\n,,Toy Story,1995,8,x\n,,Ambiguous,2000,7,x\n,,Missing,2000,6,x\n",
		),
	)
	assert.deepEqual(db.catalogQueries, [
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE tmdb_id IN (?,?)",
			params: [862, 999],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE imdb_id IN (?)",
			params: ["tt0087884"],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2",
			params: ["Toy Story", 1995],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2",
			params: ["Ambiguous", 2000],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2",
			params: ["Missing", 2000],
		},
	])
	assert.equal(preview.counts.new, 3)
	assert.equal(preview.counts.unmatched, 2)
	const items = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.deepEqual(
		items.items.map((x) => x.tmdbId),
		[862, 655, 862, null, null],
	)
	assert.ok(items.items.slice(3).every((x) => x.reason))
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	const receipt = await getImport("member", preview.id)
	assert.equal(receipt.status, "done")
	assert.equal(receipt.applied.added, 2)
	assert.match(receipt.warnings.map((w) => w.message).join(" "), /Extra/)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
})

it("MovieLens combined upload matches only IDs and applies and undoes ratings and Want to See with receipt notes", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
		{
			tmdb_id: 655,
			imdb_id: "tt0087884",
			title: "Paris, Texas",
			release_year: 1984,
		},
	]
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewImport(
		"member",
		"movielens",
		"ratings.csv + wishlist.csv",
		Buffer.from(
			"movie_id,imdb_id,tmdb_id,rating,title\n1,0087884,862,4.5,Toy Story (1995)\n2,,,3,Toy Story (1995)\n",
		),
		Buffer.from(
			'movie_id,imdb_id,tmdb_id,title\n3,87884,999,"Paris, Texas (1984)"\n',
		),
	)
	assert.equal(preview.counts.new, 2)
	assert.equal(preview.counts.unmatched, 1)
	assert.equal(preview.kinds.watch, 0)
	assert.equal(preview.kinds.want, 1)
	const items = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.deepEqual(
		items.items.map((x) => x.tmdbId),
		[862, null, 655],
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["rating", "want"],
	})
	await waitFor(db, "done")
	const receipt = await getImport("member", preview.id)
	assert.equal(receipt.applied.added, 2)
	assert.match(
		receipt.warnings.map((w) => w.message).join(" "),
		/tags and activity logs are not applied/,
	)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	const again = await previewImport(
		"member",
		"movielens",
		"ratings.csv",
		Buffer.from(
			"movie_id,imdb_id,tmdb_id,rating,title\n1,0114709,862,4.5,Toy Story (1995)\n",
		),
	)
	assert.equal(again.counts.new, 1)
})

it("Kodi preview, apply, repeat receipt and undo preserve one watch and respect the date choice", async () => {
	for (const watchDates of ["preserve", "unknown"] as const) {
		const db = new ImportDb()
		db.catalog = [
			{
				tmdb_id: 862,
				imdb_id: "tt0114709",
				title: "Toy Story",
				release_year: 1995,
			},
		]
		const trackingDb = new FakeTrackingCrate()
		setCrateClientForTest(trackingDb)
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const file = Buffer.from(
			`<videodb><movie><title>Toy Story</title><uniqueid type="tmdb">862</uniqueid><playcount>5</playcount><lastplayed>2026-10-12</lastplayed></movie></videodb>`,
		)
		const preview = await previewImport("member", "kodi", "videodb.xml", file)
		assert.equal(preview.kinds.watch, 1)
		assert.equal((await getMovieTracking("member", 862)).log.length, 0)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["watch"],
			watchDates,
		})
		await waitFor(db, "done")
		const receipt = await getImport("member", preview.id)
		assert.equal(receipt.applied.added, 1)
		const tracking = await getMovieTracking("member", 862)
		assert.equal(tracking.log.length, 1)
		assert.equal(
			tracking.log[0].watched_at,
			watchDates === "preserve" ? Date.parse("2026-10-12") : null,
		)
		const repeated = await previewImport("member", "kodi", "videodb.xml", file)
		assert.equal(repeated.counts.unchanged, 1)
		await undoImport("member", preview.id)
		assert.equal((await getImport("member", preview.id)).status, "undone")
		assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	}
})

it("Kodi episodes resolve through TMDB and TVDB evidence, leave untrusted coordinates unmatched, and apply canonical watches", async (t) => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 1668,
			imdb_id: "tt0108778",
			title: "Friends",
			release_year: 1994,
		},
	]
	db.episodes = [
		{
			show_id: 1668,
			tmdb_id: 101,
			season_number: 4,
			episode_number: 23,
			name: "Finale",
			tvdb_id: null,
			removed_at: null,
			air_date: Date.UTC(1998, 4, 7),
		},
		{
			show_id: 1668,
			tmdb_id: 102,
			season_number: 4,
			episode_number: 22,
			name: "Before",
			tvdb_id: 9002,
			removed_at: null,
			air_date: Date.UTC(1998, 4, 1),
		},
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("episode", db.episodes)
	setCrateClientForTest(trackingDb)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	t.mock.method(
		globalThis,
		"fetch",
		async () =>
			new Response(
				JSON.stringify({ tv_episode_results: [{ id: 102, show_id: 1668 }] }),
				{ status: 200 },
			),
	)
	const episode = (ids: string, number: number) =>
		`<episodedetails>${ids}<season>4</season><episode>${number}</episode><playcount>3</playcount><lastplayed>2026-10-12</lastplayed></episodedetails>`
	const file = Buffer.from(
		`<videodb><tvshow><title>Friends</title><uniqueid type="tmdb">1668</uniqueid><playcount>100</playcount>${episode('<uniqueid type="tmdb">101</uniqueid>', 24)}${episode('<uniqueid type="tmdb">999</uniqueid><uniqueid type="tvdb">9002</uniqueid>', 23)}${episode("", 22)}</tvshow></videodb>`,
	)
	const preview = await previewImport("member", "kodi", "videodb.xml", file)
	const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.deepEqual(
		receipt.items.map((x) => [x.outcome, x.episodeTmdbId, x.episode]),
		[
			["new", 101, 23],
			["new", 102, 22],
			["unmatched", null, 22],
		],
	)
	assert.ok(receipt.items[2].reason)
	await confirmImport("member", preview.id, { ...options, kinds: ["watch"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 2)
	assert.deepEqual(
		(await getShowTracking("member", 1668)).log
			.map((x) => x.episode_tmdb_id)
			.sort(),
		[101, 102],
	)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).log.length, 0)
})

it("Kodi ratings prefer TMDB then IMDb, keep missing IDs unmatched, and apply and undo their receipt", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
		{
			tmdb_id: 655,
			imdb_id: "tt0087884",
			title: "Paris, Texas",
			release_year: 1984,
		},
	]
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const file = Buffer.from(
		`<videodb><movie><uniqueid type="tmdb">862</uniqueid><uniqueid type="imdb">tt0087884</uniqueid><userrating>9</userrating></movie><movie><uniqueid type="tmdb">999</uniqueid><id>tt0087884</id><userrating>8</userrating></movie><movie><title>Toy Story</title><year>1995</year><userrating>7</userrating></movie></videodb>`,
	)
	const preview = await previewImport("member", "kodi", "videodb.xml", file)
	assert.deepEqual(
		(await getImportItems("member", preview.id, undefined, 0, 50)).items.map(
			(x) => [x.outcome, x.tmdbId],
		),
		[
			["new", 862],
			["new", 655],
			["unmatched", null],
		],
	)
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 2)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(
		(await previewImport("member", "kodi", "videodb.xml", file)).counts.new,
		2,
	)
})

it("anime cour progress previews canonical episodes, keeps failed mappings on the receipt, and applies and undoes only its cour", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 120089,
			title: "Spy x Family",
			imdb_id: null,
			release_year: 2022,
		},
		{
			tmdb_id: 1429,
			title: "Attack on Titan",
			imdb_id: null,
			release_year: 2013,
		},
	]
	db.episodes = Array.from({ length: 25 }, (_, i) => ({
		show_id: 120089,
		tmdb_id: 10001 + i,
		season_number: 1,
		episode_number: i + 1,
		name: null,
		tvdb_id: null,
		removed_at: null,
		air_date: Date.UTC(2022, 0, 1),
	}))
	db.animeSnapshot = {
		schemaVersion: 1,
		entries: [
			{
				anidbId: 17061,
				showId: 120089,
				season: 1,
				offset: 12,
				ranges: [],
				ids: { myanimelist: [50602], anilist: [142838], kitsu: [45619] },
			},
			{
				anidbId: 17303,
				showId: 1429,
				season: 4,
				offset: 28,
				ranges: [],
				ids: { myanimelist: [51535], anilist: [146984], kitsu: [46038] },
			},
		],
	}
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("episode", db.episodes)
	setCrateClientForTest(trackingDb)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const base = {
		kind: "watch" as const,
		mediaType: "show" as const,
		title: "Spy x Family Part 2",
		year: 2022,
		tmdbId: null,
		imdbId: null,
		animeEntry: {
			source: "myanimelist" as const,
			id: 50602,
			progress: 13,
			episodeCount: 13,
		},
	}
	const preview = await previewParsedImport("member", "normalized-anime", {
		source: "csv",
		warnings: [],
		observations: [
			...Array.from({ length: 13 }, (_, i) => ({
				...base,
				key: `anime:50602:${i + 1}`,
				episode: i + 1,
				watchedAt: "2022-12-24",
				precision: "day" as const,
			})),
			{ ...base, key: "anime:50602:completed" },
			{
				...base,
				key: "anime:51535:1",
				animeEntry: {
					source: "myanimelist",
					id: 51535,
					progress: 2,
					episodeCount: 2,
				},
				episode: 1,
			},
			{
				...base,
				key: "anime:51535:want",
				kind: "want",
				animeEntry: { source: "myanimelist", id: 51535 },
			},
			...(["rating", "review"] as const).flatMap((kind) =>
				[null, 120089].map((tmdbId) => ({
					...base,
					key: `anime:50602:${kind}:${tmdbId}`,
					kind,
					tmdbId,
					score: 8,
					review: "A cour review",
				})),
			),
		],
	})
	const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.equal(preview.counts.new, 14)
	assert.equal(preview.counts.unmatched, 2)
	assert.equal(preview.counts.unsupported, 4)
	assert.ok(
		receipt.items
			.slice(16)
			.every(
				(item) =>
					item.outcome === "unsupported" &&
					/cour.*rating|cour.*review/i.test(item.reason ?? ""),
			),
	)
	assert.deepEqual(
		receipt.items.slice(0, 13).map((x) => x.episode),
		[13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
	)
	assert.ok(
		receipt.items
			.slice(0, 13)
			.every((x) => x.watchedAt === null && x.precision === "unknown"),
	)
	assert.match(receipt.items[14].reason ?? "", /does not fit/)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["watch", "want", "rating", "review"],
	})
	await waitFor(db, "done")
	const tracked = await getShowTracking("member", 120089)
	assert.equal(tracked.log.length, 13)
	assert.equal(tracked.state?.state, "watching")
	assert.ok(tracked.log.every((x) => x.watched_at === null))
	assert.equal((await getShowTracking("member", 1429)).log.length, 0)
	assert.equal((await getImport("member", preview.id)).applied.added, 14)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 120089)).log.length, 0)
})

it("show status observations preview, apply without watches, appear in the receipt, and undo", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	for (const showStatus of ["watching", "on_hold", "dropped"] as const) {
		const db = new ImportDb()
		db.catalog = [
			{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
		]
		setImportDbForTest(db)
		setCrateClientForTest(new FakeTrackingCrate())
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const parsed = {
			source: "trakt" as const,
			warnings: [],
			observations: [
				{
					key: "status:1668",
					kind: "show_status" as const,
					mediaType: "show" as const,
					title: "Friends",
					year: 1994,
					tmdbId: 1668,
					imdbId: null,
					showStatus,
				},
			],
		}
		const preview = await previewParsedImport(
			"member",
			"statuses.json",
			parsed,
			"synthetic",
		)
		assert.equal(preview.kinds.show_status, 1)
		assert.equal(preview.counts.new, 1)
		assert.equal((await getShowTracking("member", 1668)).state, null)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
		})
		await waitFor(db, "done")
		const show = await getShowTracking("member", 1668)
		assert.equal(show.state?.state, showStatus)
		assert.deepEqual(show.log, [])
		assert.equal((await getImport("member", preview.id)).applied.added, 1)
		const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
		assert.equal(receipt.items[0].showStatus, showStatus)
		assert.equal(receipt.items[0].applyState, "added")
		const repeated = await previewParsedImport(
			"member",
			"statuses.json",
			parsed,
			"synthetic",
		)
		assert.equal(repeated.counts.unchanged, 1)
		await undoImport("member", preview.id)
		assert.equal((await getShowTracking("member", 1668)).state, null)
	}
})

it("Completed without whole-show scope stays unapplied; whole-show completion marks aired regular episodes and undo removes them", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	for (const seasonAiring of [false, true])
		for (const completionScope of [undefined, "part", "show"] as const) {
			const db = new ImportDb()
			db.catalog = [
				{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
			]
			const trackingDb = new FakeTrackingCrate()
			trackingDb.seed("episode", [
				...(seasonAiring
					? [
							{
								show_id: 1668,
								tmdb_id: 102,
								season_number: 1,
								episode_number: 2,
								air_date: Date.now() + 86400000,
								removed_at: null,
							},
						]
					: []),
				{
					show_id: 1668,
					tmdb_id: 101,
					season_number: 1,
					episode_number: 1,
					air_date: Date.UTC(1994, 0, 1),
					removed_at: null,
				},
			])
			setImportDbForTest(db)
			setCrateClientForTest(trackingDb)
			setImportEffectsForTest(
				async () => {},
				async () => {},
			)
			const preview = await previewParsedImport(
				"member",
				"statuses.json",
				{
					source: "trakt",
					warnings: [],
					observations: [
						{
							key: "status:1668",
							kind: "show_status",
							mediaType: "show",
							title: "Friends",
							year: 1994,
							tmdbId: 1668,
							imdbId: null,
							showStatus: "completed",
							completionScope,
						},
					],
				},
				"synthetic",
			)
			assert.equal(
				preview.counts.unsupported,
				completionScope === "show" ? 0 : 1,
			)
			await confirmImport("member", preview.id, {
				...options,
				kinds: ["show_status"],
			})
			await waitFor(db, "done")
			const show = await getShowTracking("member", 1668)
			if (completionScope === "show") {
				assert.equal(show.state?.state, seasonAiring ? "watching" : "seen")
				assert.equal(show.state?.seen_press_group, null)
				assert.deepEqual(
					show.log.map((w) => [w.episode_tmdb_id, w.watched_at, w.origin]),
					[[101, null, "import"]],
				)
				assert.equal((await getImport("member", preview.id)).applied.added, 1)
			} else {
				assert.equal(show.state, null)
				assert.deepEqual(show.log, [])
				const receipt = await getImportItems(
					"member",
					preview.id,
					undefined,
					0,
					50,
				)
				assert.match(receipt.items[0].reason ?? "", /whole.*show/i)
			}
			await undoImport("member", preview.id)
			assert.equal((await getShowTracking("member", 1668)).state, null)
			assert.deepEqual((await getShowTracking("member", 1668)).log, [])
		}
})

for (const interrupted of [false, true])
	it(`Plan to watch adds only Want to See, with receipt and ${interrupted ? "resumed" : "normal"} undo`, async () => {
		const { previewParsedImport } = await import("./service.server.ts")
		const db = new ImportDb()
		db.catalog = [
			{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
		]
		setImportDbForTest(db)
		setCrateClientForTest(new FakeTrackingCrate())
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const parsed = {
			source: "trakt" as const,
			warnings: [],
			observations: [
				{
					key: "status:1668",
					kind: "show_status" as const,
					mediaType: "show" as const,
					title: "Friends",
					year: 1994,
					tmdbId: 1668,
					imdbId: null,
					showStatus: "plan_to_watch" as const,
				},
			],
		}
		const preview = await previewParsedImport(
			"member",
			"statuses.json",
			parsed,
			"synthetic",
		)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
		})
		await waitFor(db, "done")
		assert.equal((await getImport("member", preview.id)).applied.added, 1)
		assert.equal((await getShowTracking("member", 1668)).state, null)
		const again = await previewParsedImport(
			"member",
			"statuses.json",
			parsed,
			"synthetic",
		)
		assert.equal(again.counts.unchanged, 1)
		if (interrupted) {
			db.failWishlistDeleteOnce = true
			await assert.rejects(
				undoImport("member", preview.id),
				/injected interruption/,
			)
		}
		await undoImport("member", preview.id)
		assert.equal((await getImport("member", preview.id)).status, "undone")
		assert.equal(
			(
				await previewParsedImport(
					"member",
					"statuses.json",
					parsed,
					"synthetic",
				)
			).counts.new,
			1,
		)
	})

it("a member's move after preview wins over a source status, even when the new state is Watching", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const { applyTrackingEvent } = await import("../tracking.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed(
		"episode",
		[1, 2].map((id) => ({
			show_id: 1668,
			tmdb_id: id,
			season_number: 1,
			episode_number: id,
			air_date: Date.UTC(1994, 0, 1),
			removed_at: null,
		})),
	)
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{
					key: "status:1668",
					kind: "show_status",
					mediaType: "show",
					title: "Friends",
					year: 1994,
					tmdbId: 1668,
					imdbId: null,
					showStatus: "dropped",
				},
			],
		},
		"synthetic",
	)
	await applyTrackingEvent(
		"member",
		{ mediaType: "show", tmdbId: 1668 },
		{ type: "watch", season: 1, number: 1 },
		"645-member-watch",
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "done")
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
	assert.equal((await getImport("member", preview.id)).applied.kept, 1)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
})

it("conflicting statuses for one show stay unapplied with a reason instead of choosing an arbitrary row", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: ["watching", "dropped"].map((showStatus, index) => ({
				key: `status:${index}`,
				kind: "show_status" as const,
				mediaType: "show" as const,
				title: "Friends",
				year: 1994,
				tmdbId: 1668,
				imdbId: null,
				showStatus: showStatus as "watching" | "dropped",
			})),
		},
		"synthetic",
	)
	assert.equal(preview.counts.invalid, 2)
	const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.ok(
		receipt.items.every((item) => /multiple.*status/i.test(item.reason ?? "")),
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "done")
	assert.equal((await getShowTracking("member", 1668)).state, null)
})

it("show statuses reject movies and missing values and respect the selected kinds", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Title", release_year: 1994 },
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const base = {
		key: "status",
		kind: "show_status" as const,
		mediaType: "show" as const,
		title: "Title",
		year: 1994,
		tmdbId: 1668,
		imdbId: null,
	}
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{ ...base, key: "movie", mediaType: "movie", showStatus: "dropped" },
				{ ...base, key: "missing" },
				{
					...base,
					key: "season",
					season: 1,
					showStatus: "completed",
					completionScope: "show",
				},
				{ ...base, showStatus: "watching" },
			],
		},
		"synthetic",
	)
	assert.deepEqual(
		[preview.counts.unsupported, preview.counts.invalid, preview.counts.new],
		[2, 1, 1],
	)
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.kept, 4)
	assert.equal((await getShowTracking("member", 1668)).state, null)
})

it("a status receipt resumes after an interrupted write and undo restores the previous status without watches", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("user_watch_state", [
		{
			user_id: "member",
			tmdb_id: 1668,
			media_type: "show",
			state: "watching",
			pass: 1,
			state_changed_at: 0,
			updated_at: 1000,
			created_at: 1000,
			seen_press_group: null,
			seen_press_from: null,
			seen_question: null,
			rate_prompt_dismissed_at: null,
		},
	])
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{
					key: "status",
					kind: "show_status",
					mediaType: "show",
					title: "Friends",
					year: 1994,
					tmdbId: 1668,
					imdbId: null,
					showStatus: "on_hold",
				},
			],
		},
		"synthetic",
	)
	const run = db.run.bind(db)
	let interrupted = false
	db.run = async (sql, params) => {
		if (!interrupted && sql.includes("SET apply_state = 'added'")) {
			interrupted = true
			throw new Error("Interrupted after the tracking write")
		}
		return run(sql, params)
	}
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "failed")
	assert.equal((await getShowTracking("member", 1668)).state?.state, "on_hold")
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 1)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
	assert.deepEqual((await getShowTracking("member", 1668)).log, [])
})

it("existing On hold, Dropped and Seen decisions remain protected regardless of the conflict choice", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	for (const state of ["on_hold", "dropped", "seen"]) {
		const db = new ImportDb()
		db.catalog = [
			{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
		]
		const trackingDb = new FakeTrackingCrate()
		trackingDb.seed("user_watch_state", [
			{
				user_id: "member",
				tmdb_id: 1668,
				media_type: "show",
				state,
				pass: 1,
				state_changed_at: 1000,
				updated_at: 1000,
				created_at: 1000,
				seen_press_group: null,
				seen_press_from: null,
				seen_question: null,
				rate_prompt_dismissed_at: null,
			},
		])
		setImportDbForTest(db)
		setCrateClientForTest(trackingDb)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const preview = await previewParsedImport(
			"member",
			"statuses.json",
			{
				source: "trakt",
				warnings: [],
				observations: [
					{
						key: "status",
						kind: "show_status",
						mediaType: "show",
						title: "Friends",
						year: 1994,
						tmdbId: 1668,
						imdbId: null,
						showStatus: "watching",
					},
				],
			},
			"synthetic",
		)
		assert.equal(preview.counts.unchanged, 1)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
			conflictChoice: "source",
		})
		await waitFor(db, "done")
		assert.equal((await getImport("member", preview.id)).applied.kept, 1)
		await undoImport("member", preview.id)
		assert.equal((await getShowTracking("member", 1668)).state?.state, state)
	}
})

it("a status is kept when its imported watches finish an already Watching show", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	db.episodes = [
		{
			show_id: 1668,
			tmdb_id: 101,
			season_number: 1,
			episode_number: 1,
			name: "Pilot",
			air_date: Date.UTC(1994, 0, 1),
			removed_at: null,
		},
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("episode", db.episodes)
	trackingDb.seed("user_watch_state", [
		{
			user_id: "member",
			tmdb_id: 1668,
			media_type: "show",
			state: "watching",
			pass: 1,
			state_changed_at: 0,
			updated_at: 1000,
			created_at: 1000,
			seen_press_group: null,
			seen_press_from: null,
			seen_question: null,
			rate_prompt_dismissed_at: null,
		},
	])
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const base = {
		mediaType: "show" as const,
		title: "Friends",
		year: 1994,
		tmdbId: 1668,
		imdbId: null,
	}
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{ ...base, key: "status", kind: "show_status", showStatus: "watching" },
				{
					...base,
					key: "watch",
					kind: "watch",
					episodeTmdbId: 101,
					season: 1,
					episode: 1,
				},
			],
		},
		"synthetic",
	)
	assert.equal(preview.counts.new, 1)
	assert.equal(preview.counts.unchanged, 1)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["watch", "show_status"],
	})
	await waitFor(db, "done")
	const watched = await getShowTracking("member", 1668)
	assert.equal(watched.state?.state, "seen")
	assert.equal(watched.log.length, 1)
	assert.equal((await getImport("member", preview.id)).applied.added, 1)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
	assert.deepEqual((await getShowTracking("member", 1668)).log, [])
})

it("previews a thousand show statuses with bounded tracking reads and no episode reads", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	const trackingDb = new FakeTrackingCrate()
	db.catalog = Array.from({ length: 1000 }, (_, i) => ({
		tmdb_id: 10000 + i,
		imdb_id: null,
		title: `Show ${i}`,
		release_year: 2020,
	}))
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	const result = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: db.catalog.map((show, i) => ({
				key: `status:${show.tmdb_id}`,
				kind: "show_status",
				mediaType: "show",
				title: String(show.title),
				year: 2020,
				tmdbId: Number(show.tmdb_id),
				imdbId: null,
				showStatus: (
					[
						"watching",
						"on_hold",
						"dropped",
						"plan_to_watch",
						"completed",
					] as const
				)[i % 5],
				completionScope: "show",
			})),
		},
		"synthetic",
	)
	assert.equal(result.counts.new, 1000)
	assert.ok(
		trackingDb.statements.length <= 5,
		`${trackingDb.statements.length} tracking statements`,
	)
	assert.equal(
		trackingDb.statements.filter(({ sql }) => sql.includes("FROM episode"))
			.length,
		0,
	)
})

it("re-importing Dropped after Resume explains the replacement in this show's preview and receipt", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const { applyTrackingEvent } = await import("../tracking.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	setImportDbForTest(db)
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed(
		"episode",
		[1, 2].map((id) => ({
			show_id: 1668,
			tmdb_id: id,
			season_number: 1,
			episode_number: id,
			air_date: Date.UTC(1994, 0, 1),
			removed_at: null,
		})),
	)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const parsed = {
		source: "trakt" as const,
		warnings: [],
		observations: [
			{
				key: "drop",
				kind: "show_status" as const,
				mediaType: "show" as const,
				tmdbId: 1668,
				imdbId: null,
				title: "Friends",
				year: 1994,
				showStatus: "dropped" as const,
			},
		],
	}
	await applyTrackingEvent(
		"member",
		{ mediaType: "show", tmdbId: 1668 },
		{ type: "watch", season: 1, number: 1 },
		"first-watch",
	)
	const first = await previewParsedImport(
		"member",
		"statuses.json",
		parsed,
		"same-file",
	)
	await confirmImport("member", first.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "done")
	await applyTrackingEvent(
		"member",
		{ mediaType: "show", tmdbId: 1668 },
		{ type: "resume" },
		"resume-show",
	)
	const again = await previewParsedImport(
		"member",
		"statuses.json",
		parsed,
		"same-file",
	)
	const before = await getImportItems("member", again.id, undefined, 0, 50)
	assert.match(before.items[0].reason ?? "", /Watching.*Dropped/)
	assert.match(before.items[0].reason ?? "", /resumed.*earlier import/)
	await confirmImport("member", again.id, {
		...options,
		kinds: ["show_status"],
	})
	// Wait for this upload, rather than the first receipt that is already done.
	for (
		let i = 0;
		i < 100 && (await getImport("member", again.id)).status === "running";
		i++
	)
		await new Promise((resolve) => setTimeout(resolve, 5))
	assert.equal((await getShowTracking("member", 1668)).state?.state, "dropped")
	const receipt = await getImportItems("member", again.id, undefined, 0, 50)
	assert.equal(receipt.items[0].applyState, "added")
	assert.equal(receipt.items[0].reason, before.items[0].reason)
})

it("a fetched source uses the shared preview, receipt and undo without a file", async () => {
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
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const { previewFetchedImport } = await import("./service.server.ts")
	const preview = await previewFetchedImport("member", "TMDB account", {
		source: "tmdb",
		warnings: [
			{ kind: "info", message: "Half steps round up: 7.5 becomes 8." },
		],
		observations: [
			{
				key: "tmdb:rating:movie:862",
				kind: "rating",
				mediaType: "movie",
				title: "Toy Story",
				year: 1995,
				tmdbId: 862,
				imdbId: null,
				score: 8,
				addedAt: "2020-02-01T12:00:00.000Z",
			},
		],
	})
	assert.equal(preview.fileName, "TMDB account")
	assert.equal(preview.source, "tmdb")
	assert.equal(preview.counts.new, 1)
	assert.equal(preview.kinds.watch, 0)
	assert.equal(
		(await getImportItems("member", preview.id, undefined, 0, 50)).items[0]
			.addedAt,
		"2020-02-01T12:00:00.000Z",
	)
	await assert.rejects(getImport("someone-else", preview.id))
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 1)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
})

it("TMDB's six fetched lists share kind selection, skipped receipts, repeat preview and undo", async () => {
	const db = new ImportDb()
	db.catalog = [1, 2, 3].map((tmdb_id) => ({
		tmdb_id,
		imdb_id: null,
		title: "Synthetic title",
		release_year: 2000,
	}))
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const { createTmdbClient } = await import("./tmdb-client.server.ts")
	const { previewFetchedImport, getSkippedCsv } = await import(
		"./service.server.ts"
	)
	const client = createTmdbClient({
		apiKey: "app",
		sleep: async () => {},
		fetch: async (url) => {
			const path = new URL(String(url)).pathname
			const id = path.includes("/rated/")
				? 1
				: path.includes("/watchlist/")
					? 2
					: 3
			const results = [
				{
					id,
					title: "Synthetic title",
					name: "Synthetic show",
					rating: 8.5,
				},
				...(path.endsWith("rated/movies")
					? [{ id: 99, title: "Missing title" }]
					: []),
			]
			return Response.json({
				page: 1,
				total_pages: 1,
				total_results: results.length,
				results,
			})
		},
	})
	const read = () => client.readAccount("account", "member-token")
	const preview = await previewFetchedImport(
		"member",
		"TMDB account",
		await read(),
	)
	assert.deepEqual(preview.kinds, {
		show_status: 0,
		rating: 3,
		watch: 0,
		want: 2,
		favorite: 2,
		review: 0,
	})
	assert.equal(preview.counts.invalid, 1)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["rating", "want", "favorite"],
	})
	await waitFor(db, "done")
	const receipt = await getImport("member", preview.id)
	assert.equal(receipt.applied.added, 6)
	assert.match(await getSkippedCsv("member", preview.id), /Missing title/)
	const repeat = await previewFetchedImport(
		"member",
		"TMDB account",
		await read(),
	)
	assert.equal(repeat.counts.unchanged, 6)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	const afterUndo = await previewFetchedImport(
		"member",
		"TMDB account",
		await read(),
	)
	assert.equal(afterUndo.counts.new, 6)
})

it("MAL file preview retains season scores and applies On hold with only mapped cour watches, supports repeat receipts and undo", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 120089,
			title: "Spy x Family",
			imdb_id: null,
			release_year: 2022,
		},
	]
	db.episodes = Array.from({ length: 25 }, (_, i) => ({
		show_id: 120089,
		tmdb_id: 10001 + i,
		season_number: 1,
		episode_number: i + 1,
		name: null,
		tvdb_id: null,
		removed_at: null,
		air_date: Date.UTC(2022, 0, 1),
	}))
	db.animeSnapshot = {
		schemaVersion: 1,
		entries: [
			{
				anidbId: 17061,
				showId: 120089,
				season: 1,
				offset: 12,
				ranges: [],
				ids: { myanimelist: [50602], anilist: [], kitsu: [] },
			},
		],
	}
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("episode", db.episodes)
	setCrateClientForTest(trackingDb)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const file = Buffer.from(
		"<myanimelist><myinfo><user_export_type>1</user_export_type></myinfo><anime><series_animedb_id>50602</series_animedb_id><series_title>Spy x Family Part 2</series_title><series_episodes>13</series_episodes><my_watched_episodes>2</my_watched_episodes><my_status>On-Hold</my_status><my_score>8</my_score><my_times_watched>3</my_times_watched></anime></myanimelist>",
	)
	const preview = await previewImport(
		"member",
		"myanimelist",
		"animelist.xml",
		file,
	)
	assert.equal(preview.counts.new, 3)
	assert.equal((await getShowTracking("member", 120089)).log.length, 0)
	const rows = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items
	assert.deepEqual(
		rows.filter((x) => x.kind === "watch").map((x) => x.episode),
		[13, 14],
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["watch", "rating", "show_status"],
	})
	await waitFor(db, "done")
	const tracked = await getShowTracking("member", 120089)
	assert.equal(tracked.state?.state, "on_hold")
	assert.equal(tracked.log.length, 2)
	assert.ok(tracked.log.every((x) => x.watched_at === null))
	const receipt = await getImport("member", preview.id)
	assert.equal(receipt.applied.added, 3)
	assert.match(
		receipt.warnings.map((w) => w.message).join(" "),
		/comments and tags/i,
	)
	const repeated = await previewImport(
		"member",
		"myanimelist",
		"kitsu-member-anime.xml",
		file,
	)
	assert.equal(repeated.counts.new, 0)
	const repeatedRows = (
		await getImportItems("member", repeated.id, undefined, 0, 50)
	).items
	assert.equal(repeatedRows.find((x) => x.score != null)?.score, 8)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	const undone = await getShowTracking("member", 120089)
	assert.equal(undone.log.length, 0)
	assert.ok(!undone.state || undone.state.state === "not_started")
	const restored = await previewImport(
		"member",
		"myanimelist",
		"animelist.xml",
		file,
	)
	assert.equal(restored.counts.new, 3)
})

it("completed MAL cours date watches only when both complete dates establish one viewing day, and never fill the rest of a show", async () => {
	for (const [
		start,
		finish,
		watchDates,
		expected,
		fileName = "animelist.xml.gz",
	] of [
		["2022-12-24", "2022-12-24", "preserve", "2022-12-24"],
		["2022-12-24", "2022-12-24", "unknown", null],
		["2022-10-01", "2022-12-24", "preserve", null],
		["0000-00-00", "2022-12-24", "preserve", null],
		["2022-02-30", "2022-02-30", "preserve", null],
		["2022-12-24", "2022-12-24", "preserve", null, "kitsu-member-anime.xml"],
	] as const) {
		const db = new ImportDb()
		db.catalog = [
			{
				tmdb_id: 120089,
				title: "Spy x Family",
				imdb_id: null,
				release_year: 2022,
			},
		]
		db.episodes = Array.from({ length: 25 }, (_, i) => ({
			show_id: 120089,
			tmdb_id: 10001 + i,
			season_number: 1,
			episode_number: i + 1,
			name: null,
			tvdb_id: null,
			removed_at: null,
			air_date: Date.UTC(2022, 0, 1),
		}))
		db.animeSnapshot = {
			schemaVersion: 1,
			entries: [
				{
					anidbId: 17061,
					showId: 120089,
					season: 1,
					offset: 12,
					ranges: [],
					ids: { myanimelist: [50602], anilist: [], kitsu: [] },
				},
			],
		}
		const trackingDb = new FakeTrackingCrate()
		trackingDb.seed("episode", db.episodes)
		setCrateClientForTest(trackingDb)
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const file = Buffer.from(
			`<myanimelist><myinfo><user_export_type>1</user_export_type><user_name>synthetic</user_name></myinfo><anime><series_animedb_id>50602</series_animedb_id><series_episodes>13</series_episodes><my_watched_episodes>13</my_watched_episodes><my_status>Completed</my_status><my_score>0</my_score><my_start_date>${start}</my_start_date><my_finish_date>${finish}</my_finish_date></anime></myanimelist>`,
		)
		const preview = await previewImport("member", "myanimelist", fileName, file)
		assert.equal(preview.counts.new, 13)
		assert.equal(preview.counts.unsupported, 1)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["watch", "show_status"],
			watchDates,
		})
		await waitFor(db, "done")
		const tracked = await getShowTracking("member", 120089)
		assert.equal(tracked.log.length, 13)
		assert.equal(tracked.state?.state, "watching")
		assert.ok(
			tracked.log.every(
				(x) => x.watched_at === (expected ? Date.parse(expected) : null),
			),
		)
		await undoImport("member", preview.id)
		assert.equal((await getShowTracking("member", 120089)).log.length, 0)
	}
})

it("different anime entry scores and statuses for one show stay unapplied instead of depending on XML order", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 120089,
			title: "Spy x Family",
			imdb_id: null,
			release_year: 2022,
		},
	]
	db.animeSnapshot = {
		schemaVersion: 1,
		entries: [
			{
				anidbId: 17061,
				showId: 120089,
				season: 1,
				offset: 0,
				ranges: [],
				ids: { myanimelist: [50265, 50602], anilist: [], kitsu: [] },
			},
		],
	}
	setCrateClientForTest(new FakeTrackingCrate())
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const file = Buffer.from(
		`<myanimelist><myinfo><user_export_type>1</user_export_type></myinfo>${[50265, 50602].map((id, i) => `<anime><series_animedb_id>${id}</series_animedb_id><my_status>${i ? "Dropped" : "Watching"}</my_status><my_score>${i ? 9 : 8}</my_score></anime>`).join("")}</myanimelist>`,
	)
	const preview = await previewImport(
		"member",
		"myanimelist",
		"kitsu-member-anime.xml",
		file,
	)
	assert.equal(preview.counts.invalid, 2)
	const items = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items
	assert.ok(
		items
			.filter((x) => x.score != null)
			.every((x) => /season score.*kept for later/i.test(x.reason || "")),
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["rating", "show_status"],
	})
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 0)
	assert.equal((await getShowTracking("member", 120089)).log.length, 0)
})

function setupCourStatuses() {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 120089,
			title: "Spy x Family",
			imdb_id: null,
			release_year: 2022,
		},
	]
	db.animeSnapshot = {
		schemaVersion: 1,
		entries: [
			{
				anidbId: 17061,
				showId: 120089,
				season: 1,
				offset: 0,
				ranges: [],
				ids: { myanimelist: [50265, 50602], anilist: [], kitsu: [] },
			},
		],
	}
	setCrateClientForTest(new FakeTrackingCrate())
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	return db
}
const courStatuses = (first: string, second: string) =>
	Buffer.from(
		`<myanimelist><myinfo><user_export_type>1</user_export_type></myinfo><anime><series_animedb_id>50265</series_animedb_id><my_status>${first}</my_status></anime><anime><series_animedb_id>50602</series_animedb_id><my_status>${second}</my_status></anime></myanimelist>`,
	)

it("identical cour statuses make one show change, keep duplicate rows on the receipt, and undo together", async () => {
	for (const status of [
		"Plan to Watch",
		"Watching",
		"On-Hold",
		"Dropped",
		"Completed",
	]) {
		const db = setupCourStatuses()
		const file = courStatuses(status, status)
		const preview = await previewImport(
			"member",
			"myanimelist",
			"animelist.xml",
			file,
		)
		assert.equal(preview.counts.invalid, 0, status)
		assert.equal(preview.counts.unchanged, 1, status)
		assert.equal(preview.counts.new, status === "Completed" ? 0 : 1, status)
		assert.equal(
			preview.counts.unsupported,
			status === "Completed" ? 1 : 0,
			status,
		)
		const rows = (await getImportItems("member", preview.id, undefined, 0, 50))
			.items
		assert.match(
			rows.find((x) => x.outcome === "unchanged")?.reason ?? "",
			/same status.*once/i,
		)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
		})
		await waitFor(db, "done")
		assert.equal(
			(await getImport("member", preview.id)).applied.added,
			status === "Completed" ? 0 : 1,
		)
		const repeated = await previewImport(
			"member",
			"myanimelist",
			"animelist.xml",
			file,
		)
		assert.equal(repeated.counts.new, 0)
		await undoImport("member", preview.id)
		const restored = await previewImport(
			"member",
			"myanimelist",
			"animelist.xml",
			file,
		)
		assert.equal(restored.counts.new, status === "Completed" ? 0 : 1)
	}
})

it("different cour statuses name every conflicting status, including Completed, regardless of file order", async () => {
	for (const pair of [
		["Completed", "Watching"],
		["Plan to Watch", "Dropped"],
	]) {
		for (const statuses of [pair, [...pair].reverse()]) {
			const db = setupCourStatuses()
			const preview = await previewImport(
				"member",
				"myanimelist",
				"animelist.xml",
				courStatuses(statuses[0], statuses[1]),
			)
			assert.equal(preview.counts.invalid, 2)
			const rows = (
				await getImportItems("member", preview.id, undefined, 0, 50)
			).items
			for (const row of rows) {
				assert.match(row.reason || "", /MyAnimeList.*different statuses/)
				for (const status of pair)
					assert.ok(row.reason?.toLowerCase().includes(status.toLowerCase()))
			}
			await confirmImport("member", preview.id, {
				...options,
				kinds: ["show_status"],
			})
			await waitFor(db, "done")
			assert.equal((await getImport("member", preview.id)).applied.added, 0)
		}
	}
})

it("cour scores retain each entry's full pinned placement through apply and undo without rating or marking the show Seen", async () => {
	const db = setupCourStatuses()
	db.episodes = Array.from({ length: 25 }, (_, i) => ({
		show_id: 120089,
		tmdb_id: 10001 + i,
		season_number: 1,
		episode_number: i + 1,
		name: null,
		tvdb_id: null,
		removed_at: null,
		air_date: Date.UTC(2022, 0, 1),
	}))
	db.animeSnapshot = {
		schemaVersion: 1,
		entries: [
			{
				anidbId: 17060,
				showId: 120089,
				season: 1,
				offset: 0,
				ranges: [],
				ids: { myanimelist: [50265], anilist: [], kitsu: [] },
			},
			{
				anidbId: 17061,
				showId: 120089,
				season: 1,
				offset: 12,
				ranges: [],
				ids: { myanimelist: [50602], anilist: [], kitsu: [] },
			},
		],
	}
	const file = Buffer.from(
		`<myanimelist><myinfo><user_export_type>1</user_export_type></myinfo>${[50265, 50602].map((id, i) => `<anime><series_animedb_id>${id}</series_animedb_id><series_episodes>${i ? 13 : 12}</series_episodes><my_status>Plan to Watch</my_status><my_score>${i ? 9 : 8}</my_score></anime>`).join("")}</myanimelist>`,
	)
	const preview = await previewImport(
		"member",
		"myanimelist",
		"animelist.xml",
		file,
	)
	assert.equal(preview.counts.new, 1)
	assert.equal(preview.counts.unsupported, 2)
	const scoreRows = async () =>
		(await getImportItems("member", preview.id, undefined, 0, 50)).items.filter(
			(row) => row.score != null,
		)
	const scores = await scoreRows()
	assert.deepEqual(
		scores.map((row) => [
			row.score,
			row.animeEntry?.id,
			row.tmdbId,
			row.animeScorePlacement?.ranges,
		]),
		[
			[8, 50265, 120089, [{ season: 1, firstEpisode: 1, lastEpisode: 12 }]],
			[9, 50602, 120089, [{ season: 1, firstEpisode: 13, lastEpisode: 25 }]],
		],
	)
	assert.deepEqual(
		scores.map((row) => row.animeScorePlacement?.mapping?.offset),
		[0, 12],
	)
	assert.ok(
		scores.every(
			(row) =>
				row.kind === "unsupported" &&
				/season score.*kept for later.*not applied/i.test(row.reason ?? ""),
		),
	)
	// Changing the live snapshot must not rewrite receipt evidence.
	db.animeSnapshot = null
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["rating", "show_status"],
	})
	await waitFor(db, "done")
	const receipt = await getImport("member", preview.id)
	assert.equal(receipt.applied.added, 1)
	assert.match(
		receipt.warnings.map((w) => w.message).join(" "),
		/season scores.*kept for later.*not applied/i,
	)
	assert.deepEqual(
		(await scoreRows()).map(({ applyState, ...row }) => row),
		scores.map(({ applyState, ...row }) => row),
	)
	const tracking = await getShowTracking("member", 120089)
	assert.equal(tracking.state, null)
	assert.equal(tracking.log.length, 0)
	// A subsequent show-rating preview must still see no existing score.
	const check = await previewParsedImport("member", "score.csv", {
		source: "csv",
		observations: [
			{
				key: "show-score",
				kind: "rating",
				mediaType: "show",
				title: "Spy x Family",
				year: 2022,
				tmdbId: 120089,
				imdbId: null,
				score: 7,
			},
		],
		warnings: [],
	})
	assert.equal(check.counts.new, 1)
	assert.equal(
		(await getImportItems("member", check.id, undefined, 0, 50)).items[0]
			.currentScore,
		null,
	)
	await undoImport("member", preview.id)
	assert.deepEqual(
		(await scoreRows()).map(({ applyState, ...row }) => row),
		scores.map(({ applyState, ...row }) => row),
	)
	assert.equal((await getImport("member", preview.id)).status, "undone")
})

it("unresolved cour scores keep their facts and a reason without inventing episode ranges", async () => {
	for (const situation of [
		"unknown-total",
		"missing-catalog",
		"missing-snapshot",
	] as const) {
		const db = setupCourStatuses()
		if (situation === "missing-snapshot") db.animeSnapshot = null
		const file = Buffer.from(
			`<myanimelist><myinfo><user_export_type>1</user_export_type></myinfo><anime><series_animedb_id>50265</series_animedb_id><series_episodes>${situation === "unknown-total" ? 0 : 12}</series_episodes><my_status>Plan to Watch</my_status><my_score>8</my_score></anime></myanimelist>`,
		)
		const preview = await previewImport(
			"member",
			"myanimelist",
			"animelist.xml",
			file,
		)
		const score = (
			await getImportItems("member", preview.id, undefined, 0, 50)
		).items.find((row) => row.score === 8)
		assert.ok(score)
		assert.equal(score.animeEntry?.id, 50265)
		assert.equal(score.outcome, "unsupported")
		assert.equal(score.animeScorePlacement?.ranges, null)
		assert.ok(score.animeScorePlacement?.reason)
		assert.equal(score.tmdbId, situation === "missing-snapshot" ? null : 120089)
		assert.equal(
			score.animeScorePlacement?.mapping?.showId,
			situation === "missing-snapshot" ? undefined : 120089,
		)
		assert.match(score.reason ?? "", /kept for later.*not applied/)
	}
})

it("shared Wishlist matches a unique typed title and year, preserves evidence, and undoes only imported wishes", async () => {
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
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const evidence = {
		source: "test-capture",
		completeness: "partial" as const,
		mediaType: "movie" as const,
		sourceId: "provider-42",
	}
	const preview = await previewParsedImport("member", "wishlist.json", {
		source: "wishlist",
		warnings: [],
		observations: [
			{
				key: "wishlist:one",
				kind: "want",
				title: "Toy Story",
				year: 1995,
				mediaType: "movie",
				tmdbId: null,
				imdbId: null,
				wishlistEvidence: evidence,
			},
		],
	})
	assert.equal(preview.counts.new, 1)
	assert.equal(preview.kinds.watch, 0)
	assert.equal(db.wishlist.length, 0)
	const rows = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.equal(rows.items[0].tmdbId, 862)
	assert.deepEqual(rows.items[0].wishlistEvidence, evidence)
	await confirmImport("member", preview.id, { ...options, kinds: ["want"] })
	await waitFor(db, "done")
	assert.equal(db.wishlist.length, 1)
	await undoImport("member", preview.id)
	assert.equal(db.wishlist.length, 0)
})

it("shared Wishlist keeps ambiguous remakes and unknown media types unmatched", async () => {
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1, imdb_id: null, title: "Same title", release_year: 2000 },
		{ tmdb_id: 2, imdb_id: null, title: "Same title", release_year: 2000 },
	]
	setImportDbForTest(db)
	const preview = await previewParsedImport("member", "wishlist.json", {
		source: "wishlist",
		warnings: [],
		observations: [
			{
				key: "one",
				kind: "want",
				title: "Same title",
				year: 2000,
				mediaType: "movie",
				tmdbId: null,
				imdbId: null,
			},
			{
				key: "two",
				kind: "want",
				title: "Same title",
				year: 2000,
				mediaType: "movie",
				tmdbId: 1,
				imdbId: null,
				problem: { outcome: "unmatched", reason: "Unknown media type" },
				wishlistEvidence: {
					source: "capture",
					completeness: "unknown",
					mediaType: "unknown",
				},
			},
		],
	})
	assert.equal(preview.counts.new, 0)
	assert.equal(preview.counts.unmatched, 2)
	assert.equal(db.wishlist.length, 0)
})

it("an explicit Wishlist wish can coexist with a prior watch and Undo preserves that watch", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
	]
	const watch = {
		user_id: "member",
		tmdb_id: 862,
		media_type: "movie",
		watch_id: "existing-watch",
	}
	db.watches = [watch]
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewParsedImport("member", "wishlist.json", {
		source: "wishlist",
		warnings: [],
		observations: [
			{
				key: "one",
				kind: "want",
				title: "Toy Story",
				year: 1995,
				mediaType: "movie",
				tmdbId: 862,
				imdbId: null,
				wishlistEvidence: {
					source: "capture",
					completeness: "complete",
					mediaType: "movie",
				},
			},
		],
	})
	assert.equal(preview.counts.conflict, 1)
	await confirmImport("member", preview.id, { ...options, kinds: ["want"] })
	await waitFor(db, "done")
	assert.equal(db.wishlist.length, 1)
	assert.deepEqual(db.watches, [watch])
	await undoImport("member", preview.id)
	assert.equal(db.wishlist.length, 0)
	assert.deepEqual(db.watches, [watch])
})

function wishlistShowFixture(state: string) {
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	const trackingDb = new FakeTrackingCrate()
	const seedState = (next: string) => {
		trackingDb.table("user_watch_state").length = 0
		trackingDb.seed("user_watch_state", [
			{
				user_id: "member",
				tmdb_id: 1668,
				media_type: "show",
				state: next,
				pass: 1,
				state_changed_at: 0,
				updated_at: 1000,
				created_at: 1000,
				seen_press_group: null,
				seen_press_from: null,
				seen_question: null,
				rate_prompt_dismissed_at: null,
			},
		])
	}
	seedState(state)
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = () =>
		previewParsedImport("member", "wishlist.json", {
			source: "wishlist",
			warnings: [],
			observations: [
				{
					key: "wish",
					kind: "want",
					title: "Friends",
					year: 1994,
					mediaType: "show",
					tmdbId: 1668,
					imdbId: null,
					wishlistEvidence: {
						source: "capture",
						completeness: "unknown",
						mediaType: "show",
					},
				},
			],
		})
	return { db, trackingDb, seedState, preview }
}

it("Wishlist imports preserve Watching, On hold and Dropped shows even when source wishes are selected", async () => {
	for (const state of ["watching", "on_hold", "dropped"]) {
		const { db, preview } = wishlistShowFixture(state)
		const result = await preview()
		assert.equal(result.counts.unchanged, 1, state)
		await confirmImport("member", result.id, { ...options, kinds: ["want"] })
		await waitFor(db, "done")
		assert.equal(db.wishlist.length, 0, state)
		assert.equal((await getShowTracking("member", 1668)).state?.state, state)
	}
})

it("a Seen show without episode logs needs explicit rewatch opt-in and Undo preserves Seen", async () => {
	for (const conflictChoice of ["keep", "source"] as const) {
		const { db, preview } = wishlistShowFixture("seen")
		const result = await preview()
		assert.equal(result.counts.conflict, 1)
		await confirmImport("member", result.id, {
			...options,
			kinds: ["want"],
			conflictChoice,
		})
		await waitFor(db, "done")
		assert.equal(db.wishlist.length, conflictChoice === "source" ? 1 : 0)
		assert.equal((await getShowTracking("member", 1668)).state?.state, "seen")
		await undoImport("member", result.id)
		assert.equal(db.wishlist.length, 0)
		const tracking = await getShowTracking("member", 1668)
		assert.equal(tracking.state?.state, "seen")
		assert.equal(tracking.log.length, 0)
	}
})

it("Wishlist apply rechecks show state after preview before adding a wish", async () => {
	for (const next of ["watching", "on_hold", "dropped", "seen"]) {
		for (const conflictChoice of ["keep", "source"] as const) {
			const { db, seedState, preview } = wishlistShowFixture("not_started")
			const result = await preview()
			assert.equal(result.counts.new, 1)
			seedState(next)
			await confirmImport("member", result.id, {
				...options,
				kinds: ["want"],
				conflictChoice,
			})
			await waitFor(db, "done")
			assert.equal(
				db.wishlist.length,
				next === "seen" && conflictChoice === "source" ? 1 : 0,
				`${next}/${conflictChoice}`,
			)
			assert.equal((await getShowTracking("member", 1668)).state?.state, next)
		}
	}
})

it("Wishlist entries with different source identities resolving to one title are added and undone once", async () => {
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
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const result = await previewParsedImport("member", "wishlist.json", {
		source: "wishlist",
		warnings: [],
		observations: [
			{
				key: "first",
				kind: "want",
				title: "Toy Story",
				year: 1995,
				mediaType: "movie",
				tmdbId: 862,
				imdbId: null,
				wishlistEvidence: {
					source: "capture",
					sourceId: "native-one",
					completeness: "unknown",
					mediaType: "movie",
				},
			},
			{
				key: "second",
				kind: "want",
				title: "Toy Story",
				year: 1995,
				mediaType: "movie",
				tmdbId: null,
				imdbId: "tt0114709",
				wishlistEvidence: {
					source: "capture",
					sourceId: "native-two",
					completeness: "unknown",
					mediaType: "movie",
				},
			},
		],
	})
	assert.equal(result.counts.new, 1)
	assert.equal(result.counts.unsupported, 1)
	const rows = await getImportItems("member", result.id, undefined, 0, 50)
	assert.equal(rows.items[1].reason, "Listed twice in the file. Added once.")
	assert.equal(rows.items[1].wishlistEvidence?.sourceId, "native-two")
	await confirmImport("member", result.id, { ...options, kinds: ["want"] })
	await waitFor(db, "done")
	assert.equal(db.wishlist.length, 1)
	assert.equal((await getImport("member", result.id)).applied.added, 1)
	await undoImport("member", result.id)
	assert.equal(db.wishlist.length, 0)
})

it("Seen movies stay off Wishlist by default and an existing rewatch wish never invites another opt-in", async () => {
	for (const conflictChoice of ["keep", "source"] as const) {
		const db = new ImportDb()
		db.catalog = [
			{
				tmdb_id: 862,
				imdb_id: "tt0114709",
				title: "Toy Story",
				release_year: 1995,
			},
		]
		db.watches = [
			{
				user_id: "member",
				tmdb_id: 862,
				media_type: "movie",
				watch_id: "existing-watch",
			},
		]
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const parsed = {
			source: "wishlist" as const,
			warnings: [],
			observations: [
				{
					key: "wish",
					kind: "want" as const,
					title: "Toy Story",
					year: 1995,
					mediaType: "movie" as const,
					tmdbId: 862,
					imdbId: null,
					wishlistEvidence: {
						source: "capture",
						completeness: "unknown" as const,
						mediaType: "movie" as const,
					},
				},
			],
		}
		const first = await previewParsedImport("member", "wishlist.json", parsed)
		assert.equal(first.counts.conflict, 1)
		await confirmImport("member", first.id, {
			...options,
			kinds: ["want"],
			conflictChoice,
		})
		await waitFor(db, "done")
		assert.equal(db.wishlist.length, conflictChoice === "source" ? 1 : 0)
		if (conflictChoice === "source") {
			const repeat = await previewParsedImport(
				"member",
				"wishlist.json",
				parsed,
			)
			assert.equal(repeat.counts.unchanged, 1)
			assert.equal(repeat.counts.conflict, 0)
			const rows = await getImportItems("member", repeat.id, undefined, 0, 50)
			assert.equal(rows.items[0].reason, null)
		}
		await undoImport("member", first.id)
		assert.equal(db.wishlist.length, 0)
		assert.equal(db.watches.length, 1)
	}
})

it("stored warnings retain their kind and legacy string warnings stay actionable", async () => {
	const db = new ImportDb()
	db.seed()
	setImportDbForTest(db)
	db.imports[0].warnings = JSON.stringify([
		"Legacy reconnect instruction",
		{ kind: "actionable", message: "Reconnect Plex" },
		{ kind: "info", message: "RSS coverage note" },
	])
	const result = await getImport("member", String(db.imports[0].id))
	assert.deepEqual(result.warnings, [
		{ kind: "actionable", message: "Legacy reconnect instruction" },
		{ kind: "actionable", message: "Reconnect Plex" },
		{ kind: "info", message: "RSS coverage note" },
	])
})

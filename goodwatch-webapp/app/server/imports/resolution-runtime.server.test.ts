import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"
import type { Param } from "./store.server.ts"
const { setImportDbForTest } = await import("./store.server.ts")
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const service = await import("./service.server.ts")
const runtime = await import("./resolution-runtime.server.ts")
afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	runtime.setResolutionNetworkForTest()
})
test("upload returns a cached preview and a detached job publishes a matched replacement without applying watches", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "show",
			tmdb_id: 10,
			tvdb_id: 100,
			imdb_id: null,
			title: "Synthetic show",
			release_year: 2000,
		},
	]
	db.episodes = [
		{
			show_id: 10,
			tmdb_id: 20,
			season_number: 1,
			episode_number: 2,
			tvdb_id: null,
			name: "Synthetic episode",
		},
	]
	setImportDbForTest(db)
	let calls = 0
	runtime.setResolutionNetworkForTest(async () => {
		calls++
		return { tv_results: [], tv_episode_results: [{ id: 20, show_id: 10 }] }
	})
	const initial = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		Buffer.from(
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-synthetic,100,200,1,3,2024-01-01\n",
		),
	)
	assert.equal(initial.counts.unmatched, 1)
	assert.equal(initial.resolution?.state, "queued")
	assert.equal(calls, 0)
	assert.equal(
		(await service.getImportItems("member", initial.id, undefined, 0, 50))
			.items[0].problem?.code,
		"tvtime_lookup_pending",
	)
	await runtime.resolutionJobs.run(initial.id)
	const summary = await service.getImport("member", initial.id)
	assert.equal(summary.resolution?.state, "completed")
	assert.ok(summary.resolution?.replacementId)
	const matched = await service.getImport(
		"member",
		summary.resolution.replacementId,
	)
	assert.equal(matched.counts.new, 1)
	const rows = await service.getImportItems(
		"member",
		matched.id,
		undefined,
		0,
		50,
	)
	assert.equal(rows.items[0].episodeTmdbId, 20)
	assert.equal(rows.items[0].episode, 2)
	assert.equal(rows.items[0].resolutionOriginal?.episode, 3)
	assert.equal(rows.items.length, 1)
	assert.equal(db.watches.length, 0)
})
test("early Confirm cancels resolution and applies only the current cached preview", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "show",
			tmdb_id: 10,
			tvdb_id: 100,
			imdb_id: null,
			title: "Synthetic show",
			release_year: 2000,
		},
	]
	db.episodes = [
		{
			show_id: 10,
			tmdb_id: 20,
			season_number: 1,
			episode_number: 2,
			tvdb_id: null,
			name: "Episode",
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async () => {
		throw Error("Should not run")
	})
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		Buffer.from(
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-synthetic,100,200,1,3,2024-01-01\n",
		),
	)
	await service.confirmImport("member", p.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal(
		(await service.getImport("member", p.id)).resolution?.state,
		"cancelled",
	)
	await runtime.resolutionJobs.run(p.id)
	assert.equal((await runtime.resolutionJobs.read(p.id))?.replacementId, null)
})
test("the job pages source rows and resolves watched parents before episodes and unwatched parents", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "show",
			tmdb_id: 10,
			imdb_id: null,
			title: "Watched",
			release_year: 2000,
		},
		{
			media_type: "show",
			tmdb_id: 11,
			imdb_id: null,
			title: "Later",
			release_year: 2001,
		},
	]
	db.episodes = Array.from({ length: 405 }, (_, i) => ({
		show_id: 10,
		tmdb_id: 1000 + i,
		season_number: 1,
		episode_number: i + 1,
		tvdb_id: null,
		name: "Episode",
	}))
	setImportDbForTest(db)
	const calls: string[] = []
	runtime.setResolutionNetworkForTest(async (_ctx, path) => {
		calls.push(path)
		const id = Number(path.split("/").at(-1))
		return id === 100
			? { tv_results: [{ id: 10 }], tv_episode_results: [] }
			: id === 101
				? { tv_results: [{ id: 11 }], tv_episode_results: [] }
				: {
						tv_results: [],
						tv_episode_results: [{ id: 1000 + id - 2000, show_id: 10 }],
					}
	})
	let pages = 0
	let parentCheckpoints = 0
	const write = db.run.bind(db)
	db.run = async (sql, params) => {
		if (
			sql.startsWith("INSERT INTO doc.user_import_item") &&
			String(params[3]).startsWith("parent/")
		) {
			parentCheckpoints++
			const value = JSON.parse(String(params[4]))
			assert.ok(Object.keys(value.rows).length <= 200)
		}
		return write(sql, params)
	}
	const original = db.select.bind(db)
	db.select = async <T extends {}>(
		sql: string,
		params: Param[],
	): Promise<T[]> => {
		const rows = await original<T>(sql, params)
		if (sql.startsWith("SELECT row_index, payload")) {
			pages++
			assert.ok(rows.length <= 200)
			assert.match(sql, /LIMIT 200$/)
		}
		return rows
	}
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		Buffer.from(
			`key,s_id,ep_id,s_no,ep_no,created_at,is_for_later\nuser-series-later,101,,,,2024-01-01,true\n${Array.from(
				{ length: 405 },
				(_, i) => `watch-episode-${i},100,${2000 + i},1,${i + 1},2024-01-01,`,
			).join("\n")}`,
		),
	)
	await runtime.resolutionJobs.run(p.id)
	assert.equal(calls[0], "/find/100")
	assert.equal(calls[1], "/find/2000")
	assert.equal(calls.at(-1), "/find/101")
	assert.ok(pages > 6)
	assert.equal(parentCheckpoints, 3)
	assert.equal((await service.getImport("member", p.id)).resolution?.pending, 0)
})
test("strict movie proposals stay unmatched until acceptance; one bulk token creates one idempotent child", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: "tt0000042",
			title: "Canonical movie",
			release_year: 2001,
			poster_path: null,
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Localized movie",
					original_title: "Original",
					release_date: "2001-02-03",
					alternative_titles: { titles: [] },
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date,country,created_at\nwatch,movie,synthetic,Localized movie,2001-02-03,DE,2024-01-01\nfollow,movie,synthetic,Localized movie,2001-02-03,DE,2024-01-02\n",
		),
	)
	await runtime.resolutionJobs.run(p.id)
	const j = await runtime.resolutionJobs.read(p.id)
	assert.ok(j?.replacementId)
	const matched = await service.getImport("member", j.replacementId)
	assert.equal(matched.counts.unmatched, 2)
	assert.equal(matched.resolution?.failed, 0)
	assert.deepEqual(matched.resolution?.failedByCode, {})
	assert.equal(matched.resolution?.heldByCode.tvtime_movie_review_required, 2)
	const { resolutionStore } = await import("./resolution-store.server.ts")
	const old = await resolutionStore.read(`job/${p.id}`)
	assert.ok(old)
	await resolutionStore.cas(`job/${p.id}`, old.version, {
		...(old.value as object),
		updatedAt: Date.now() - 60 * 60_000,
	})
	const suggestions = await service.getWishlistSuggestions("member", matched.id)
	assert.equal(suggestions.groups[0].state, "suggested")
	assert.equal(
		suggestions.groups[0].proof?.rule,
		"tvtime_exact_title_release_date_v1",
	)
	assert.equal(suggestions.bulkAccept?.eligibleCount, 1)
	assert.ok(suggestions.bulkAccept?.token)
	const write = db.run.bind(db)
	let loseReceipt = true
	db.run = async (sql, params) => {
		if (
			loseReceipt &&
			sql.startsWith("INSERT INTO doc.user_import_item") &&
			String(params[3]).startsWith("accept/")
		) {
			loseReceipt = false
			throw new Error(
				"Process stopped after publication, before the acceptance receipt",
			)
		}
		return write(sql, params)
	}
	await assert.rejects(
		service.acceptSuggestedImport("member", matched.id, {
			token: suggestions.bulkAccept.token,
		}),
		/Process stopped after publication/,
	)
	const accepted = await service.acceptSuggestedImport("member", matched.id, {
		token: suggestions.bulkAccept.token,
	})
	const again = await service.acceptSuggestedImport("member", matched.id, {
		token: suggestions.bulkAccept.token,
	})
	await assert.rejects(
		service.acceptSuggestedImport("member", accepted.import.id, {
			token: suggestions.bulkAccept.token,
		}),
		(error: unknown) =>
			error instanceof Error &&
			"code" in error &&
			error.code === "tvtime_suggestion_stale",
	)
	assert.equal(accepted.import.id, again.import.id)
	assert.equal(accepted.acceptedCount, 1)
	assert.equal(again.acceptedCount, 1)
	assert.equal(accepted.skippedCount, 0)
	assert.equal(accepted.import.counts.unmatched, 0)
	assert.equal(db.watches.length, 0)
	const rows = await service.getImportItems(
		"member",
		accepted.import.id,
		undefined,
		0,
		50,
	)
	assert.equal(
		rows.items[0].wishlistResolution?.suggestionProof?.candidateCount,
		1,
	)
	assert.equal(rows.items[0].wishlistOriginal?.tmdbId, null)
	assert.equal(rows.items[0].wishlistOriginal?.tvtimeMovie?.country, "DE")
})

test("bulk acceptance covers more than 100 suggestions across pages and rejects another member", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: "tt0000042",
			title: "Canonical movie",
			release_year: 2001,
			poster_path: null,
		},
	]
	setImportDbForTest(db)
	let decisionsDirty = false
	let movieProgressUpdates = 0
	const write = db.run.bind(db)
	db.run = async (sql, params) => {
		if (
			(sql.startsWith("INSERT INTO doc.user_import_item") &&
				String(params[3]).startsWith("decision/")) ||
			(sql.startsWith("UPDATE doc.user_import_item SET payload") &&
				String(params[1]).startsWith("resolution:decision/"))
		)
			decisionsDirty = true
		if (sql === "REFRESH TABLE doc.user_import_item") decisionsDirty = false

		if (sql.startsWith("UPDATE doc.user_import_item SET payload")) {
			const j = JSON.parse(String(params[0]))
			if (j.phase === "movies" && j.processed > 0 && j.processed < 105)
				movieProgressUpdates++
		}
		return write(sql, params)
	}
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Canonical movie",
					original_title: "Original",
					release_date: "2001-02-03",
					alternative_titles: {
						titles: Array.from({ length: 105 }, (_, i) => ({
							title: `Localized movie ${i}`,
						})),
					},
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			`type,entity_type,uuid,movie_name,release_date,country,created_at\n${Array.from(
				{ length: 105 },
				(_, i) =>
					`follow,movie,synthetic-${i},Localized movie ${i},2001-02-03,DE,2024-01-01`,
			).join("\n")}`,
		),
	)
	await runtime.resolutionJobs.run(p.id)
	const j = await runtime.resolutionJobs.read(p.id)
	assert.ok(j?.replacementId)
	let panelReads = 0
	const read = db.select.bind(db)
	db.select = async <T extends {}>(
		sql: string,
		params: Param[],
	): Promise<T[]> => {
		panelReads++
		if (
			sql.startsWith("SELECT source_key, payload") &&
			String(params[0]).startsWith("resolution:decision/") &&
			decisionsDirty
		)
			return []

		return read<T>(sql, params)
	}
	const s = await service.getWishlistSuggestions("member", j.replacementId)
	assert.ok(
		panelReads <= 24,
		`Suggestion panel used ${panelReads} reads for 105 groups`,
	)
	assert.equal(s.groups.length, 10)
	assert.deepEqual(
		s.groups.map((g) => g.representativeIndex),
		Array.from({ length: 10 }, (_, i) => i),
	)
	assert.equal(s.bulkAccept?.eligibleCount, 105)
	assert.ok(movieProgressUpdates > 1)
	assert.ok(s.hasMore)
	await assert.rejects(
		service.acceptSuggestedImport("other-member", j.replacementId, {
			token: s.bulkAccept?.token,
		}),
		/couldn't find/i,
	)
	const accepted = await service.acceptSuggestedImport(
		"member",
		j.replacementId,
		{ token: s.bulkAccept?.token },
	)
	assert.equal(accepted.import.counts.unmatched, 0)
	assert.equal(accepted.import.counts.rows, 105)
	assert.equal(db.imports.length, 3)
	const rejected = await service.resolveWishlistImport(
		"member",
		accepted.import.id,
		{ choices: [{ index: 0, target: null }] },
	)
	const after = await service.getWishlistSuggestions(
		"member",
		rejected.import.id,
	)
	assert.equal(after.bulkAccept?.eligibleCount, 0)
	assert.ok(
		after.groups.some((g) => g.reason === "tvtime_suggestion_rejected") ||
			after.hasMore,
	)
})

test("a manual choice made after the final checkpoint wins over stale background publication", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: "tt0000042",
			title: "Suggested",
			release_year: 2001,
			poster_path: null,
		},
		{
			media_type: "movie",
			tmdb_id: 43,
			imdb_id: "tt0000043",
			title: "Member choice",
			release_year: 2001,
			poster_path: null,
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Localized",
					original_title: "Original",
					release_date: "2001-02-03",
					alternative_titles: { titles: [] },
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date,country,created_at\nfollow,movie,synthetic,Localized,2001-02-03,DE,2024-01-01\n",
		),
	)
	let release!: () => void
	let entered!: () => void
	const paused = new Promise<void>((r) => {
		release = r
	})
	const started = new Promise<void>((r) => {
		entered = r
	})
	const original = db.select.bind(db)
	let block = true
	db.select = async <T extends {}>(
		sql: string,
		params: Param[],
	): Promise<T[]> => {
		if (
			block &&
			sql.startsWith("SELECT row_index, payload") &&
			(await runtime.resolutionJobs.read(p.id))?.phase === "publishing"
		) {
			block = false
			entered()
			await paused
		}
		return original<T>(sql, params)
	}
	const running = runtime.resolutionJobs.run(p.id)
	await started
	const chosen = await service.resolveWishlistImport("member", p.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 43 } }],
	})
	release()
	await running
	await runtime.resolutionJobs.run(p.id)
	const j = await runtime.resolutionJobs.read(p.id)
	assert.ok(j?.replacementId)
	assert.notEqual(j.replacementId, chosen.import.id)
	const rows = await service.getImportItems(
		"member",
		j.replacementId,
		undefined,
		0,
		50,
	)
	assert.equal(rows.items[0].tmdbId, 43)
	assert.equal(rows.items[0].wishlistResolution?.basis, "member")
	assert.equal(rows.items[0].wishlistOriginal?.tmdbId, null)
})
test("a malformed source release-date suffix cannot produce a strict suggestion", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: "tt0000042",
			title: "Localized",
			release_year: 2001,
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Localized",
					original_title: "Localized",
					release_date: "2001-02-03",
					alternative_titles: { titles: [] },
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date\nfollow,movie,synthetic,Localized,2001-02-03-unverified\n",
		),
	)
	await runtime.resolutionJobs.run(p.id)
	const j = await runtime.resolutionJobs.read(p.id)
	assert.ok(j?.replacementId)
	const s = await service.getWishlistSuggestions("member", j.replacementId)
	assert.equal(s.bulkAccept?.eligibleCount, 0)
	assert.equal(s.groups[0].reason, "conflicting_source_evidence")
})

test("an official episode without a show ID resolves its parent through episode identity", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "show",
			tmdb_id: 10,
			imdb_id: null,
			title: "Show",
			release_year: 2000,
		},
	]
	db.episodes = [
		{
			show_id: 10,
			tmdb_id: 20,
			season_number: 1,
			episode_number: 2,
			tvdb_id: null,
			name: "Episode",
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async () => ({
		tv_results: [],
		tv_episode_results: [{ id: 20, show_id: 10 }],
	}))
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,series_name,episode_id,season_number,episode_number,created_at\nwatch,episode,synthetic,Show,200,1,3,2024-01-01\n",
		),
	)
	await runtime.resolutionJobs.run(p.id)
	const j = await runtime.resolutionJobs.read(p.id)
	assert.ok(j?.replacementId)
	const result = await service.getImport("member", j.replacementId)
	assert.equal(result.counts.new, 1)
})
test("case-only title variants cannot hide a later conflicting source title", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: "tt0000042",
			title: "Localized",
			release_year: 2001,
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Localized",
					original_title: "Original",
					release_date: "2001-02-03",
					alternative_titles: { titles: [] },
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date,country,created_at\nwatch,movie,synthetic,Localized,2001-02-03,DE,2024-01-01\nrewatch,movie,synthetic,LOCALIZED,2001-02-03,DE,2024-02-01\nfollow,movie,synthetic,Another,2001-02-03,DE,2024-03-01\n",
		),
	)
	await runtime.resolutionJobs.run(p.id)
	const j = await runtime.resolutionJobs.read(p.id)
	assert.ok(j?.replacementId)
	const s = await service.getWishlistSuggestions("member", j.replacementId)
	assert.equal(s.bulkAccept?.eligibleCount, 0)
	assert.equal(s.groups[0].reason, "conflicting_source_evidence")
})
test("a confirmed suggested watch is not duplicated on re-import and Undo removes exactly that watch", async () => {
	const tracking = new FakeTrackingCrate()
	setCrateClientForTest(tracking)
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: "tt0000042",
			title: "Localized",
			release_year: 2001,
		},
	]
	setImportDbForTest(db)
	const { setImportEffectsForTest } = await import("./apply.server.ts")
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Localized",
					original_title: "Original",
					release_date: "2001-02-03",
					alternative_titles: { titles: [] },
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const bytes = Buffer.from(
		"type,entity_type,uuid,movie_name,release_date,country,created_at\nwatch,movie,synthetic,Localized,2001-02-03,DE,2024-01-01\n",
	)
	const preview = async () => {
		const p = await service.previewImport(
			"member",
			"tvtime",
			"tracking-prod-records.csv",
			bytes,
		)
		await runtime.resolutionJobs.run(p.id)
		const j = await runtime.resolutionJobs.read(p.id)
		assert.ok(j?.replacementId)
		const s = await service.getWishlistSuggestions("member", j.replacementId)
		return (
			await service.acceptSuggestedImport("member", j.replacementId, {
				token: s.bulkAccept?.token,
			})
		).import
	}
	const wait = async (id: string) => {
		for (let i = 0; i < 100; i++) {
			if ((await service.getImport("member", id)).status === "done") return
			await new Promise((r) => setTimeout(r, 5))
		}
		assert.fail("Import did not finish")
	}
	try {
		const first = await preview()
		await service.confirmImport("member", first.id, {
			kinds: ["watch"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		await wait(first.id)
		const { getMovieTracking } = await import("../tracking.server.ts")
		assert.equal((await getMovieTracking("member", 42)).log.length, 1)
		const beforeDiscard = (await service.getImport("member", first.id))
			.resolution
		await service.discardImport("member", first.id)
		assert.deepEqual(
			(await service.getImport("member", first.id)).resolution,
			beforeDiscard,
		)
		assert.equal((await getMovieTracking("member", 42)).log.length, 1)
		const repeated = await preview()
		assert.equal(repeated.counts.unchanged, 1)
		await service.confirmImport("member", repeated.id, {
			kinds: ["watch"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		await wait(repeated.id)
		assert.equal((await getMovieTracking("member", 42)).log.length, 1)
		await service.undoImport("member", first.id)
		assert.equal((await getMovieTracking("member", 42)).log.length, 0)
	} finally {
		setImportEffectsForTest()
	}
})
test("definitive negative provider answers are scoped to the job and removed when it settles", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "show",
			tmdb_id: 10,
			tvdb_id: 100,
			imdb_id: null,
			title: "Show",
			release_year: 2000,
		},
	]
	setImportDbForTest(db)
	const { createResolutionTmdb } = await import("./resolution-tmdb.server.ts")
	let calls = 0
	const api = createResolutionTmdb({
		take: async () => ({ allowed: true, store: "memory" }),
		fetch: async () => {
			calls++
			return Response.json({ tv_results: [], tv_episode_results: [] })
		},
	})
	runtime.setResolutionNetworkForTest((ctx, path, params) =>
		api.get(ctx, path, params),
	)
	for (let i = 0; i < 2; i++) {
		const p = await service.previewImport(
			"member",
			"tvtime",
			"tracking-prod-records-v2.csv",
			Buffer.from(
				"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-synthetic,100,200,1,1,2024-01-01\n",
			),
		)
		await runtime.resolutionJobs.run(p.id)
		assert.equal(
			db.items.filter((x) =>
				String(x.import_id).startsWith("resolution:cache/"),
			).length,
			0,
		)
		const j = await runtime.resolutionJobs.read(p.id)
		assert.ok(j?.replacementId)
		assert.equal(
			(
				await service.getImportItems(
					"member",
					j.replacementId,
					undefined,
					0,
					50,
				)
			).items[0].problem?.code,
			"episode_tvdb_not_found",
		)
	}
	assert.equal(calls, 2)
})
test("a missing release date does not contradict the full date supplied by another row for the same movie", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: "tt0000042",
			title: "Localized",
			release_year: 2001,
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Localized",
					original_title: "Original",
					release_date: "2001-02-03",
					alternative_titles: { titles: [] },
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date,country,created_at\nwatch,movie,synthetic,Localized,,DE,2024-01-01\nfollow,movie,synthetic,Localized,2001-02-03,DE,2024-02-01\n",
		),
	)
	await runtime.resolutionJobs.run(p.id)
	const j = await runtime.resolutionJobs.read(p.id)
	assert.ok(j?.replacementId)
	const s = await service.getWishlistSuggestions("member", j.replacementId)
	assert.equal(s.bulkAccept?.eligibleCount, 1)
	const original = await service.getImportItems(
		"member",
		j.replacementId,
		undefined,
		0,
		50,
	)
	assert.equal(
		original.items[0].wishlistOriginal?.tvtimeMovie?.releaseDate,
		null,
	)
	assert.equal(
		original.items[1].wishlistOriginal?.tvtimeMovie?.releaseDate,
		"2001-02-03",
	)
})

for (const busy of ["member", "global"])
	test(`${busy}-busy upload leaves no orphan preview or still-matching rows`, async () => {
		setCrateClientForTest(new FakeTrackingCrate())
		const db = new ImportDb()
		setImportDbForTest(db)
		runtime.setResolutionNetworkForTest(async () => {
			throw Error("No lookup during upload")
		})
		const upload = (member: string) =>
			service.previewImport(
				member,
				"tvtime",
				"tracking-prod-records.csv",
				Buffer.from(
					"type,entity_type,uuid,movie_name,release_date,created_at\nfollow,movie,synthetic,Synthetic movie,2001-02-03,2024-01-01\n",
				),
			)
		await upload("first")
		if (busy === "global") await upload("second")
		const before = db.imports.map((row) => row.id)
		const rows = db.items.length
		await assert.rejects(
			upload(busy === "member" ? "first" : "third"),
			(error: unknown) =>
				error instanceof Error &&
				"code" in error &&
				error.code === `tvtime_resolution_${busy}_busy`,
		)
		assert.deepEqual(
			db.imports.map((row) => row.id),
			before,
		)
		assert.equal(db.items.length, rows)
	})

test("discard removes the preview family and all source-bearing resolution metadata; restart cannot recreate it", async () => {
	setCrateClientForTest(new FakeTrackingCrate())
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "movie",
			tmdb_id: 42,
			imdb_id: null,
			title: "Synthetic movie",
			release_year: 2001,
			poster_path: null,
		},
	]
	setImportDbForTest(db)
	runtime.setResolutionNetworkForTest(async (_ctx, path) =>
		path === "/search/movie"
			? { results: [{ id: 42 }], total_pages: 1 }
			: {
					id: 42,
					title: "Synthetic movie",
					original_title: "Other",
					release_date: "2001-02-03",
					alternative_titles: { titles: [] },
					translations: { translations: [] },
					release_dates: { results: [] },
				},
	)
	const p = await service.previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date,created_at\nfollow,movie,synthetic,Synthetic movie,2001-02-03,2024-01-01\n",
		),
	)
	await runtime.resolutionJobs.run(p.id)
	const child = (await runtime.resolutionJobs.read(p.id))?.replacementId
	assert.ok(child)
	const suggestions = await service.getWishlistSuggestions("member", child)
	const accepted = await service.acceptSuggestedImport("member", child, {
		token: suggestions.bulkAccept?.token,
	})
	assert.ok(
		db.items.some((row) => String(row.source_key).startsWith("accept/")),
	)
	// Simulate preview generations written before the family index existed.
	db.items = db.items.filter(
		(row) => !String(row.source_key).startsWith(`family/${p.id}/`),
	)
	const oldJob = db.items.find(
		(row) => row.import_id === p.id && row.kind === "resolution",
	)
	assert.ok(oldJob)
	const oldPayload = JSON.parse(String(oldJob.payload))
	oldPayload.familyIndexed = undefined
	oldJob.payload = JSON.stringify(oldPayload)
	const write = db.run.bind(db)
	let interrupted = false
	db.run = async (sql, params) => {
		if (
			!interrupted &&
			sql === "DELETE FROM doc.user_import_item WHERE import_id LIKE ?" &&
			String(params[0]).startsWith("resolution:group/")
		) {
			interrupted = true
			throw Error("Process stopped during discard")
		}
		return write(sql, params)
	}
	await assert.rejects(
		service.discardImport("member", accepted.import.id),
		/Process stopped during discard/,
	)
	await runtime.reconcileImportResolution()

	await assert.rejects(service.getImport("member", p.id), /couldn't find/i)
	await assert.rejects(service.getImport("member", child), /couldn't find/i)
	await assert.rejects(
		service.getImport("member", accepted.import.id),
		/couldn't find/i,
	)
	assert.equal(db.items.length, 1) // Only the global admission record remains.
	await runtime.resolutionJobs.reconcile()
	assert.equal(db.imports.length, 0)
	assert.equal(db.items.length, 1)
})

import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { afterEach, test } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"
import { plexLibraryFixture } from "./plex-library-fixture.test-support.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const {
	previewFetchedImport,
	getImport,
	getImportItems,
	getImportResult,
	confirmImport,
	undoImport,
} = await import("./service.server.ts")
const { clearResultCacheForTest } = await import("./result-catalog.server.ts")

afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
	clearResultCacheForTest()
})
async function finished(id: string) {
	for (let i = 0; i < 200; i++) {
		const summary = await getImport("member", id)
		if (summary.status !== "running") return summary
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail("Import did not finish")
}

test("partial Plex library failure still previews, confirms and undoes retained history with its warning", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.state.oversized = true
	const parsed = await f.client.readImport("token", "client")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 862, title: "Toy Story", release_year: 1995, imdb_id: null },
	]
	const tracking = new FakeTrackingCrate()
	setCrateClientForTest(tracking)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewFetchedImport("member", "Plex", parsed)
	assert.equal(preview.kinds.watch, 1)
	assert.equal(preview.kinds.rating, 0)
	assert.match(
		preview.warnings.map((w) => w.message).join(" "),
		/partial: the movie and episode library/,
	)
	await confirmImport("member", preview.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	const done = await finished(preview.id)
	assert.equal(done.status, "done", done.error ?? "")
	assert.equal(tracking.table("user_watch_log").length, 1)
	assert.equal(tracking.table("user_watch_log")[0].watched_at, 1600000000000)
	assert.match(done.warnings.map((w) => w.message).join(" "), /partial:/)
	await undoImport("member", preview.id)
	assert.equal(tracking.table("user_watch_log").length, 0)
})

test("Plex library preview, Confirm, receipt, repeat import and Undo preserve scopes, dates and prior member data", async (t) => {
	const f = await plexLibraryFixture()
	t.after(f.close)
	f.library.push(
		{
			ratingKey: "30",
			type: "movie",
			title: "Unrated movie",
			Guid: [{ id: "tmdb://603" }],
			userRating: 0,
		},
		{
			ratingKey: "20",
			type: "show",
			title: "Friends",
			year: 1994,
			Guid: [{ id: "tmdb://1668" }],
			userRating: 9.5,
		},
		{
			ratingKey: "21",
			type: "season",
			title: "Season 4",
			parentRatingKey: "20",
			index: 4,
			userRating: 8.5,
		},
		{
			ratingKey: "22",
			type: "episode",
			title: "Finale",
			grandparentRatingKey: "20",
			parentIndex: 4,
			index: 24,
			Guid: [{ id: "tmdb://101" }],
			viewCount: 10,
			userRating: 7.5,
			lastViewedAt: 946684800,
		},
	)
	const parsed = await f.client.readImport("synthetic-token", "client")
	const db = new ImportDb()
	db.catalog = [
		[862, "Toy Story", 1995],
		[655, "Paris, Texas", 1984],
		[129, "Spirited Away", 2001],
		[1668, "Friends", 1994],
		[603, "Unrated movie", 1999],
	].map(([tmdb_id, title, release_year]) => ({
		tmdb_id,
		title,
		release_year,
		imdb_id: null,
	}))
	db.episodes = [23, 24].map((episode_number, i) => ({
		show_id: 1668,
		tmdb_id: 101 + i,
		season_number: 4,
		episode_number,
		name: i ? "Another episode" : "Finale",
		removed_at: null,
		tvdb_id: null,
		air_date: Date.UTC(1998, 4, 7),
	}))
	const priorScore = {
		user_id: "member",
		tmdb_id: 862,
		media_type: "movie",
		score: 4,
		review: "My existing review",
		created_at: new Date("2017-01-01"),
		updated_at: new Date("2018-01-01"),
		_seq_no: 1,
		_primary_term: 1,
	}
	db.scores = [{ ...priorScore }]
	const tracking = new FakeTrackingCrate()
	tracking.seed("episode", db.episodes)
	const oldWant = {
		user_id: "member",
		tmdb_id: 655,
		media_type: "movie",
		created_at: 1000,
		updated_at: 2000,
	}
	const oldHidden = { ...oldWant, tmdb_id: 129 }
	tracking.seed("user_wishlist", [oldWant])
	tracking.seed("user_not_interested", [oldHidden])
	setCrateClientForTest(tracking)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewFetchedImport("member", "Plex", parsed)
	const rows = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.deepEqual(
		[
			preview.kinds.watch,
			preview.kinds.rating,
			preview.counts.unsupported,
			preview.counts.conflict,
			preview.kinds.episode_rating,
		],
		[4, 2, 1, 1, 1],
	)
	assert.equal(
		rows.items.find((row) => row.kind === "watch" && row.mediaType === "show")
			?.episode,
		23,
	)
	assert.equal(tracking.table("user_watch_log").length, 0)
	assert.equal(db.scores[0].score, 4)
	if (process.env.PLEX_PREVIEW_OUTPUT)
		writeFileSync(
			process.env.PLEX_PREVIEW_OUTPUT,
			JSON.stringify({ summary: preview, items: rows.items }),
		)
	await confirmImport("member", preview.id, {
		kinds: ["watch", "rating", "episode_rating"],
		conflictChoice: "source",
		watchDates: "preserve",
	})
	const done = await finished(preview.id)
	assert.equal(done.status, "done", done.error ?? "")
	assert.equal(done.applied.failed, 0)
	assert.deepEqual(
		db.scores.map((row) => [row.tmdb_id, row.score]).sort(),
		[
			[862, 8],
			[1668, 10],
		].sort(),
	)
	assert.equal(db.scores[0].review, "My existing review")
	const watches = tracking.table("user_watch_log")
	assert.equal(watches.length, 4)
	assert.ok(!db.scores.some((row) => row.tmdb_id === 603))
	assert.ok(
		!tracking
			.table("user_watch_state")
			.some((row) => row.tmdb_id === 603 && row.state === "seen"),
	)
	assert.equal(watches.find((row) => row.tmdb_id === 655)?.watched_at, null)
	assert.equal(
		watches.find((row) => row.tmdb_id === 129)?.watched_at,
		946684800000,
	)
	assert.equal(
		watches.find((row) => row.episode_tmdb_id === 101)?.watched_at,
		946684800000,
	)
	assert.equal(
		tracking.table("user_watch_state").find((row) => row.tmdb_id === 1668)
			?.state,
		"watching",
	)
	assert.equal(tracking.table("user_wishlist").length, 0)
	assert.equal(tracking.table("user_not_interested").length, 0)
	const result = await getImportResult("member", preview.id)
	assert.match(JSON.stringify(result), /season score can't be matched/)
	// The episode's score is its own, never the show's (#759).
	assert.deepEqual(
		db.episodeScores.map((row) => [row.tmdb_id, row.score_key, row.score]),
		[[1668, "e101", 8]],
	)
	const again = await previewFetchedImport("member", "Plex", parsed)
	assert.equal(again.counts.new, 0)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(db.episodeScores.length, 0)
	assert.equal(tracking.table("user_watch_log").length, 0)
	assert.equal(db.scores.length, 1)
	assert.equal(db.scores[0].score, 4)
	assert.equal(db.scores[0].review, priorScore.review)
	assert.equal(
		tracking.table("user_wishlist")[0]?.created_at,
		oldWant.created_at,
	)
	assert.equal(
		tracking.table("user_not_interested")[0]?.updated_at,
		oldHidden.updated_at,
	)
})

test("Plex Undo keeps newer member intentions and watches", async (t) => {
	for (const edit of ["same-list", "opposite-list", "new-watch"] as const) {
		const f = await plexLibraryFixture()
		t.after(f.close)
		f.history.splice(0)
		f.library.splice(0, f.library.length, f.library[1])
		const db = new ImportDb()
		db.catalog = [
			{
				tmdb_id: 655,
				title: "Paris, Texas",
				release_year: 1984,
				imdb_id: null,
			},
		]
		const tracking = new FakeTrackingCrate()
		const old = {
			user_id: "member",
			tmdb_id: 655,
			media_type: "movie",
			created_at: 1000,
			updated_at: 2000,
		}
		tracking.seed("user_wishlist", [old])
		setCrateClientForTest(tracking)
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const preview = await previewFetchedImport(
			"member",
			"Plex",
			await f.client.readImport("token", "client"),
		)
		await confirmImport("member", preview.id, {
			kinds: ["watch"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		assert.equal((await finished(preview.id)).status, "done")
		if (edit === "new-watch")
			tracking.seed("user_watch_log", [
				...tracking.table("user_watch_log"),
				{
					...tracking.table("user_watch_log")[0],
					watch_id: "newer-watch",
					import_id: null,
					origin: "single",
					created_at: Date.now() + 1,
				},
			])
		else
			tracking.seed(
				edit === "same-list" ? "user_wishlist" : "user_not_interested",
				[{ ...old, created_at: 3000, updated_at: 4000 }],
			)
		await undoImport("member", preview.id)
		if (edit === "same-list")
			assert.equal(tracking.table("user_wishlist")[0]?.created_at, 3000)
		else assert.equal(tracking.table("user_wishlist").length, 0)
		if (edit === "opposite-list")
			assert.equal(tracking.table("user_not_interested")[0]?.updated_at, 4000)
		if (edit === "new-watch")
			assert.equal(tracking.table("user_watch_log")[0]?.watch_id, "newer-watch")
	}
})

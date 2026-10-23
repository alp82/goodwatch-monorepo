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
const {
	previewImport,
	getImportItems,
	confirmImport,
	getImport,
	undoImport,
	getImportResult,
} = await import("./service.server.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const { clearResultCacheForTest } = await import("./result-catalog.server.ts")
const fixture = readFileSync(
	new URL("./fixtures/watcharr-library-synthetic.json", import.meta.url),
)

afterEach(() => {
	clearResultCacheForTest()
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})
function setup() {
	const db = new ImportDb()
	const source = JSON.parse(fixture.toString())
	db.catalog = source
		.filter((r: { content?: unknown }) => r.content)
		.map((r: { content: { tmdbId: number; title: string } }) => ({
			tmdb_id: r.content.tmdbId,
			title: r.content.title,
			imdb_id: null,
			release_year: null,
		}))
	db.episodes = [9005, 9008].flatMap((show_id) =>
		[1, 2].flatMap((season_number) =>
			[1, 2].map((episode_number) => ({
				show_id,
				tmdb_id: show_id * 100 + season_number * 10 + episode_number,
				season_number,
				episode_number,
				tvdb_id: null,
				name: "Synthetic episode",
				removed_at: null,
				air_date: Date.parse("2019-01-01"),
				runtime: 30,
				still_path: null,
				episode_type: null,
			})),
		),
	)
	db.episodes.push({ ...db.episodes[0], tmdb_id: 900513, episode_number: 3 })
	const tracking = new FakeTrackingCrate()
	tracking.seed("episode", db.episodes)
	setImportDbForTest(db)
	setCrateClientForTest(tracking)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	return { db, tracking }
}
async function finished(id: string) {
	for (let attempt = 0; attempt < 200; attempt++) {
		const result = await getImport("member", id)
		if (result.status === "done" || result.status === "failed") return result
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail("Import did not finish")
}

it("previews, confirms, reimports and undoes a complete Watcharr library without losing dates or multiplying snapshots", async () => {
	const { db, tracking } = setup()
	const preview = await previewImport(
		"member",
		"wishlist",
		"watcharr-export.json",
		fixture,
	)
	const rows = await getImportItems("member", preview.id, undefined, 0, 200)
	assert.equal(preview.counts.invalid, 0)
	assert.equal(preview.counts.unmatched, 0)
	assert.equal(
		rows.items.filter(
			(i) => i.tmdbId === 9005 && i.kind === "watch" && i.outcome === "new",
		).length,
		5,
	)
	assert.equal(preview.kinds.rating, 2)
	assert.equal(preview.kinds.review, 1)
	assert.equal(preview.kinds.show_status, 4)
	assert.equal(preview.kinds.want, 3)
	if (process.env.WATCHARR_PREVIEW_OUTPUT)
		writeFileSync(process.env.WATCHARR_PREVIEW_OUTPUT, JSON.stringify(preview))
	assert.equal(tracking.table("user_watch_log").length, 0)
	const options = {
		kinds: ["rating", "watch", "want", "review", "show_status"] as const,
		conflictChoice: "keep" as const,
		watchDates: "preserve" as const,
	}
	await confirmImport("member", preview.id, {
		...options,
		kinds: [...options.kinds],
	})
	const done = await finished(preview.id)
	assert.equal(done.status, "done")
	assert.equal(done.applied.failed, 0)
	const movieWatches = tracking
		.table("user_watch_log")
		.filter((w) => w.tmdb_id === 9002)
	assert.equal(movieWatches.length, 2)
	assert.ok(
		movieWatches.every(
			(w) => w.watched_at === Date.parse("2020-05-04T20:30:00+02:00"),
		),
	)
	assert.equal(
		tracking.table("user_watch_log").filter((w) => w.tmdb_id === 9005).length,
		5,
	)
	assert.equal(db.scores.find((s) => s.tmdb_id === 9002)?.score, 9)
	assert.equal(
		db.scores.find((s) => s.tmdb_id === 9002)?.review,
		"A synthetic review.\nWith another paragraph.",
	)
	assert.deepEqual(
		tracking
			.table("user_watch_state")
			.filter((s) => [9005, 9006, 9007, 9008].includes(Number(s.tmdb_id)))
			.map((s) => [s.tmdb_id, s.state])
			.sort(),
		[
			[9005, "watching"],
			[9006, "on_hold"],
			[9007, "dropped"],
			[9008, "seen"],
		],
	)
	const count = tracking.table("user_watch_log").length
	const repeated = await previewImport(
		"member",
		"wishlist",
		"again.json",
		fixture,
	)
	assert.ok(
		(await getImportItems("member", repeated.id, undefined, 0, 200)).items
			.filter((i) => i.kind === "watch")
			.every((i) => i.outcome === "unchanged"),
	)
	await confirmImport("member", repeated.id, {
		...options,
		kinds: [...options.kinds],
	})
	assert.equal((await finished(repeated.id)).status, "done")
	assert.equal(tracking.table("user_watch_log").length, count)
	assert.ok(await getImportResult("member", preview.id))
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(tracking.table("user_watch_log").length, 0)
	assert.ok(
		tracking.table("user_watch_state").every((s) => s.state === "not_started"),
	)
	assert.equal(db.scores.length, 0)
	assert.equal(db.wishlist.length, 0)
})

it("keeps Watcharr rewatch consent independent from rating and review conflicts and preserves the choice", async () => {
	for (const conflictChoice of ["keep", "source"] as const)
		for (const wishlistRewatch of [false, true]) {
			const { db, tracking } = setup()
			db.scores = [
				{
					user_id: "member",
					tmdb_id: 9002,
					media_type: "movie",
					score: 4,
					review: "My review",
					created_at: new Date("2023-01-01"),
					updated_at: new Date("2023-01-01"),
					_seq_no: 1,
					_primary_term: 1,
				},
			]
			const source = JSON.parse(fixture.toString())[1]
			source.status = "PLANNED"
			const preview = await previewImport(
				"member",
				"wishlist",
				"watcharr-export.json",
				new TextEncoder().encode(JSON.stringify([source])),
			)
			assert.equal(preview.wishlistRewatchChoiceCount, 1)
			const options = {
				kinds: ["want", "watch", "rating", "review"] as (
					| "want"
					| "watch"
					| "rating"
					| "review"
				)[],
				conflictChoice,
				wishlistRewatch,
				watchDates: "preserve" as const,
			}
			await confirmImport("member", preview.id, options)
			assert.equal((await finished(preview.id)).status, "done")
			assert.equal(
				(await getImport("member", preview.id)).options?.wishlistRewatch,
				wishlistRewatch,
			)
			assert.equal(
				tracking.table("user_watch_log").filter((w) => w.origin === "import")
					.length,
				2,
			)
			assert.equal(db.wishlist.length, wishlistRewatch ? 1 : 0)
			assert.equal(db.scores[0].score, conflictChoice === "keep" ? 4 : 9)
			assert.equal(
				db.scores[0].review,
				conflictChoice === "keep" ? "My review" : source.thoughts,
			)
			await undoImport("member", preview.id)
			assert.equal(db.wishlist.length, 0)
			assert.equal(
				tracking.table("user_watch_log").filter((w) => w.origin === "import")
					.length,
				0,
			)
			assert.equal(db.scores[0].score, 4)
			assert.equal(db.scores[0].review, "My review")
		}
})

it("expands a whole-show play at its recorded bulk date and honors the explicit unknown-date choice", async () => {
	for (const watchDates of ["preserve", "unknown"] as const) {
		const { tracking } = setup()
		const source = JSON.parse(fixture.toString()).find(
			(row: { id: number }) => row.id === 8,
		)
		source.activity = [
			{
				id: 800,
				watchedId: 8,
				type: "STATUS_CHANGED",
				data: "FINISHED",
				countAsPlay: true,
				customDate: "2020-02-01T12:34:56+01:00",
				createdAt: "2026-01-01T00:00:00Z",
			},
		]
		const preview = await previewImport(
			"member",
			"wishlist",
			"watcharr-export.json",
			new TextEncoder().encode(JSON.stringify([source])),
		)
		assert.equal(preview.counts.new, 4)
		const rows = await getImportItems("member", preview.id, undefined, 0, 200)
		assert.ok(
			rows.items
				.filter((i) => i.kind === "watch")
				.every((i) => i.watchedAt === "2020-02-01T12:34:56+01:00"),
		)
		await confirmImport("member", preview.id, {
			kinds: ["watch"],
			conflictChoice: "keep",
			watchDates,
		})
		assert.equal((await finished(preview.id)).status, "done")
		const watches = tracking.table("user_watch_log")
		assert.equal(watches.length, 4)
		assert.ok(
			watches.every(
				(w) =>
					w.watched_at ===
					(watchDates === "preserve"
						? Date.parse("2020-02-01T12:34:56+01:00")
						: null),
			),
		)
		await undoImport("member", preview.id)
		assert.equal(tracking.table("user_watch_log").length, 0)
	}
})

it("uses whole-show Finished activity only for episodes without a source or existing GoodWatch watch", async () => {
	const { tracking } = setup()
	const source = JSON.parse(fixture.toString()).find(
		(row: { id: number }) => row.id === 8,
	)
	source.activity = [
		{
			id: 800,
			watchedId: 8,
			type: "STATUS_CHANGED",
			data: "FINISHED",
			countAsPlay: true,
			customDate: "2021-01-01T00:00:00Z",
		},
		{
			id: 801,
			watchedId: 8,
			type: "EPISODE_ADDED",
			data: '{"season":1,"episode":1,"status":"FINISHED"}',
			countAsPlay: false,
			customDate: "2020-01-01T00:00:00Z",
		},
	]
	tracking.seed("user_watch_log", [
		{
			user_id: "member",
			watch_id: "existing-episode",
			media_type: "show",
			tmdb_id: 9008,
			episode_tmdb_id: 900812,
			season_number: 1,
			episode_number: 2,
			watched_at: Date.parse("2020-02-02T00:00:00Z"),
			watched_at_precision: "moment",
			origin: "single",
			import_id: null,
			group_id: null,
			pass: 1,
			created_at: 1,
			updated_at: 1,
		},
	])
	const preview = await previewImport(
		"member",
		"wishlist",
		"watcharr-export.json",
		new TextEncoder().encode(JSON.stringify([source])),
	)
	await confirmImport("member", preview.id, {
		kinds: ["watch", "show_status"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finished(preview.id)).status, "done")
	const watches = tracking.table("user_watch_log")
	assert.equal(watches.length, 4)
	assert.deepEqual(
		watches.map((w) => [w.episode_tmdb_id, w.watched_at]).sort(),
		[
			[900811, Date.parse("2020-01-01T00:00:00Z")],
			[900812, Date.parse("2020-02-02T00:00:00Z")],
			[900821, Date.parse("2021-01-01T00:00:00Z")],
			[900822, Date.parse("2021-01-01T00:00:00Z")],
		],
	)
	await undoImport("member", preview.id)
	assert.deepEqual(
		tracking.table("user_watch_log").map((w) => w.watch_id),
		["existing-episode"],
	)
})

it("Confirm clears and Undo restores pre-existing Want to See and Not interested with their dates after Watcharr watches", async () => {
	for (const sourceId of [2, 5])
		for (const table of ["user_wishlist", "user_not_interested"]) {
			const { tracking } = setup()
			const source = JSON.parse(fixture.toString()).find(
				(row: { id: number }) => row.id === sourceId,
			)
			const old = {
				user_id: "member",
				tmdb_id: source.content.tmdbId,
				media_type: source.content.type === "tv" ? "show" : "movie",
				created_at: Date.parse("2017-01-02"),
				updated_at: Date.parse("2018-03-04"),
			}
			tracking.seed(table, [old])
			const preview = await previewImport(
				"member",
				"wishlist",
				"watcharr-export.json",
				new TextEncoder().encode(JSON.stringify([source])),
			)
			await confirmImport("member", preview.id, {
				kinds: ["watch", "rating", "review"],
				conflictChoice: "keep",
				watchDates: "preserve",
			})
			assert.equal((await finished(preview.id)).status, "done")
			assert.equal(tracking.table(table).length, 0)
			await undoImport("member", preview.id)
			assert.equal((await getImport("member", preview.id)).status, "undone")
			assert.equal(tracking.table(table).length, 1)
			const restored = tracking.table(table)[0]
			assert.equal(restored.created_at, old.created_at)
			assert.equal(restored.updated_at, old.updated_at)
			assert.equal(tracking.table("user_watch_log").length, 0)
			const result = await getImportResult("member", preview.id)
			assert.match(JSON.stringify(result), /list-restored/)
		}
})

it("Watcharr Undo preserves newer list choices and does not restore intentions over a newer watch", async () => {
	for (const edit of ["same-list", "opposite-list", "new-watch"] as const) {
		const { tracking } = setup()
		const source = JSON.parse(fixture.toString())[1]
		const old = {
			user_id: "member",
			tmdb_id: 9002,
			media_type: "movie",
			created_at: 1,
			updated_at: 1,
		}
		tracking.seed("user_not_interested", [old])
		const preview = await previewImport(
			"member",
			"wishlist",
			"watcharr-export.json",
			new TextEncoder().encode(JSON.stringify([source])),
		)
		await confirmImport("member", preview.id, {
			kinds: ["watch"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		assert.equal((await finished(preview.id)).status, "done")
		if (edit === "same-list")
			tracking.seed("user_not_interested", [
				{ ...old, created_at: 2, updated_at: 2 },
			])
		if (edit === "opposite-list")
			tracking.seed("user_wishlist", [{ ...old, created_at: 2, updated_at: 2 }])
		if (edit === "new-watch")
			tracking.seed("user_watch_log", [
				{
					user_id: "member",
					watch_id: "new-watch",
					media_type: "movie",
					tmdb_id: 9002,
					episode_tmdb_id: null,
					season_number: null,
					episode_number: null,
					watched_at: null,
					watched_at_precision: "unknown",
					origin: "single",
					import_id: null,
					group_id: null,
					pass: 1,
					created_at: Date.now(),
					updated_at: Date.now(),
				},
			])
		await undoImport("member", preview.id)
		assert.equal(
			tracking.table("user_not_interested").length,
			edit === "same-list" ? 1 : 0,
		)
		if (edit === "same-list")
			assert.equal(tracking.table("user_not_interested")[0].updated_at, 2)
		if (edit === "opposite-list")
			assert.equal(tracking.table("user_wishlist")[0].updated_at, 2)
		if (edit === "new-watch")
			assert.deepEqual(
				tracking.table("user_watch_log").map((w) => w.watch_id),
				["new-watch"],
			)
	}
})

it("prefers dated fillers and chooses the earliest completion independently of activity order", async () => {
	for (const reverse of [false, true]) {
		const { tracking } = setup()
		const source = JSON.parse(fixture.toString()).find(
			(row: { id: number }) => row.id === 8,
		)
		source.watchedEpisodes = [
			{
				id: 1,
				seasonNumber: 1,
				episodeNumber: 1,
				status: "FINISHED",
				rating: 0,
			},
		]
		source.activity = [2022, 2021].map((year, i) => ({
			id: i + 1,
			type: "STATUS_CHANGED",
			data: "FINISHED",
			countAsPlay: true,
			customDate: `${year}-01-01T00:00:00Z`,
		}))
		if (reverse) source.activity.reverse()
		const preview = await previewImport(
			"member",
			"wishlist",
			"watcharr-export.json",
			new TextEncoder().encode(JSON.stringify([source])),
		)
		await confirmImport("member", preview.id, {
			kinds: ["watch"],
			conflictChoice: "keep",
			watchDates: "preserve",
		})
		assert.equal((await finished(preview.id)).status, "done")
		const watches = tracking.table("user_watch_log")
		assert.equal(watches.length, 4)
		assert.equal(
			watches.find((w) => w.episode_tmdb_id === 900811)?.watched_at,
			Date.parse("2021-01-01T00:00:00Z"),
		)
		assert.ok(
			watches
				.filter((w) => w.episode_tmdb_id !== 900811)
				.every((w) => w.watched_at === Date.parse("2021-01-01T00:00:00Z")),
		)
	}
})

it("Watcharr status-only Undo also preserves a newer opposite list choice", async () => {
	const { tracking } = setup()
	const source = JSON.parse(fixture.toString()).find(
		(row: { id: number }) => row.id === 6,
	)
	const title = {
		user_id: "member",
		tmdb_id: 9006,
		media_type: "show",
		created_at: 1,
		updated_at: 1,
	}
	tracking.seed("user_not_interested", [title])
	const preview = await previewImport(
		"member",
		"wishlist",
		"watcharr-export.json",
		new TextEncoder().encode(JSON.stringify([source])),
	)
	await confirmImport("member", preview.id, {
		kinds: ["show_status"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finished(preview.id)).status, "done")
	tracking.seed("user_wishlist", [{ ...title, created_at: 2, updated_at: 2 }])
	await undoImport("member", preview.id)
	assert.equal(tracking.table("user_not_interested").length, 0)
	assert.equal(tracking.table("user_wishlist")[0].updated_at, 2)
})

it("preserves the recorded whole-show finish date for both episodes when S1E1 has an undated snapshot", async () => {
	const { db, tracking } = setup()
	db.episodes = db.episodes.filter(
		(episode) => episode.show_id !== 9008 || episode.season_number === 1,
	)
	tracking.table("episode").splice(0)
	tracking.seed("episode", db.episodes)
	const source = JSON.parse(fixture.toString()).find(
		(row: { id: number }) => row.id === 8,
	)
	source.activity = [
		{
			id: 800,
			type: "STATUS_CHANGED",
			data: "FINISHED",
			countAsPlay: true,
			customDate: "2020-02-01T00:00:00Z",
		},
	]
	source.watchedEpisodes = [
		{ id: 1, seasonNumber: 1, episodeNumber: 1, status: "FINISHED", rating: 0 },
	]
	const preview = await previewImport(
		"member",
		"wishlist",
		"watcharr-export.json",
		new TextEncoder().encode(JSON.stringify([source])),
	)
	const rows = await getImportItems("member", preview.id, undefined, 0, 200)
	assert.deepEqual(
		rows.items
			.filter((row) => row.kind === "watch")
			.map((row) => [row.episodeTmdbId, row.watchedAt])
			.sort(),
		[
			[900811, "2020-02-01T00:00:00Z"],
			[900812, "2020-02-01T00:00:00Z"],
		],
	)
	await confirmImport("member", preview.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	assert.equal((await finished(preview.id)).status, "done")
	assert.deepEqual(
		tracking
			.table("user_watch_log")
			.map((watch) => [watch.episode_tmdb_id, watch.watched_at])
			.sort(),
		[
			[900811, Date.parse("2020-02-01T00:00:00Z")],
			[900812, Date.parse("2020-02-01T00:00:00Z")],
		],
	)
})

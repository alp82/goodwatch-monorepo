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
	assert.equal(preview.kinds.want, 2)
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

it("offers Planned with past plays as Want to rewatch and applies that choice after importing the watches", async () => {
	for (const conflictChoice of ["keep", "source"] as const) {
		const { db, tracking } = setup()
		const source = JSON.parse(fixture.toString())[1]
		source.status = "PLANNED"
		const preview = await previewImport(
			"member",
			"wishlist",
			"watcharr-export.json",
			new TextEncoder().encode(JSON.stringify([source])),
		)
		assert.equal(preview.wishlistRewatchChoiceCount, 1)
		await confirmImport("member", preview.id, {
			kinds: ["want", "watch"],
			conflictChoice,
			watchDates: "preserve",
		})
		assert.equal((await finished(preview.id)).status, "done")
		assert.equal(tracking.table("user_watch_log").length, 2)
		assert.equal(db.wishlist.length, conflictChoice === "source" ? 1 : 0)
		await undoImport("member", preview.id)
		assert.equal(db.wishlist.length, 0)
		assert.equal(tracking.table("user_watch_log").length, 0)
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

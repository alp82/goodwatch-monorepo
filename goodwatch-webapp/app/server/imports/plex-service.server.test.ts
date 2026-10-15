import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import type { ParsedImport } from "../../domain/imports.ts"
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
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
const {
	previewFetchedImport,
	getImport,
	getImportItems,
	confirmImport,
	undoImport,
} = await import("./service.server.ts")
afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})
test("Plex preview, apply, receipt, repeat import and undo preserve separate plays and canonical episodes", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			title: "Toy Story",
			imdb_id: "tt0114709",
			release_year: 1995,
		},
		{
			tmdb_id: 1668,
			title: "Friends",
			imdb_id: "tt0108778",
			release_year: 1994,
		},
		{
			tmdb_id: 655,
			title: "Paris, Texas",
			imdb_id: "tt0087884",
			release_year: 1984,
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
	]
	const tracking = new FakeTrackingCrate()
	tracking.seed("episode", db.episodes)
	setCrateClientForTest(tracking)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const parsed: ParsedImport = {
		source: "plex",
		warnings: ["A second Plex server could not be reached."],
		observations: [
			...[1, 2].map((i) => ({
				key: `plex:watch:server:/status/sessions/history/${i}`,
				kind: "watch" as const,
				mediaType: "movie" as const,
				title: "Toy Story",
				year: 1995,
				tmdbId: 862,
				imdbId: null,
				watchedAt: "2020-09-13T12:26:41.000Z",
				precision: "moment" as const,
			})),
			{
				key: "plex:watch:server:/status/sessions/history/3",
				kind: "watch",
				mediaType: "show",
				title: "Friends",
				year: 1994,
				tmdbId: 1668,
				imdbId: null,
				episodeTmdbId: 101,
				season: 4,
				episode: 24,
				episodeNumbering: "unknown",
				watchedAt: "2020-09-13T12:26:42.000Z",
				precision: "moment",
			},
			{
				key: "plex:want:movie:tmdb:655",
				kind: "want",
				mediaType: "movie",
				title: "Paris, Texas",
				year: null,
				tmdbId: 655,
				imdbId: null,
			},
		],
	}
	const preview = await previewFetchedImport("member", "Plex", parsed)
	assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.equal(receipt.items[2].episode, 23)
	await confirmImport("member", preview.id, {
		kinds: ["watch", "want"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	for (
		let i = 0;
		i < 100 && (await getImport("member", preview.id)).status === "running";
		i++
	)
		await new Promise((r) => setTimeout(r, 5))
	const done = await getImport("member", preview.id)
	assert.equal(done.status, "done", done.error ?? "")
	assert.equal(done.applied.added, 4)
	assert.match(done.warnings.join(" "), /could not be reached/)
	const movie = await getMovieTracking("member", 862)
	assert.equal(movie.log.length, 2)
	assert.equal(
		(await getShowTracking("member", 1668)).log[0].episode_tmdb_id,
		101,
	)
	const again = await previewFetchedImport("member", "Plex", parsed)
	assert.equal(again.counts.new, 0)
	await undoImport("member", preview.id)
	assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	assert.equal((await getShowTracking("member", 1668)).log.length, 0)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(
		(await previewFetchedImport("member", "Plex", parsed)).counts.new,
		4,
	)
})

test("Plex has no file-upload bypass around the connect flow", async () => {
	const { previewImport } = await import("./service.server.ts")
	await assert.rejects(
		previewImport("member", "plex", "plex.json", Buffer.from("{}")),
		/Use Connect/,
	)
})

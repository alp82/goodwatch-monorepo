import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { getShowTracking } = await import("../tracking.server.ts")
const { previewImport, getImportItems, confirmImport, getImport, undoImport } =
	await import("./service.server.ts")
const { setImportDbForTest } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")
afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})
async function done(id: string) {
	for (let i = 0; i < 100; i++) {
		const summary = await getImport("member", id)
		if (summary.status === "done") return
		if (summary.status === "failed")
			assert.fail(summary.error ?? "Import failed")
		await new Promise((r) => setTimeout(r, 5))
	}
	assert.fail("Import did not finish")
}
function setup() {
	const db = new ImportDb()
	db.catalog = [
		{
			media_type: "show",
			tmdb_id: 1668,
			imdb_id: null,
			title: "Synthetic show",
			release_year: 1994,
		},
		{
			media_type: "movie",
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Synthetic movie",
			release_year: 1995,
		},
	]
	db.episodes = [
		{
			tmdb_id: 101,
			show_id: 1668,
			season_number: 4,
			episode_number: 23,
			tvdb_id: 200,
			name: "Finale",
		},
	]
	const tracking = new FakeTrackingCrate()
	setCrateClientForTest(tracking)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	return { db, tracking }
}
test("TV Time previews resolve TVDB parents and episodes, hold title-only movies and round-trip watches", async (t) => {
	setup()
	t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
		if (String(url).includes("/find/100?"))
			return new Response(JSON.stringify({ tv_results: [{ id: 1668 }] }))
		assert.match(String(url), /\/find\/200\?/)
		return new Response(
			JSON.stringify({ tv_episode_results: [{ id: 101, show_id: 1668 }] }),
		)
	})
	const file = zipFixture({
		"tracking-prod-records-v2.csv":
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-one,100,200,4,24,2024-01-02 12:00:00\nrewatch-episode-one-1,100,200,4,24,2025-01-02 12:00:00\n",
		"tracking-prod-records.csv":
			"type,entity_type,uuid,movie_name,release_date,created_at\nwatch,movie,m1,Synthetic movie,1995-01-01,2024-01-02 12:00:00\n",
	})
	const preview = await previewImport("member", "tvtime", "gdpr-data.zip", file)
	const rows = (await getImportItems("member", preview.id, undefined, 0, 50))
		.items
	assert.deepEqual(
		rows
			.filter((r) => r.mediaType === "show")
			.map((r) => [r.outcome, r.tmdbId, r.episodeTmdbId, r.season, r.episode]),
		[
			["new", 1668, 101, 4, 23],
			["new", 1668, 101, 4, 23],
		],
	)
	const movie = rows.find((r) => r.mediaType === "movie")
	assert.equal(movie?.outcome, "unmatched")
	assert.equal(movie?.problem?.code, "tvtime_movie_identity_missing")
	await confirmImport("member", preview.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await done(preview.id)
	assert.equal((await getShowTracking("member", 1668)).log.length, 2)
	const repeated = await previewImport(
		"member",
		"tvtime",
		"gdpr-data.zip",
		file,
	)
	assert.equal(repeated.counts.unchanged, 2)
	assert.equal(repeated.counts.unmatched, 1)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).log.length, 0)
	assert.equal((await getImport("member", preview.id)).status, "undone")
})

test("TV Time wishes require explicit rewatch choice while imported statuses preserve member decisions", async (t) => {
	t.mock.method(
		globalThis,
		"fetch",
		async () => new Response(JSON.stringify({ tv_results: [{ id: 1668 }] })),
	)
	for (const state of ["seen", "on_hold", "dropped", null] as const) {
		for (const choice of ["keep", "source"] as const) {
			const { db, tracking } = setup()
			if (state)
				tracking.seed("user_watch_state", [
					{
						user_id: "member",
						media_type: "show",
						tmdb_id: 1668,
						state,
						pass: 1,
						updated_at: 1,
					},
				])
			const file = zipFixture({
				"tvtime-series-2026-07-01.csv":
					"uuid,tvdb_id,imdb_id,title,status,created_at\ns1,100,,Synthetic show,not_started_yet,2024-01-01\n",
			})
			const p = await previewImport("member", "tvtime", "tvtime.zip", file)
			assert.equal(
				p.counts[state === "seen" ? "conflict" : state ? "unchanged" : "new"],
				1,
			)
			await confirmImport("member", p.id, {
				kinds: ["want"],
				conflictChoice: choice,
				watchDates: "preserve",
			})
			await done(p.id)
			assert.equal(
				db.wishlist.length,
				state === null || (state === "seen" && choice === "source") ? 1 : 0,
			)
			assert.equal(
				(await getShowTracking("member", 1668)).state?.state ?? null,
				state,
			)
			await undoImport("member", p.id)
			assert.equal(db.wishlist.length, 0)
			assert.equal(
				(await getShowTracking("member", 1668)).state?.state ?? null,
				state,
			)
		}
	}
	for (const state of ["seen", "on_hold", "dropped", null] as const) {
		const { tracking } = setup()
		if (state)
			tracking.seed("user_watch_state", [
				{
					user_id: "member",
					media_type: "show",
					tmdb_id: 1668,
					state,
					pass: 1,
					updated_at: 1,
				},
			])
		const file = zipFixture({
			"tvtime-series-2026-07-01.csv":
				"uuid,tvdb_id,imdb_id,title,status,created_at\ns1,100,,Synthetic show,stopped,2024-01-01\n",
		})
		const p = await previewImport("member", "tvtime", "tvtime.zip", file)
		await confirmImport("member", p.id, {
			kinds: ["show_status"],
			conflictChoice: "source",
			watchDates: "preserve",
		})
		await done(p.id)
		assert.equal(
			(await getShowTracking("member", 1668)).state?.state,
			state ?? "dropped",
		)
		await undoImport("member", p.id)
		assert.equal(
			(await getShowTracking("member", 1668)).state?.state ?? null,
			state,
		)
	}
})

test("TV Time cannot substitute TVDB coordinates, another show's episode or an ambiguous parent", async (t) => {
	setup()
	t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
		const match = /\/find\/(\d+)/.exec(String(url))
		if (match?.[1] === "100")
			return new Response(JSON.stringify({ tv_results: [{ id: 1668 }] }))
		if (match?.[1] === "101")
			return new Response(
				JSON.stringify({ tv_results: [{ id: 1668 }, { id: 2316 }] }),
			)
		return new Response(
			JSON.stringify({ tv_episode_results: [{ id: 999, show_id: 2316 }] }),
		)
	})
	const p = await previewImport(
		"member",
		"tvtime",
		"gdpr-data.zip",
		zipFixture({
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at,is_followed\nwatch-episode-foreign,100,999,4,23,2024-01-02 12:00:00,\nwatch-episode-no-id,100,,4,23,2024-01-02 12:00:00,\nuser-series-ambiguous,101,,,,,true\n",
		}),
	)
	assert.equal(p.counts.new, 0)
	assert.equal(p.counts.unmatched, 3)
	const rows = (await getImportItems("member", p.id, undefined, 0, 50)).items
	assert.ok(rows.every((r) => r.mediaType === "show"))
	assert.ok(rows.every((r) => r.tmdbId === null))
	assert.ok(
		rows.some((r) =>
			/did not match uniquely within this show/.test(r.reason ?? ""),
		),
	)
	assert.ok(
		rows.some((r) => r.problem?.code === "tvtime_episode_identity_missing"),
	)
	assert.ok(rows.some((r) => r.problem?.code === "tvtime_show_unmatched"))
})

test("TV Time accepts episode-only Liberator identities, specials and IMDb movie watches without inventing plays", async (t) => {
	const { db } = setup()
	db.episodes = [
		{
			tmdb_id: 101,
			show_id: 1668,
			season_number: 0,
			episode_number: 1,
			tvdb_id: 200,
			name: "Special",
		},
	]
	t.mock.method(
		globalThis,
		"fetch",
		async () =>
			new Response(
				JSON.stringify({ tv_episode_results: [{ id: 101, show_id: 1668 }] }),
			),
	)
	const file = Buffer.from(
		"imdb_id,tvdb_id,type,title,season,episode,is_special,is_watched,watched_at,status,is_watchlisted,rating\n,200,episode,Synthetic show,4,24,true,true,2024-01-02 10:00:00,continuing,true,\n,200,episode,Synthetic show,4,24,true,true,2024-01-02 20:00:00,continuing,true,\ntt0114709,300,movie,Synthetic movie,,,false,true,2024-01-02T10:00:00Z,,false,8\n",
	)
	const p = await previewImport(
		"member",
		"tvtime",
		"activity_history.csv",
		file,
	)
	const rows = (await getImportItems("member", p.id, undefined, 0, 50)).items
	assert.equal(rows.filter((r) => r.episodeSpecial).length, 2)
	assert.ok(
		rows
			.filter((r) => r.episodeSpecial)
			.every((r) => r.season === 0 && r.episode === 1),
	)
	assert.equal(
		rows.find((r) => r.mediaType === "movie" && r.kind === "watch")?.tmdbId,
		862,
	)
	await confirmImport("member", p.id, {
		kinds: ["watch", "rating"],
		conflictChoice: "keep",
		watchDates: "unknown",
	})
	await done(p.id)
	const log = (await getShowTracking("member", 1668)).log
	assert.equal(log.length, 2)
	assert.ok(log.every((r) => r.watched_at === null))
	await undoImport("member", p.id)
	assert.equal((await getShowTracking("member", 1668)).log.length, 0)
})

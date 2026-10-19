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
const { getShowTracking, getMovieTracking } = await import(
	"../tracking.server.ts"
)
const {
	getImportItems,
	confirmImport,
	getImport,
	undoImport,
	resolveWishlistImport,
	getWishlistMatchingGroups,
	getWishlistMatchGroup,
	getWishlistSuggestions,
	searchWishlistMatches,
} = await import("./service.server.ts")
// These existing synchronous resolver/apply cases use the normalized preview boundary.
// The upload/background contract is exercised in resolution-runtime.server.test.ts.
const { createPreview: previewImport } = await import("./preview.server.ts")
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

test("a member matches an official title-only movie into a new preview and its watch is added only on Confirm", async () => {
	setup()
	const file = Buffer.from(
		"type,entity_type,uuid,type-uuid-n,movie_name,release_date,created_at\nwatch,movie,m1,watch-m1-1,Localized movie,1995-11-22,2024-01-02 12:00:00\n",
	)
	const parent = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		file,
	)
	assert.equal(parent.counts.unmatched, 1)
	assert.equal(parent.wishlistMatchCount, 1)
	const groups = await getWishlistMatchingGroups("member", parent.id)
	assert.equal(groups.groups.length, 1)
	assert.equal(groups.groups[0].item.wishlistOriginal?.title, "Localized movie")
	const original = structuredClone(groups.groups[0].item.wishlistOriginal)
	const derived = await resolveWishlistImport("member", parent.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	assert.equal(derived.import.source, "tvtime")
	assert.notEqual(derived.import.id, parent.id)
	assert.equal(derived.parentImportId, parent.id)
	assert.equal(derived.import.counts.new, 1)
	const child = (
		await getImportItems("member", derived.import.id, undefined, 0, 50)
	).items[0]
	assert.deepEqual(child.wishlistOriginal, original)
	assert.equal(child.wishlistResolution?.tmdbId, 862)
	assert.equal(child.wishlistResolution?.basis, "member")
	assert.equal(child.kind, "watch")
	assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	await confirmImport("member", derived.import.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await done(derived.import.id)
	assert.equal((await getMovieTracking("member", 862)).log.length, 1)
	assert.equal((await getImport("member", parent.id)).counts.unmatched, 1)
	const again = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		file,
	)
	const resolvedAgain = await resolveWishlistImport("member", again.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	assert.equal(resolvedAgain.import.counts.unchanged, 1)
	await confirmImport("member", resolvedAgain.import.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await done(resolvedAgain.import.id)
	assert.equal((await getMovieTracking("member", 862)).log.length, 1)
	await undoImport("member", derived.import.id)
	assert.equal((await getMovieTracking("member", 862)).log.length, 0)
})

test("official movie intents share one explicit movie-only choice and clearing restores immutable evidence", async () => {
	setup()
	const file = Buffer.from(
		"type,entity_type,uuid,type-uuid-n,movie_name,release_date,created_at\nwatch,movie,m1,watch-m1-1,Localized movie,1995-11-22,2024-01-02 12:00:00\nrewatch,movie,m1,rewatch-m1-2,Another localized label,1995-11-22,2025-02-03 12:00:00\ntowatch,movie,m1,towatch-m1,Localized movie,1995-11-22,\n",
	)
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		file,
	)
	const groups = await getWishlistMatchingGroups("member", p.id)
	assert.equal(groups.total, 1)
	const group = groups.groups[0]
	assert.equal(group.entryCount, 3)
	assert.equal(group.matchScope, "tvtime_movie")
	assert.deepEqual(group.allowedMediaTypes, ["movie"])
	assert.deepEqual(group.intentCounts, { watch: 2, want: 1 })
	assert.equal(group.evidenceVariants[0].releaseDate, "1995-11-22")
	const originals = (
		await getImportItems("member", p.id, undefined, 0, 50)
	).items.map((r) => r.wishlistOriginal)
	await assert.rejects(
		resolveWishlistImport("member", p.id, {
			choices: [{ index: 0, target: { mediaType: "show", tmdbId: 1668 } }],
		}),
		{ code: "tvtime_movie_match_required" },
	)
	await assert.rejects(
		searchWishlistMatches("member", p.id, {
			index: 0,
			query: "movie",
			mediaType: "show",
		}),
		{ code: "tvtime_movie_match_required" },
	)
	await assert.rejects(
		resolveWishlistImport("someone-else", p.id, {
			choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
		}),
		{ status: 404 },
	)
	const child = await resolveWishlistImport("member", p.id, {
		choices: [{ index: 1, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const rows = (
		await getImportItems("member", child.import.id, undefined, 0, 50)
	).items
	assert.ok(rows.every((r) => r.tmdbId === 862))
	assert.deepEqual(
		rows.map((r) => r.wishlistOriginal),
		originals,
	)
	assert.deepEqual(
		rows.map((r) => r.kind),
		["watch", "watch", "want"],
	)
	const one = await getWishlistMatchGroup("member", child.import.id, 2)
	assert.equal(one.group.entryCount, 3)
	const suggestions = await getWishlistSuggestions("member", p.id)
	assert.deepEqual(suggestions.groups, [
		{ representativeIndex: 0, state: "manual", reason: "unsupported_source" },
	])
	const cleared = await resolveWishlistImport("member", child.import.id, {
		choices: [{ index: 2, target: null }],
	})
	assert.equal(cleared.import.counts.unmatched, 3)
	assert.ok(
		(
			await getImportItems("member", cleared.import.id, undefined, 0, 50)
		).items.every((r) => !r.wishlistResolution),
	)
	assert.deepEqual(
		(
			await getImportItems("member", cleared.import.id, undefined, 0, 50)
		).items.map((r) => r.wishlistOriginal),
		originals,
	)
})

test("matching an official movie keeps other archive intents and does not make unsupported votes applicable", async (t) => {
	setup()
	t.mock.method(
		globalThis,
		"fetch",
		async (url: string | URL | Request) =>
			new Response(
				JSON.stringify(
					String(url).includes("/find/100?")
						? { tv_results: [{ id: 1668 }] }
						: { tv_episode_results: [{ id: 101, show_id: 1668 }] },
				),
			),
	)
	const p = await previewImport(
		"member",
		"tvtime",
		"gdpr-data.zip",
		zipFixture({
			"tracking-prod-records.csv":
				"type,entity_type,uuid,type-uuid-n,movie_name,release_date,created_at\nwatch,movie,m1,watch-m1-1,Localized,1995-11-22,2024-01-02 12:00:00\n",
			"tracking-prod-records-v2.csv":
				"key,s_id,ep_id,s_no,ep_no,created_at,is_archived\nwatch-episode-one,100,200,4,24,2024-01-02 12:00:00,\nuser-series-one,100,,,,,true\n",
			"ratings-live-votes.csv":
				"episode_id,movie_name,uuid,vote_key,user_id\n,Localized,m1,stars_wording_scalev2-29,private-account\n",
		}),
	)
	const parentRows = (await getImportItems("member", p.id, undefined, 0, 50))
		.items
	const movie = parentRows.find(
		(r) => r.kind === "watch" && r.mediaType === "movie",
	)
	assert.ok(movie)
	const child = await resolveWishlistImport("member", p.id, {
		choices: [
			{ index: movie.index, target: { mediaType: "movie", tmdbId: 862 } },
		],
	})
	const rows = (
		await getImportItems("member", child.import.id, undefined, 0, 50)
	).items
	assert.deepEqual(
		rows.map((r) => r.kind),
		parentRows.map((r) => r.kind),
	)
	assert.equal(
		rows.find((r) => r.mediaType === "show" && r.kind === "watch")
			?.episodeTmdbId,
		101,
	)
	assert.equal(
		rows.find((r) => r.kind === "show_status")?.showStatus,
		"dropped",
	)
	assert.equal(
		rows.find((r) => r.kind === "unsupported")?.problem?.code,
		"tvtime_vote_scale_unknown",
	)
	await confirmImport("member", child.import.id, {
		kinds: ["watch", "show_status", "rating"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await done(child.import.id)
	assert.equal((await getMovieTracking("member", 862)).log.length, 1)
	assert.equal((await getShowTracking("member", 1668)).log.length, 1)
	assert.equal((await getShowTracking("member", 1668)).state?.state, "dropped")
	await undoImport("member", child.import.id)
	assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	assert.equal((await getShowTracking("member", 1668)).log.length, 0)
})

test("matched official For later rows still need the explicit Seen rewatch choice and Undo preserves older watches", async () => {
	for (const choice of ["keep", "source"] as const) {
		const { db, tracking } = setup()
		db.watches = [
			{
				user_id: "member",
				tmdb_id: 862,
				media_type: "movie",
				watch_id: "older-watch",
			},
		]
		tracking.seed("user_watch_log", [
			{
				user_id: "member",
				tmdb_id: 862,
				media_type: "movie",
				watch_id: "older-watch",
				origin: "single",
				pass: 1,
				watched_at: null,
				watched_at_precision: "unknown",
				created_at: 1,
				updated_at: 1,
			},
		])
		const p = await previewImport(
			"member",
			"tvtime",
			"tracking-prod-records.csv",
			Buffer.from(
				"type,entity_type,uuid,movie_name,release_date\ntowatch,movie,m1,Localized,1995-11-22\n",
			),
		)
		const child = await resolveWishlistImport("member", p.id, {
			choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
		})
		assert.equal(child.import.counts.conflict, 1)
		assert.equal(child.import.wishlistRewatchChoiceCount, 1)
		await confirmImport("member", child.import.id, {
			kinds: ["want"],
			conflictChoice: choice,
			watchDates: "preserve",
		})
		await done(child.import.id)
		assert.equal(db.wishlist.length, choice === "source" ? 1 : 0)
		assert.equal((await getMovieTracking("member", 862)).log.length, 1)
		await undoImport("member", child.import.id)
		assert.equal(db.wishlist.length, 0)
		assert.equal((await getMovieTracking("member", 862)).log.length, 1)
	}
})

test("TV Time catalog search offers only movies and never accepts a candidate automatically", async () => {
	setup()
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date\ntowatch,movie,m1,Synthetic movie,1995-11-22\n",
		),
	)
	const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = await import(
		"undici"
	)
	const oldDispatcher = getGlobalDispatcher()
	const oldHost = process.env.CRATE_HOSTS
	const agent = new MockAgent()
	agent.disableNetConnect()
	setGlobalDispatcher(agent)
	process.env.CRATE_HOSTS = "tvtime-match-fixture.invalid"
	setCrateClientForTest(null)
	try {
		agent
			.get("http://tvtime-match-fixture.invalid:4200")
			.intercept({
				path: "/_sql",
				method: "POST",
				body: (body) => JSON.parse(String(body)).stmt.includes("FROM movie "),
			})
			.reply(200, {
				cols: ["tmdb_id", "title", "release_year", "poster_path"],
				rows: [[862, "Synthetic movie", 1995, null]],
				rowcount: 1,
			})
		const found = await searchWishlistMatches("member", p.id, {
			index: 0,
			query: "Synthetic movie",
		})
		assert.deepEqual(found.candidates, [
			{
				mediaType: "movie",
				tmdbId: 862,
				title: "Synthetic movie",
				year: 1995,
				posterPath: null,
			},
		])
		assert.equal((await getImport("member", p.id)).counts.unmatched, 1)
		assert.equal(
			(await getImportItems("member", p.id, undefined, 0, 50)).items[0]
				.wishlistResolution,
			undefined,
		)
	} finally {
		setGlobalDispatcher(oldDispatcher)
		await agent.close()
		if (oldHost === undefined)
			Reflect.deleteProperty(process.env, "CRATE_HOSTS")
		else process.env.CRATE_HOSTS = oldHost
		setCrateClientForTest(null)
	}
})

test("Undo of a manually matched movie watch removes only that import's addition", async () => {
	const { db, tracking } = setup()
	db.watches = [
		{
			user_id: "member",
			tmdb_id: 862,
			media_type: "movie",
			watch_id: "older-member-watch",
		},
	]
	tracking.seed("user_watch_log", [
		{
			user_id: "member",
			tmdb_id: 862,
			media_type: "movie",
			watch_id: "older-member-watch",
			origin: "single",
			pass: 1,
			watched_at: Date.parse("2020-01-01"),
			watched_at_precision: "day",
			created_at: 1,
			updated_at: 1,
		},
	])
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,type-uuid-n,movie_name,release_date,created_at\nwatch,movie,m1,watch-m1-1,Localized,1995-11-22,2024-01-02 12:00:00\n",
		),
	)
	const child = await resolveWishlistImport("member", p.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	await confirmImport("member", child.import.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await done(child.import.id)
	assert.equal((await getMovieTracking("member", 862)).log.length, 2)
	await undoImport("member", child.import.id)
	const after = await getMovieTracking("member", 862)
	assert.deepEqual(
		after.log.map((row) => row.watch_id),
		["older-member-watch"],
	)
})

test("TV Time child previews retain earlier choices while keeping separate native movies distinct", async () => {
	const { db } = setup()
	db.catalog.push({
		media_type: "movie",
		tmdb_id: 603,
		imdb_id: "tt0133093",
		title: "Second movie",
		release_year: 1999,
	})
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		Buffer.from(
			"type,entity_type,uuid,movie_name,release_date\ntowatch,movie,m1,Same localized name,1995-11-22\ntowatch,movie,m2,Same localized name,1995-11-22\n",
		),
	)
	assert.equal((await getWishlistMatchingGroups("member", p.id)).total, 2)
	const first = await resolveWishlistImport("member", p.id, {
		choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	const firstRows = (
		await getImportItems("member", first.import.id, undefined, 0, 50)
	).items
	const second = await resolveWishlistImport("member", first.import.id, {
		choices: [{ index: 1, target: { mediaType: "movie", tmdbId: 603 } }],
	})
	const rows = (
		await getImportItems("member", second.import.id, undefined, 0, 50)
	).items
	assert.deepEqual(
		rows.map((row) => row.tmdbId),
		[862, 603],
	)
	assert.deepEqual(rows[0].wishlistResolution, firstRows[0].wishlistResolution)
	assert.deepEqual(
		rows.map((row) => row.wishlistOriginal),
		firstRows.map((row) => row.wishlistOriginal),
	)
	const cleared = await resolveWishlistImport("member", second.import.id, {
		choices: [{ index: 1, target: null }],
	})
	assert.deepEqual(
		(
			await getImportItems("member", cleared.import.id, undefined, 0, 50)
		).items.map((row) => row.outcome),
		["new", "unmatched"],
	)
})

test("TV Time extension payloads cannot opt themselves into official title-only matching", async () => {
	setup()
	const p = await previewImport(
		"member",
		"tvtime",
		"movies.json",
		Buffer.from(
			JSON.stringify([
				{
					uuid: "m1",
					title: "Unidentified extension movie",
					id: { tvdb: 300, imdb: "-1" },
					is_watched: false,
					wishlistOriginal: {
						manualMatchScope: "tvtime_movie",
						kind: "want",
						mediaType: "movie",
					},
					tvtimeMovie: { sourceId: "m1", releaseDate: "1995-11-22" },
				},
			]),
		),
	)
	assert.equal((await getWishlistMatchingGroups("member", p.id)).total, 0)
	await assert.rejects(
		resolveWishlistImport("member", p.id, {
			choices: [{ index: 0, target: { mediaType: "movie", tmdbId: 862 } }],
		}),
		{ code: "wishlist_row_not_resolvable" },
	)
})

test("official v1 episode watches and rewatches sharing an episode UUID all import on a fresh account", async (t) => {
	setup()
	t.mock.method(
		globalThis,
		"fetch",
		async (url: string | URL | Request) =>
			new Response(
				JSON.stringify(
					String(url).includes("/find/100?")
						? { tv_results: [{ id: 1668 }] }
						: { tv_episode_results: [{ id: 101, show_id: 1668 }] },
				),
			),
	)
	const file = Buffer.from(
		"type,entity_type,uuid,type-uuid-n,series_id,episode_id,season_number,episode_number,created_at\nwatch,episode,shared-uuid,watch-e1,100,200,4,24,2022-01-01 12:00:00\nrewatch,episode,shared-uuid,rewatch-e1-1,100,200,4,24,2023-01-01 12:00:00\nrewatch,episode,shared-uuid,rewatch-e1-2,100,200,4,24,2024-01-01 12:00:00\n",
	)
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		file,
	)
	assert.equal(p.counts.new, 3)
	const rows = (await getImportItems("member", p.id, undefined, 0, 50)).items
	assert.equal(new Set(rows.map((r) => r.key)).size, 3)
	await confirmImport("member", p.id, {
		kinds: ["watch"],
		conflictChoice: "keep",
		watchDates: "preserve",
	})
	await done(p.id)
	assert.equal((await getShowTracking("member", 1668)).log.length, 3)
	const repeated = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records.csv",
		file,
	)
	assert.equal(repeated.counts.unchanged, 3)
	await undoImport("member", p.id)
	assert.equal((await getShowTracking("member", 1668)).log.length, 0)
})

test("extension movies without IMDb IDs explain the missing ID and another source's unmatched shows retain their type", async () => {
	setup()
	const p = await previewImport(
		"member",
		"tvtime",
		"movies.json",
		Buffer.from(
			JSON.stringify([
				{
					uuid: "m1",
					id: { tvdb: 300, imdb: "-1" },
					title: "Movie",
					is_watched: false,
				},
			]),
		),
	)
	const movie = (await getImportItems("member", p.id, undefined, 0, 50))
		.items[0]
	assert.equal(movie.problem?.code, "tvtime_movie_imdb_missing")
	assert.match(movie.reason ?? "", /no IMDb ID/)
	const other = await previewImport(
		"member",
		"wishlist",
		"file.json",
		Buffer.from(
			JSON.stringify({
				format: "goodwatch-wishlist",
				version: 1,
				source: "example",
				completeness: "complete",
				items: [{ title: "Unknown show", mediaType: "show", tmdbId: 999999 }],
			}),
		),
	)
	const row = (await getImportItems("member", other.id, undefined, 0, 50))
		.items[0]
	assert.equal(row.outcome, "unmatched")
	assert.equal(row.mediaType, "show")
})

test("a temporary TVDB parent outage is retryable and does not poison later rows in the preview", async (t) => {
	setup()
	let calls = 0
	t.mock.method(globalThis, "fetch", async () =>
		++calls === 1
			? new Response("", { status: 503 })
			: new Response(JSON.stringify({ tv_results: [{ id: 1668 }] })),
	)
	const csv = `uuid,tvdb_id,imdb_id,title,status,created_at\n${Array.from(
		{ length: 5 },
		(_, i) => `s${i},100,,Show,continuing,\n`,
	).join("")}`
	const p = await previewImport(
		"member",
		"tvtime",
		"tvtime-series-2026-07-01.csv",
		Buffer.from(csv),
	)
	const rows = (await getImportItems("member", p.id, undefined, 0, 50)).items
	assert.equal(p.counts.new, 1)
	assert.equal(p.counts.unmatched, 4)
	assert.ok(
		rows
			.slice(0, 4)
			.every((row) => row.problem?.code === "tvtime_lookup_unavailable"),
	)
	assert.ok(
		rows.slice(0, 4).every((row) => /lookup.*retry/i.test(row.reason ?? "")),
	)
})

test("an unavailable TVDB parent remains retryable when the supplied IMDb fallback also misses", async (t) => {
	setup()
	t.mock.method(
		globalThis,
		"fetch",
		async () => new Response("", { status: 503 }),
	)
	const p = await previewImport(
		"member",
		"tvtime",
		"tvtime-series-2026-07-01.csv",
		Buffer.from(
			"uuid,tvdb_id,imdb_id,title,status\ns1,100,tt0000001,Show,continuing\n",
		),
	)
	const row = (await getImportItems("member", p.id, undefined, 0, 50)).items[0]
	assert.equal(row.problem?.code, "tvtime_lookup_unavailable")
})

test("TV Time trusts catalog show and episode TVDB identities before making any remote lookup", async (t) => {
	const { db } = setup()
	db.catalog[0].tvdb_id = 100
	let requests = 0
	t.mock.method(globalThis, "fetch", async () => {
		requests++
		throw new Error("Cached catalog identities must not need TMDB")
	})
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		Buffer.from(
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-one,100,200,4,24,2024-01-02 12:00:00\nrewatch-episode-one-1,100,200,4,24,2025-01-02 12:00:00\n",
		),
	)
	assert.equal(p.counts.new, 2)
	assert.equal(p.counts.unmatched, 0)
	assert.equal(requests, 0)
	const rows = (await getImportItems("member", p.id, undefined, 0, 50)).items
	assert.deepEqual(
		rows.map((r) => [r.tmdbId, r.episodeTmdbId, r.episode]),
		[
			[1668, 101, 23],
			[1668, 101, 23],
		],
	)
})

test("TV Time receipts distinguish lookup limits from outages identically in parent and episode phases", async (t) => {
	for (const status of [503, 429]) {
		const reasons: string[] = []
		for (const phase of ["parent", "episode"]) {
			const { db } = setup()
			if (phase === "episode") db.catalog[0].tvdb_id = 100
			db.episodes[0].tvdb_id = null
			t.mock.method(
				globalThis,
				"fetch",
				async () =>
					new Response("", { status, headers: { "Retry-After": "60" } }),
			)
			const p = await previewImport(
				"member",
				"tvtime",
				"tracking-prod-records-v2.csv",
				Buffer.from(
					"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-one,100,200,4,24,2024-01-02 12:00:00\n",
				),
			)
			const row = (await getImportItems("member", p.id, undefined, 0, 50))
				.items[0]
			assert.equal(p.counts.unmatched, 1)
			assert.equal(
				row.problem?.code,
				status === 429
					? "tvtime_lookup_budget_exhausted"
					: "tvtime_lookup_unavailable",
				phase,
			)
			reasons.push(row.reason ?? "")
			// The summary counts each kind of lookup failure, so the page can offer a rerun without loading every row.
			assert.equal(p.tvtimeLookupLimitCount, status === 429 ? 1 : 0)
			assert.equal(p.tvtimeLookupUnavailableCount, status === 429 ? 0 : 1)
			assert.equal(
				(await getImport("member", p.id)).tvtimeLookupLimitCount,
				status === 429 ? 1 : 0,
			)
		}
		assert.equal(reasons[0], reasons[1])
		assert.match(
			reasons[0],
			status === 429 ? /limit.*again/i : /unavailable.*retry/i,
		)
	}
})

test("a cached show TVDB ID does not hide a different episode with the same numeric TVDB ID", async (t) => {
	const { db } = setup()
	db.catalog[0].tvdb_id = 100
	db.catalog.push({
		media_type: "show",
		tmdb_id: 999,
		tvdb_id: 200,
		title: "Other show",
	})
	db.episodes[0].tvdb_id = null
	const requested: string[] = []
	t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
		requested.push(String(url))
		return new Response(
			JSON.stringify({ tv_episode_results: [{ id: 101, show_id: 1668 }] }),
		)
	})
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		Buffer.from(
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-one,100,200,4,24,2024-01-02 12:00:00\n",
		),
	)
	assert.equal(p.counts.new, 1)
	assert.equal(requested.length, 1)
	assert.match(requested[0], /\/find\/200\?/)
})

test("a second large TV Time preview spends its budget on the remaining uncached episodes", async (t) => {
	const { db } = setup()
	db.catalog[0].tvdb_id = 100
	db.episodes = Array.from({ length: 2100 }, (_, i) => ({
		tmdb_id: i + 101,
		show_id: 1668,
		season_number: 1,
		episode_number: i + 1,
		tvdb_id: null,
		name: null,
	}))
	let requests = 0
	t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
		requests++
		const id = Number(String(url).match(/\/find\/(\d+)/)?.[1])
		assert.ok(
			db.catalogQueries.some((q) => q.sql.includes("UNION ALL")),
			"Catalog identities must be read before remote requests",
		)
		return new Response(
			JSON.stringify({
				tv_episode_results: [{ id: id - 20000 + 101, show_id: 1668 }],
			}),
		)
	})
	const file = Buffer.from(
		`key,s_id,ep_id,s_no,ep_no,created_at\n${Array.from({ length: 2100 }, (_, i) => `watch-episode-${i},100,${i + 20000},1,${i + 1},2024-01-01 12:00:00\n`).join("")}`,
	)
	const first = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		file,
	)
	assert.equal(first.counts.new, 2000)
	assert.equal(first.counts.unmatched, 100)
	assert.equal(requests, 2000)
	requests = 0
	const second = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		file,
	)
	assert.equal(second.counts.new, 2100)
	assert.equal(second.counts.unmatched, 0)
	assert.equal(requests, 100)
	assert.equal(
		db.catalogQueries.filter((q) => q.sql.includes("UNION ALL")).length,
		6,
	)
})

test("TV Time reads more than 800 stored IDs in bounded batches and holds an ambiguity spanning the boundary", async (t) => {
	const { db } = setup()
	db.catalog[0].tvdb_id = 100
	db.catalog.push({
		media_type: "show",
		tmdb_id: 999,
		tvdb_id: 20000,
		title: "Overlapping show",
	})
	db.episodes = Array.from({ length: 802 }, (_, i) => ({
		tmdb_id: i + 101,
		show_id: 1668,
		season_number: 1,
		episode_number: i + 1,
		tvdb_id: i === 801 ? 20000 : i + 20000,
		name: null,
	}))
	const select = db.select.bind(db)
	let batches = 0
	t.mock.method(
		db,
		"select",
		async (sql: string, params: Parameters<typeof db.select>[1]) => {
			if (sql.includes("UNION ALL")) {
				assert.ok(
					params.length <= 800,
					"Catalog reads must bind at most 800 requested IDs",
				)
				batches++
			}
			return select(sql, params)
		},
	)
	let calls = 0
	t.mock.method(globalThis, "fetch", async () => {
		calls++
		throw new Error(
			"Stored identities must be read in full before any TMDB request",
		)
	})
	const file = Buffer.from(
		`key,s_id,ep_id,s_no,ep_no,created_at,is_for_later\n${Array.from({ length: 802 }, (_, i) => `watch-episode-${i},100,${i === 801 ? 20000 : i + 20000},1,${i + 1},2024-01-${i === 801 ? "02" : "01"} 12:00:00,false\n`).join("")}user-series-overlap,20000,,,,,true\n`,
	)
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		file,
	)
	assert.equal(p.counts.new, 801)
	assert.equal(p.counts.unmatched, 2)
	assert.equal(batches, 2)
	assert.equal(calls, 0)
	const held = (await getImportItems("member", p.id, "unmatched", 0, 50)).items
	assert.equal(held.length, 2)
	assert.ok(held.every((row) => /not match uniquely/.test(row.reason ?? "")))
})

test("a TV Time catalog sentinel discards earlier batches and also bounds the combined result", async (t) => {
	for (const lastBatchSize of [50001, 100001]) {
		const { db } = setup()
		db.catalog[0].tvdb_id = 100
		db.episodes = Array.from({ length: 801 }, (_, i) => ({
			tmdb_id: i + 101,
			show_id: 1668,
			season_number: 1,
			episode_number: i + 1,
			tvdb_id: i + 20000,
			name: null,
		}))
		const select = db.select.bind(db)
		let batches = 0
		t.mock.method(
			db,
			"select",
			async (sql: string, params: Parameters<typeof db.select>[1]) => {
				const matches = await select(sql, params)
				if (!sql.includes("UNION ALL")) return matches
				const count = ++batches === 1 ? 50000 : lastBatchSize
				return [
					...matches,
					...Array.from({ length: count - matches.length }, (_, i) => ({
						...matches[0],
						tmdb_id: i + 1000000,
					})),
				]
			},
		)
		t.mock.method(
			globalThis,
			"fetch",
			async () => new Response("", { status: 503 }),
		)
		const file = Buffer.from(
			`key,s_id,ep_id,s_no,ep_no,created_at\n${Array.from({ length: 801 }, (_, i) => `watch-episode-${i},100,${i + 20000},1,${i + 1},2024-01-01 12:00:00\n`).join("")}`,
		)
		const p = await previewImport(
			"member",
			"tvtime",
			"tracking-prod-records-v2.csv",
			file,
		)
		assert.equal(batches, 2)
		assert.equal(p.counts.new, 0)
		assert.equal(p.counts.unmatched, 801)
		const first = (await getImportItems("member", p.id, undefined, 0, 1))
			.items[0]
		assert.equal(first.problem?.code, "tvtime_lookup_unavailable")
	}
})

test("ambiguous stored TVDB identities stay unmatched without remote revalidation", async (t) => {
	for (const scope of ["show", "episode"]) {
		const { db } = setup()
		db.catalog[0].tvdb_id = 100
		if (scope === "show") db.catalog.push({ ...db.catalog[0], tmdb_id: 999 })
		else
			db.episodes.push({ ...db.episodes[0], tmdb_id: 102, episode_number: 24 })
		let calls = 0
		t.mock.method(globalThis, "fetch", async () => {
			calls++
			throw new Error("Stored ambiguous identities must remain held")
		})
		const p = await previewImport(
			"member",
			"tvtime",
			"tracking-prod-records-v2.csv",
			Buffer.from(
				"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-one,100,200,4,24,2024-01-02 12:00:00\n",
			),
		)
		assert.equal(p.counts.new, 0, scope)
		assert.equal(p.counts.unmatched, 1, scope)
		assert.equal(calls, 0, scope)
	}
})

test("removed episode cache entries do not suppress a lookup for their live replacement", async (t) => {
	const { db } = setup()
	db.catalog[0].tvdb_id = 100
	db.episodes[0].removed_at = "2026-01-01"
	db.episodes.push({
		...db.episodes[0],
		tmdb_id: 102,
		episode_number: 24,
		tvdb_id: null,
		removed_at: null,
	})
	const requested: string[] = []
	t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
		requested.push(String(url))
		return new Response(
			JSON.stringify({ tv_episode_results: [{ id: 102, show_id: 1668 }] }),
		)
	})
	const p = await previewImport(
		"member",
		"tvtime",
		"tracking-prod-records-v2.csv",
		Buffer.from(
			"key,s_id,ep_id,s_no,ep_no,created_at\nwatch-episode-one,100,200,4,24,2024-01-02 12:00:00\n",
		),
	)
	assert.equal(p.counts.new, 1)
	const row = (await getImportItems("member", p.id, undefined, 0, 50)).items[0]
	assert.equal(row.episodeTmdbId, 102)
	assert.equal(requested.length, 1)
	assert.match(requested[0], /\/find\/200\?/)
})

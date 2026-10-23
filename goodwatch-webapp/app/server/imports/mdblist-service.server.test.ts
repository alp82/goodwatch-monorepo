import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"
import { createMdblistClient } from "./mdblist-client.server.ts"
import { fakeMdblist } from "./mdblist-fake.test-support.ts"
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
	previewImport,
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

const KEY = "synthetic-key-0001"
const settle = async (id: string) => {
	for (
		let i = 0;
		i < 200 && (await getImport("member", id)).status === "running";
		i++
	)
		await new Promise((r) => setTimeout(r, 5))
	return getImport("member", id)
}

function setup() {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 438631,
			title: "Dune",
			imdb_id: "tt1160419",
			release_year: 2021,
		},
		{
			tmdb_id: 655,
			title: "Paris, Texas",
			imdb_id: "tt0087884",
			release_year: 1984,
		},
		{
			tmdb_id: 862,
			title: "Toy Story",
			imdb_id: "tt0114709",
			release_year: 1995,
		},
		{
			tmdb_id: 603,
			title: "The Matrix",
			imdb_id: "tt0133093",
			release_year: 1999,
		},
		{
			tmdb_id: 95396,
			title: "Severance",
			imdb_id: "tt11280740",
			release_year: 2022,
			media_type: "show",
		},
		{
			tmdb_id: 1396,
			title: "Breaking Bad",
			imdb_id: "tt0903747",
			release_year: 2008,
			media_type: "show",
		},
		{
			tmdb_id: 87108,
			title: "Chernobyl",
			imdb_id: "tt7366338",
			release_year: 2019,
			media_type: "show",
		},
		{
			tmdb_id: 1438,
			title: "The Wire",
			imdb_id: "tt0306414",
			release_year: 2002,
			media_type: "show",
		},
		{
			tmdb_id: 4607,
			title: "Lost",
			imdb_id: "tt0411008",
			release_year: 2004,
			media_type: "show",
		},
	]
	db.episodes = [
		[1396, 62085, 1, 1, 2008],
		[1396, 62086, 1, 2, 2008],
		[87108, 1771497, 1, 1, 2019],
	].map(([show_id, tmdb_id, season_number, episode_number, aired]) => ({
		show_id,
		tmdb_id,
		season_number,
		episode_number,
		name: null,
		tvdb_id: null,
		removed_at: null,
		air_date: Date.UTC(aired, 0, 20),
	}))
	const tracking = new FakeTrackingCrate()
	tracking.seed("episode", db.episodes)
	setCrateClientForTest(tracking)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	return { db, tracking }
}

const readSynthetic = () =>
	createMdblistClient({
		fetch: fakeMdblist({ key: KEY }).fetch,
		sleep: async () => {},
	}).readAccount(KEY)

test("MDBList preview, Confirm and Undo cover Want to See, every watch, scores and Dropped", async () => {
	const { db } = setup()
	const fake = fakeMdblist({ key: KEY })
	const parsed = await createMdblistClient({
		fetch: fake.fetch,
		sleep: async () => {},
	}).readAccount(KEY)
	const preview = await previewFetchedImport(
		"member",
		"MDBList account",
		parsed,
	)
	assert.equal(preview.source, "mdblist")
	assert.equal(preview.status, "preview")
	assert.deepEqual(
		{
			want: preview.kinds.want,
			watch: preview.kinds.watch,
			rating: preview.kinds.rating,
			show_status: preview.kinds.show_status,
		},
		{ want: 4, watch: 8, rating: 2, show_status: 1 },
	)
	// Watchlist episode of a wanted show, episode rating, dropped season.
	assert.equal(preview.counts.unsupported, 3)
	// One MDBList list, offered as one private GoodWatch list (#758).
	assert.equal(preview.kinds.list, 1)
	// The movie without catalog IDs stays visible as unmatched.
	assert.equal(preview.counts.unmatched, 1)
	// The Watchlist season of The Wire waits for the member's Want to See the show choice (#715).
	assert.equal(preview.wishlistShowChoiceCount, 1)
	const wire = (
		await getImportItems("member", preview.id, undefined, 0, 50)
	).items.find((item) => item.tmdbId === 1438)
	assert.equal(wire?.outcome, "conflict")
	assert.match(wire?.reason ?? "", /Want to See the show/)
	assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	const items = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.doesNotMatch(
		JSON.stringify(items) + JSON.stringify(db.imports),
		new RegExp(KEY),
	)

	await confirmImport("member", preview.id, {
		kinds: ["rating", "watch", "want", "show_status"],
		conflictChoice: "keep",
		watchDates: "preserve",
		wishlistShows: true,
	})
	const done = await settle(preview.id)
	assert.equal(done.status, "done", done.error ?? "")
	assert.equal(done.applied.failed, 0)
	const toyStory = await getMovieTracking("member", 862)
	assert.equal(toyStory.log.length, 3)
	assert.equal((await getShowTracking("member", 1396)).log.length, 2)
	assert.deepEqual(
		db.scores.map((x) => [x.tmdb_id, x.media_type, x.score]).sort(),
		[
			[1396, "show", 9],
			[862, "movie", 8],
		],
	)
	assert.equal((await getShowTracking("member", 4607)).state?.state, "dropped")
	assert.deepEqual(
		db.wishlist.map((x) => x.tmdb_id).sort(),
		[438631, 655, 95396, 1438].sort(),
	)

	// A second preview finds nothing new but the list, which every import creates anew (#758); Undo restores the library.
	const again = await previewFetchedImport("member", "MDBList account", parsed)
	assert.equal(again.counts.new, 1)
	assert.equal(again.kinds.list, 1)
	await undoImport("member", preview.id)
	assert.equal((await settle(preview.id)).status, "undone")
	assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	assert.equal((await getShowTracking("member", 1396)).log.length, 0)
	assert.equal(db.scores.length, 0)
	assert.equal(db.wishlist.length, 0)
	assert.notEqual(
		(await getShowTracking("member", 4607)).state?.state,
		"dropped",
	)
})

test("MDBList has no file-upload way around the pasted key", async () => {
	await assert.rejects(
		previewImport("member", "mdblist", "mdblist.json", Buffer.from("{}")),
		/Use Connect/,
	)
})

for (const [choice, rewatch, added] of [
	["keep", true, true],
	["source", false, false],
] as const)
	test(`a Watchlist season of a Seen show follows Want to rewatch (${rewatch}), not the conflict choice (${choice})`, async () => {
		const { db, tracking } = setup()
		tracking.seed("user_watch_state", [
			{
				user_id: "member",
				media_type: "show",
				tmdb_id: 1438,
				state: "seen",
				pass: 1,
				state_changed_at: 1,
				seen_press_group: null,
				seen_press_from: null,
				rate_prompt_dismissed_at: null,
				seen_question: "answered",
				created_at: 1,
				updated_at: 1,
			},
		])
		const preview = await previewFetchedImport(
			"member",
			"MDBList account",
			await readSynthetic(),
		)
		assert.equal(preview.wishlistRewatchChoiceCount, 1)
		await confirmImport("member", preview.id, {
			kinds: ["want"],
			conflictChoice: choice,
			watchDates: "preserve",
			wishlistShows: true,
			wishlistRewatch: rewatch,
		})
		assert.equal((await settle(preview.id)).status, "done")
		assert.equal(
			db.wishlist.some((row) => row.tmdb_id === 1438),
			added,
		)
	})

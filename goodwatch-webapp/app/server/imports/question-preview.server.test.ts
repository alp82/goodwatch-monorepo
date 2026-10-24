import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { afterEach, test } from "node:test"
import type {
	ImportObservation,
	ImportQuestion,
	ImportSummary,
} from "../../domain/imports.ts"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { createPreview, createParsedPreview } = await import(
	"./preview.server.ts"
)
const { setImportDbForTest, getImportRow, summarize } = await import(
	"./store.server.ts"
)

afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
})

function setup() {
	const db = new ImportDb()
	db.catalog = [1, 2, 3, 4].map((tmdb_id) => ({
		tmdb_id,
		imdb_id: null,
		title: `Movie ${tmdb_id}`,
		release_year: 2024,
	}))
	const tracking = new FakeTrackingCrate()
	setImportDbForTest(db)
	setCrateClientForTest(tracking)
	return { db, tracking }
}
function question(summary: ImportSummary, kind: ImportQuestion) {
	const found = summary.questions?.find((q) => q.kind === kind)
	assert.ok(found)
	assert.equal(found.applying, 0)
	assert.equal(found.answer, null)
	return found
}
const observation = (
	kind: ImportObservation["kind"],
	id = 1,
): ImportObservation => ({
	key: `${kind}:${id}`,
	kind,
	mediaType: "movie",
	title: `Movie ${id}`,
	year: 2024,
	tmdbId: id,
	imdbId: null,
})

test("Letterboxd watched.csv counts undated watches after excluding watches already in the log", async () => {
	const { tracking } = setup()
	tracking.seed("user_watch_log", [
		{
			id: "old",
			user_id: "member",
			tmdb_id: 2,
			media_type: "movie",
			episode_tmdb_id: null,
			season_number: null,
			episode_number: null,
			watched_at: null,
			watched_at_precision: "unknown",
			pass: 1,
			origin: "single",
			created_at: Date.parse("2024-01-01"),
			updated_at: Date.parse("2024-01-01"),
		},
	])
	const summary = await createPreview(
		"member",
		"letterboxd",
		"export.zip",
		zipFixture({
			"watched.csv":
				"Date,Name,Year,Letterboxd URI\n2026-10-09,Movie 1,2024,https://letterboxd.com/film/movie-1/\n2026-10-09,Movie 2,2024,https://letterboxd.com/film/movie-2/\n",
		}),
	)
	assert.equal(question(summary, "undated").waiting, 1)
	assert.deepEqual(question(summary, "undated").byKind, { watch: 1 })
	assert.equal(summary.counts.unchanged, 1)
	assert.equal(summary.kinds.watch, 2)
	assert.equal("_questions" in summary.kinds, false)
})

test("TV Time counts unknown and missing dates but excludes dated and unmatched watches", async () => {
	setup()
	const summary = await createParsedPreview(
		"member",
		"tvtime.zip",
		{
			source: "tvtime",
			warnings: [],
			observations: [
				{ ...observation("watch"), precision: "unknown" },
				observation("watch", 2),
				{
					...observation("watch", 3),
					precision: "day",
					watchedAt: "2024-01-01T00:00:00.000Z",
				},
				{ ...observation("watch", 4), tmdbId: null, title: "Missing title" },
			],
		},
		"tvtime-counts",
		{ cachedOnly: true },
	)
	assert.equal(question(summary, "undated").waiting, 2)
	assert.deepEqual(question(summary, "undated").byKind, { watch: 2 })
})

test("Watcharr preview counts rewatch separately from rating/review conflicts and excludes snapshots", async () => {
	const { db } = setup()
	const entry = JSON.parse(
		readFileSync(
			new URL("./fixtures/watcharr-library-synthetic.json", import.meta.url),
			"utf8",
		),
	)[1]
	entry.status = "PLANNED"
	db.catalog.push({
		tmdb_id: 9002,
		title: entry.content.title,
		imdb_id: null,
		release_year: null,
	})
	db.scores = [
		{
			user_id: "member",
			tmdb_id: 9002,
			media_type: "movie",
			score: 4,
			review: "My review",
			created_at: new Date("2023-01-01"),
			updated_at: new Date("2023-01-01"),
		},
	]
	const summary = await createPreview(
		"member",
		"wishlist",
		"watcharr-export.json",
		Buffer.from(JSON.stringify([entry])),
	)
	assert.equal(question(summary, "rewatch").waiting, 1)
	assert.deepEqual(question(summary, "rewatch").byKind, { want: 1 })
	assert.deepEqual(question(summary, "conflict").byKind, {
		rating: 1,
		review: 1,
	})
	assert.equal(question(summary, "undated").waiting, 0)
	const snapshot = await createParsedPreview("member", "snapshot.json", {
		source: "wishlist",
		warnings: [],
		observations: [
			{ ...observation("watch"), precision: "unknown", watcharrSnapshot: true },
		],
	})
	assert.equal(snapshot.counts.new, 1)
	assert.equal(question(snapshot, "undated").waiting, 0)
})

test("preview exposes conflicts by kind for sources without independent rewatch evidence", async () => {
	const { db } = setup()
	db.scores = [
		{
			user_id: "member",
			tmdb_id: 1,
			media_type: "movie",
			score: 3,
			review: "Old review",
			created_at: new Date("2023-01-01"),
			updated_at: new Date("2023-01-01"),
		},
	]
	db.watches = [{ user_id: "member", tmdb_id: 1, media_type: "movie" }]
	const summary = await createParsedPreview("member", "trakt.json", {
		source: "trakt",
		warnings: [],
		observations: [
			{ ...observation("rating"), score: 8 },
			{ ...observation("review"), review: "New review" },
			{
				...observation("want"),
				wishlistEvidence: {
					source: "trakt",
					mediaType: "movie",
					completeness: "complete",
				},
			},
		],
	})
	// The already-Seen wish counts once, under rewatch, which holds it before the conflict question.
	assert.deepEqual(question(summary, "conflict").byKind, {
		rating: 1,
		review: 1,
	})
	assert.deepEqual(question(summary, "rewatch").byKind, { want: 1 })
	assert.deepEqual(question(summary, "wholeShow").byKind, {})
})

test("whole-show wishes and plan-to-watch rewatch statuses retain their question kinds", async () => {
	const { db } = setup()
	db.watches = [{ user_id: "member", tmdb_id: 2, media_type: "show" }]
	const wishes = await createParsedPreview("member", "wishlist.json", {
		source: "wishlist",
		warnings: [],
		observations: [
			{
				...observation("want"),
				mediaType: "show",
				wishlistEvidence: {
					source: "capture",
					mediaType: "season",
					completeness: "partial",
				},
			},
		],
	})
	assert.equal(question(wishes, "wholeShow").waiting, 1)
	assert.deepEqual(question(wishes, "wholeShow").byKind, { want: 1 })
	assert.equal(question(wishes, "conflict").waiting, 0)
	const statuses = await createParsedPreview("member", "trakt.json", {
		source: "trakt",
		warnings: [],
		observations: [
			{
				...observation("show_status", 2),
				mediaType: "show",
				showStatus: "plan_to_watch",
				wishlistEvidence: {
					source: "trakt",
					mediaType: "show",
					completeness: "complete",
				},
			},
		],
	})
	assert.deepEqual(question(statuses, "rewatch").byKind, { show_status: 1 })
	assert.deepEqual(question(statuses, "conflict").byKind, {})
})

test("a season wish for a show already on Want to See has no whole-show question", async () => {
	const { db } = setup()
	db.wishlist = [{ user_id: "member", tmdb_id: 2, media_type: "show" }]
	const summary = await createParsedPreview("member", "wishlist.json", {
		source: "wishlist",
		warnings: [],
		observations: [
			{
				...observation("want", 2),
				mediaType: "show",
				wishlistEvidence: {
					source: "capture",
					mediaType: "season",
					completeness: "partial",
				},
			},
		],
	})
	assert.equal(summary.counts.unchanged, 1)
	assert.equal(question(summary, "wholeShow").waiting, 0)
})

test("old previews omit questions and confirmed imports do not expose preview counts", async () => {
	const { db } = setup()
	db.seed()
	const row = await getImportRow("member", String(db.imports[0].id))
	const old = summarize(row)
	assert.equal("questions" in old, false)
	assert.deepEqual(old.kinds, {
		rating: 0,
		watch: 0,
		want: 0,
		favorite: 1,
		review: 0,
		show_status: 0,
	})
	row.kinds = JSON.stringify({
		favorite: 1,
		_questions: { conflict: { rating: 2 } },
	})
	assert.equal(question(summarize(row), "conflict").waiting, 2)
	row.status = "done"
	assert.equal("questions" in summarize(row), false)
})

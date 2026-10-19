import assert from "node:assert/strict"
import test from "node:test"
import { gzipSync } from "node:zlib"
import "../../server/title-filter/test-alias.ts"
import { zipFixture } from "../../server/imports/zip-fixture.test-support.ts"

const { recognizeImportFile } = await import("./ImportFileRecognition.ts")

const file = (name: string, content: string | Uint8Array, type = "") =>
	new File([content], name, { type })

test("a Letterboxd export ZIP is recognized by the CSV files the Letterboxd import reads", async () => {
	const zip = zipFixture({
		"profile.csv": "Date Joined,Username\n",
		"watched.csv": "Date,Name,Year,Letterboxd URI\n",
		"ratings.csv": "Date,Name,Year,Letterboxd URI,Rating\n",
		"likes/films.csv": "Date,Name,Year,Letterboxd URI\n",
	})
	const result = await recognizeImportFile(
		file("letterboxd-alp82-2026-10-15-09-12-utc.zip", zip, "application/zip"),
	)
	assert.equal(result.source, "letterboxd")
	assert.equal(result.label, "Letterboxd export")
})

test("a Trakt export ZIP is recognized by the history, rating, and list JSON files the Trakt import reads", async () => {
	for (const entry of [
		"watched-history-1.json",
		"ratings-episodes.json",
		"lists-watchlist.json",
	]) {
		const zip = zipFixture({ "user-profile.json": "{}", [entry]: "[]" })
		const result = await recognizeImportFile(file("trakt-export.zip", zip))
		assert.equal(result.source, "trakt", entry)
		assert.equal(result.label, "Trakt export")
	}
})

test("a Kodi library export is recognized as videodb.xml, or a ZIP holding exactly one", async () => {
	const xml =
		'﻿<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<!-- exported -->\n<videodb>\n<version>1</version>\n</videodb>\n'
	const plain = await recognizeImportFile(file("videodb.xml", xml, "text/xml"))
	assert.equal(plain.source, "kodi")
	assert.equal(plain.label, "Kodi library export")

	const zipped = await recognizeImportFile(
		file(
			"kodi.zip",
			zipFixture({
				"kodi_videodb_2026-10-15/videodb.xml": xml,
				"kodi_videodb_2026-10-15/movies/poster.jpg": "",
			}),
		),
	)
	assert.equal(zipped.source, "kodi")

	const twice = await recognizeImportFile(
		file(
			"kodi.zip",
			zipFixture({ "a/videodb.xml": xml, "b/videodb.xml": xml }),
		),
	)
	assert.equal(twice.source, null)
})

test("a MyAnimeList-format anime list is recognized plain or gzipped, and named for Kitsu by its file name", async () => {
	const xml =
		'<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist><myinfo><user_export_type>1</user_export_type></myinfo></myanimelist>'
	const gzipped = await recognizeImportFile(
		file("animelist_1728990000_-_123456.xml.gz", gzipSync(xml)),
	)
	assert.equal(gzipped.source, "myanimelist")
	assert.equal(gzipped.label, "MyAnimeList export")

	assert.ok(gzipped.source === "myanimelist" && !gzipped.kitsu)

	const kitsu = await recognizeImportFile(file("kitsu-alp82-anime.xml", xml))
	assert.equal(kitsu.source, "myanimelist")
	assert.equal(kitsu.label, "Kitsu anime library")
	assert.ok(kitsu.source === "myanimelist" && kitsu.kitsu)
})

const IMDB_RATINGS_HEADER =
	"Const,Your Rating,Date Rated,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors"

test("an IMDb ratings export is recognized by the Const, Your Rating, and Title Type columns", async () => {
	const result = await recognizeImportFile(
		file(
			"ratings.csv",
			`﻿${IMDB_RATINGS_HEADER}\ntt0133093,9,2024-01-01,The Matrix,The Matrix,https://www.imdb.com/title/tt0133093/,Movie,8.7,136,1999,Action,2000000,1999-03-31,"Lana Wachowski, Lilly Wachowski"\n`,
			"text/csv",
		),
	)
	assert.equal(result.source, "imdb")
	assert.equal(result.label, "IMDb ratings export")
})

test("MovieLens ratings and wishlist files are recognized apart by the rating column", async () => {
	const ratings = await recognizeImportFile(
		file(
			"movielens-ratings.csv",
			"movie_id,imdb_id,tmdb_id,rating,average_rating,title\n1,0114709,862,4.5,3.9,Toy Story (1995)\n",
		),
	)
	assert.deepEqual(ratings, {
		source: "movielens",
		label: "MovieLens ratings",
		wishlist: false,
	})
	const wishlist = await recognizeImportFile(
		file(
			"movielens-wishlist.csv",
			"movie_id,imdb_id,tmdb_id,average_rating,title\n1,0114709,862,3.9,Toy Story (1995)\n",
		),
	)
	assert.deepEqual(wishlist, {
		source: "movielens",
		label: "MovieLens wishlist",
		wishlist: true,
	})
})

test("a CSV in Letterboxd's import format is recognized when it names a title and holds something to import", async () => {
	for (const header of [
		"tmdbID,imdbID,Title,Year,Rating10,WatchedDate,Rewatch",
		"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date",
		"imdbID,Review",
	]) {
		const result = await recognizeImportFile(file("films.csv", `${header}\n`))
		assert.equal(result.source, "csv", header)
		assert.equal(result.label, "CSV in Letterboxd's import format")
	}
})

test("a CSV no live import can use stays unrecognized, with a reason", async () => {
	for (const header of [
		// Titles with nothing the generic import applies: every row would be skipped.
		"Title,Date",
		// The member's own rating is in a column the generic import doesn't read.
		"TMDb ID,IMDb ID,Type,Name,Release Date,Season Number,Episode Number,Rating,Your Rating,Date Rated",
		// The generic import refuses duplicate columns.
		"Title,title,Rating",
		"Film,Stars,Seen on",
	]) {
		const result = await recognizeImportFile(file("export.csv", `${header}\n`))
		assert.equal(result.source, null, header)
		assert.ok(result.source === null && result.hint.length > 0)
	}
})

test("a ZIP no live import reads stays unrecognized, including a Letterboxd export repacked inside a folder", async () => {
	for (const files of [
		{
			"CONTENT_INTERACTION/ViewingActivity.csv": "Profile Name,Start Time\n",
		} as Record<string, string>,
		{ "letterboxd-alp/ratings.csv": "Date,Name,Year,Letterboxd URI,Rating\n" },
	]) {
		const result = await recognizeImportFile(
			file("export.zip", zipFixture(files)),
		)
		assert.equal(result.source, null)
	}
})

/** A File that records how many bytes recognition reads from it. */
class CountingFile extends File {
	read = 0
	slice(start = 0, end = this.size, type?: string) {
		const from = start < 0 ? Math.max(0, this.size + start) : start
		const to = Math.min(end < 0 ? this.size + end : end, this.size)
		this.read += Math.max(0, to - from)
		return super.slice(start, end, type)
	}
}
const MB = 1024 * 1024

/** A ZIP with its end record's directory size, offset, or comment length rewritten. */
function patchEndRecord(
	zip: Uint8Array,
	patch: { size?: number; offset?: number; comment?: number },
) {
	const bytes = new Uint8Array(zip)
	const view = new DataView(bytes.buffer)
	const end = bytes.length - 22
	assert.equal(view.getUint32(end, true), 0x06054b50)
	if (patch.size !== undefined) view.setUint32(end + 12, patch.size, true)
	if (patch.offset !== undefined) view.setUint32(end + 16, patch.offset, true)
	if (patch.comment !== undefined) view.setUint16(end + 20, patch.comment, true)
	return bytes
}

test("a hostile ZIP whose end record claims an oversized central directory is refused without reading it", async () => {
	// The directory claims to start at 0 and fill the 6 MB before the end record: consistent, but too large.
	const padding = new Uint8Array(6 * MB)
	const zip = zipFixture({ "watched-history-1.json": "[]" })
	const tail = patchEndRecord(zip.subarray(zip.length - 22), {
		size: padding.length,
		offset: 0,
	})
	const hostile = new CountingFile([padding, tail], "export.zip")
	const result = await recognizeImportFile(hostile)
	assert.equal(result.source, null)
	assert.ok(hostile.read < 128 * 1024, `read ${hostile.read} bytes`)

	// A directory that claims more than the file holds.
	const lying = new CountingFile(
		[patchEndRecord(zip, { size: 0x7fffffff })],
		"export.zip",
	)
	assert.equal((await recognizeImportFile(lying)).source, null)
	assert.ok(lying.read < 128 * 1024, `read ${lying.read} bytes`)
})

test("a ZIP whose end record doesn't reach the end of the file is refused, as the server refuses it", async () => {
	const zip = zipFixture({ "watched-history-1.json": "[]" })
	const result = await recognizeImportFile(
		file("trakt-export.zip", patchEndRecord(zip, { comment: 40 })),
	)
	assert.equal(result.source, null)
})

test("a file larger than any import accepts is refused before anything inside it is read", async () => {
	const big = new CountingFile([new Uint8Array(21 * MB)], "letterboxd.zip")
	const result = await recognizeImportFile(big)
	assert.equal(result.source, null)
	assert.ok(result.source === null && /larger than 20 MB/.test(result.hint))
	assert.equal(big.read, 0)
})

test("a gzipped CSV stays unrecognized: only the MyAnimeList import unpacks gzip", async () => {
	const result = await recognizeImportFile(
		file(
			"ratings.csv.gz",
			gzipSync(`${IMDB_RATINGS_HEADER}\ntt0133093,9,,The Matrix,,,Movie\n`),
		),
	)
	assert.equal(result.source, null)
	assert.ok(result.source === null && /gzip/i.test(result.hint))
})

test("a CSV header is read the way the generic import reads it: blank lines skipped, backslash-escaped quotes kept", async () => {
	const result = await recognizeImportFile(
		// The first column holds an escaped quote and a comma; a naive reader loses Title and Rating in it.
		file("films.csv", '\n\n"Note \\",x",Title,Rating\nhi,Arrival,4\n'),
	)
	assert.equal(result.source, "csv")
})

// Synthetic, in the shape of Watcharr's watched rows (docs/research/wishlist-exploration/watcharr-validation.md).
const watcharrRow = (id: number, status: string) => ({
	id,
	createdAt: "2026-01-01T00:00:00Z",
	status,
	rating: 0,
	content: {
		id,
		tmdbId: 800 + id,
		title: `Synthetic title ${id}`,
		type: "movie",
		imdb_id: "",
	},
	activity: [],
})
const watcharrExport = (rows: number) =>
	JSON.stringify(
		Array.from({ length: rows }, (_, index) =>
			watcharrRow(index + 1, index % 2 ? "FINISHED" : "PLANNED"),
		),
		undefined,
		2,
	)
const sharedWishlist = (version: unknown) =>
	JSON.stringify({
		format: "goodwatch-wishlist",
		version,
		source: "netflix",
		completeness: "partial",
		items: [{ title: "Synthetic, with a comma", mediaType: "unknown" }],
	})

test("a Watcharr export and a wishlist file are recognized and go to the wishlist import", async () => {
	const watcharr = await recognizeImportFile(
		file("watcharr-export.json", watcharrExport(3), "application/json"),
	)
	assert.deepEqual(watcharr, { source: "wishlist", label: "Watcharr export" })
	// On one line, the file's commas would read as a CSV header.
	const shared = await recognizeImportFile(
		file("my-list.json", sharedWishlist(1)),
	)
	assert.deepEqual(shared, { source: "wishlist", label: "wishlist file" })
})

test("a wishlist file in a newer layout stays unrecognized and says why", async () => {
	const result = await recognizeImportFile(
		file("my-list.json", sharedWishlist(2)),
	)
	assert.equal(result.source, null)
	assert.ok(result.source === null && /newer layout/.test(result.hint))
})

test("a Watcharr export longer than the part GoodWatch reads is recognized from its start", async () => {
	const text = watcharrExport(400)
	assert.ok(text.length > 64 * 1024)
	const long = new CountingFile([text], "watcharr-export.json")
	assert.deepEqual(await recognizeImportFile(long), {
		source: "wishlist",
		label: "Watcharr export",
	})
	// The 64 KB head, plus the four bytes that tell a ZIP or gzip file apart.
	assert.ok(long.read <= 64 * 1024 + 4, `read ${long.read} bytes`)
})

test("an empty list is a Watcharr export only under Watcharr's own file name", async () => {
	assert.equal(
		(await recognizeImportFile(file("watcharr-export.json", "[]"))).source,
		"wishlist",
	)
	assert.equal(
		(await recognizeImportFile(file("list.json", "[]"))).source,
		null,
	)
})

test("other JSON stays unrecognized and names the JSON files GoodWatch reads", async () => {
	for (const content of [
		'{"format":"something-else","items":[]}',
		'[{"title":"Synthetic","status":"PLANNED"}]',
		"{not json",
	]) {
		const result = await recognizeImportFile(file("data.json", content))
		assert.equal(result.source, null, content)
		assert.ok(
			result.source === null &&
				/Watcharr, TV Time, and wishlist files/.test(result.hint),
			content,
		)
	}
})

test("TV Time's official export is recognized by its tracking files, also nested or hash-prefixed", async () => {
	for (const files of [
		{ "gdpr-data/tracking-prod-records-v2.csv": "key,s_id,ep_id\n" },
		{ "a1b2c3_tracking-prod-records.csv": "type,entity_type,uuid\n" },
		{ "export/Followed_TV_Show.csv": "tv_show_id,tv_show_name\n" },
		{ "user_tv_show_data.csv": "tv_show_id,is_followed\n" },
		{ "ratings-live-votes.csv": "vote_key,uuid\n" },
	] as Record<string, string>[]) {
		const result = await recognizeImportFile(
			file("gdpr-data.zip", zipFixture({ "account.csv": "id\n", ...files })),
		)
		assert.equal(result.source, "tvtime", Object.keys(files)[0])
		assert.equal(result.label, "TV Time export")
	}
})

test("TV Time Liberator and TV Time Out extension ZIPs are recognized by their file names", async () => {
	for (const files of [
		{ "shows.json": "[]", "movies.json": "[]", "activity_history.csv": "" },
		{ "tvtime-series-2026-07-01.json": "[]" },
		{ "tvtime-series-episodes-2026-07-01.csv": "" },
		{ "tvtime-movies-2026-07-01.csv": "" },
	] as Record<string, string>[]) {
		const result = await recognizeImportFile(
			file("tv-time-export.zip", zipFixture(files)),
		)
		assert.equal(result.source, "tvtime", Object.keys(files)[0])
	}
})

test("a loose TV Time CSV is recognized by its columns, before the generic CSV rule can claim it", async () => {
	for (const header of [
		"key,s_id,ep_id,s_no,ep_no,created_at",
		"type,entity_type,uuid,movie_name,release_date,created_at",
		"tv_show_id,tv_show_name,active,archived",
		"episode_id,movie_name,uuid,vote_key",
		"title,series_tvdb_id,is_watched",
	]) {
		const result = await recognizeImportFile(file("renamed.csv", `${header}\n`))
		assert.equal(result.source, "tvtime", header)
	}
	const byName = await recognizeImportFile(
		file("tracking-prod-records-v2.csv", "something,else\n"),
	)
	assert.equal(byName.source, "tvtime")
})

test("a CSV with a lone key column isn't taken for TV Time", async () => {
	const result = await recognizeImportFile(file("export.csv", "key,value\n"))
	assert.equal(result.source, null)
})

test("TV Time extension JSON is recognized by name or by TVDB/IMDb ids, never a Watcharr export", async () => {
	const named = await recognizeImportFile(file("shows.json", "[]"))
	assert.equal(named.source, "tvtime")
	const renamed = await recognizeImportFile(
		file(
			"mine.json",
			JSON.stringify([
				{ title: "Synthetic", id: { tvdb: 1, imdb: "tt1" }, is_watched: true },
			]),
		),
	)
	assert.equal(renamed.source, "tvtime")
	const show = await recognizeImportFile(
		file(
			"mine.json",
			`[{"title":"Synthetic","id":{"tvdb":1},"seasons":[${'{"number":1},'.repeat(9000)}{"number":2}]}]`,
		),
	)
	assert.equal(show.source, "tvtime")
	const watcharr = await recognizeImportFile(
		file(
			"watcharr-export.json",
			'[{"status":"PLANNED","content":{"title":"Synthetic","tmdbId":1}}]',
		),
	)
	assert.equal(watcharr.source, "wishlist")
})

test("a generic CSV with IMDb IDs and a status column stays generic: TV Time needs TV Time's own columns", async () => {
	for (const content of [
		"Title,imdbID,Rating,Status\nAlien,tt0078748,4,seen\n",
		"Title,IMDb ID,Status\nAlien,tt0078748,seen\n",
	]) {
		const result = await recognizeImportFile(file("mine.csv", content))
		assert.notEqual(result.source, "tvtime", content)
	}
	const generic = await recognizeImportFile(
		file("mine.csv", "Title,imdbID,Rating,Status\nAlien,tt0078748,4,seen\n"),
	)
	assert.equal(generic.source, "csv")
})

test("a TV Time extension CSV the generic import could also read names both, so an explicit choice wins", async () => {
	const result = await recognizeImportFile(
		file("renamed.csv", "title,tvdb_id,imdb_id,is_watched,watched_at,rating\n"),
	)
	assert.equal(result.source, "tvtime")
	assert.ok(result.source !== null && result.alsoReads?.includes("csv"))
	const official = await recognizeImportFile(
		file("renamed.csv", "key,s_id,ep_id,s_no,ep_no,created_at\n"),
	)
	assert.ok(official.source !== null && !official.alsoReads)
})

test("renamed TV Time JSON is recognized whatever the order of its ID fields, short or long", async () => {
	const item = (n: number) =>
		`{"title":"Synthetic ${n}","id":{"tmdb":${n},"imdb":"tt${n}","tvdb":${n}},"is_watched":true}`
	const short = await recognizeImportFile(file("mine.json", `[${item(1)}]`))
	assert.equal(short.source, "tvtime")
	const long = `[${Array.from({ length: 1200 }, (_, n) => item(n)).join(",")}]`
	assert.ok(long.length > 64 * 1024)
	const result = await recognizeImportFile(file("mine.json", long))
	assert.equal(result.source, "tvtime")
	const tmdbOnly = await recognizeImportFile(
		file("mine.json", `[{"title":"x","id":{"tmdb":1}}]`),
	)
	assert.equal(tmdbOnly.source, null)
})

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

	const kitsu = await recognizeImportFile(file("kitsu-alp82-anime.xml", xml))
	assert.equal(kitsu.source, "myanimelist")
	assert.equal(kitsu.label, "Kitsu anime library")
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

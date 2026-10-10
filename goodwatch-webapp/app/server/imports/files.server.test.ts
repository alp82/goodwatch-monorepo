import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ImportFileError, parseImportFile } from "./files.server.ts"
import { zipFixture } from "./zip-fixture.test-support.ts"

describe("native import files", () => {
	it("reads a Letterboxd diary watch with day precision", async () => {
		const archive = zipFixture({
			"diary.csv":
				"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\r\n2026-10-09,The Example,2024,https://letterboxd.com/film/the-example/,4.5,Yes,,2026-10-08\r\n",
		})

		const parsed = await parseImportFile("letterboxd", archive)

		assert.deepEqual(parsed.observations, [
			{
				key: "letterboxd:watch:the-example:1",
				kind: "watch",
				mediaType: "movie",
				title: "The Example",
				year: 2024,
				tmdbId: null,
				imdbId: null,
				watchedAt: "2026-10-08",
				precision: "day",
				pass: 1,
			},
		])
	})

	it("doesn't make extra watches from Letterboxd watched and review overlaps", async () => {
		const identity =
			"2026-10-09,The Example,2024,https://letterboxd.com/film/the-example/"
		const archive = zipFixture({
			"diary.csv": `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n${identity},4.5,No,,2026-10-08\n`,
			"watched.csv": `Date,Name,Year,Letterboxd URI\n${identity}\n`,
			"reviews.csv": `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n${identity},4.5,No,Thoughtful review,,2026-10-08\n`,
		})

		const parsed = await parseImportFile("letterboxd", archive)

		assert.deepEqual(
			parsed.observations.map(({ kind }) => kind),
			["watch", "review"],
		)
	})

	it("matches Letterboxd diary and watched overlaps by title and year when their URIs differ", async () => {
		const archive = zipFixture({
			"diary.csv":
				"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2026-10-09,The Example,2024,https://letterboxd.com/user/film/the-example/2/,,Yes,,2026-10-08\n",
			"watched.csv":
				"Date,Name,Year,Letterboxd URI\n2026-10-09,The Example,2024,https://boxd.it/example\n",
		})

		const parsed = await parseImportFile("letterboxd", archive)

		assert.equal(
			parsed.observations.filter(({ kind }) => kind === "watch").length,
			1,
		)
	})

	it("doesn't invent a watch date from Letterboxd's general Date column", async () => {
		const archive = zipFixture({
			"watched.csv":
				"Date,Name,Year,Letterboxd URI\n2026-10-09,The Example,2024,https://letterboxd.com/film/the-example/\n",
		})

		const parsed = await parseImportFile("letterboxd", archive)

		assert.equal(parsed.observations[0].watchedAt, null)
		assert.equal(parsed.observations[0].precision, "unknown")
	})

	it("keeps duplicate Letterboxd diary plays distinct with keys independent of row order", async () => {
		const header =
			"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n"
		const first =
			"2026-10-09,The Example,2024,https://letterboxd.com/film/the-example/,,No,,2026-10-08"
		const second =
			"2026-10-09,The Example,2024,https://letterboxd.com/film/the-example/,,Yes,,2026-10-08"

		const a = await parseImportFile(
			"letterboxd",
			zipFixture({ "diary.csv": `${header}${first}\n${second}\n` }),
		)
		const b = await parseImportFile(
			"letterboxd",
			zipFixture({ "diary.csv": `${header}${second}\n${first}\n` }),
		)

		assert.equal(new Set(a.observations.map(({ key }) => key)).size, 2)
		assert.deepEqual(a.observations, b.observations)
	})

	it("keeps a Letterboxd watch key when its watch date changes", async () => {
		const csv = (watchedDate: string) =>
			`Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2026-10-09,The Example,2024,https://letterboxd.com/member/film/the-example/2/,,,,${watchedDate}\n`

		const before = await parseImportFile(
			"letterboxd",
			zipFixture({ "diary.csv": csv("2026-10-08") }),
		)
		const after = await parseImportFile(
			"letterboxd",
			zipFixture({ "diary.csv": csv("2026-10-07") }),
		)

		assert.equal(before.observations[0].key, after.observations[0].key)
	})

	it("doesn't collide Letterboxd reviews whose entry URLs share an ordinal", async () => {
		const archive = zipFixture({
			"reviews.csv":
				"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Review,Tags,Watched Date\n2026-10-09,First,2024,https://letterboxd.com/member/film/first/2/,,,One,,2026-10-01\n2026-10-09,Second,2025,https://letterboxd.com/member/film/second/2/,,,Two,,2026-10-02\n",
		})

		const parsed = await parseImportFile("letterboxd", archive)

		assert.equal(new Set(parsed.observations.map(({ key }) => key)).size, 2)
	})

	it("uses Trakt history IDs for separate movie and episode watches", async () => {
		const archive = zipFixture({
			"watched-history-1.json": JSON.stringify([
				{
					id: 101,
					type: "movie",
					watched_at: "2026-10-08T20:15:00.000Z",
					movie: {
						title: "A Movie",
						year: 2024,
						ids: { trakt: 5, tmdb: 55, imdb: "tt1234567" },
					},
				},
				{
					id: 102,
					type: "episode",
					watched_at: null,
					show: {
						title: "A Show",
						year: 2023,
						ids: { trakt: 6, tmdb: 66, imdb: "tt2345678" },
					},
					episode: { season: 2, number: 3, ids: { trakt: 7, tmdb: 77 } },
				},
			]),
		})

		const parsed = await parseImportFile("trakt", archive)

		assert.deepEqual(parsed.observations, [
			{
				key: "trakt:watch:101",
				kind: "watch",
				mediaType: "movie",
				title: "A Movie",
				year: 2024,
				tmdbId: 55,
				imdbId: "tt1234567",
				watchedAt: "2026-10-08T20:15:00.000Z",
				precision: "moment",
				pass: 1,
			},
			{
				key: "trakt:watch:102",
				kind: "watch",
				mediaType: "show",
				title: "A Show",
				year: 2023,
				tmdbId: 66,
				imdbId: "tt2345678",
				episodeTmdbId: 77,
				season: 2,
				episode: 3,
				watchedAt: null,
				precision: "unknown",
				pass: 1,
			},
		])
	})

	it("keeps season and episode ratings as distinct unsupported observations", async () => {
		const archive = zipFixture({
			"ratings-episodes.json": JSON.stringify([
				{
					type: "episode",
					rating: 8,
					show: { title: "A Show", year: 2023, ids: { trakt: 6, tmdb: 66 } },
					episode: { season: 1, number: 1, ids: { trakt: 71, tmdb: 771 } },
				},
				{
					type: "episode",
					rating: 9,
					show: { title: "A Show", year: 2023, ids: { trakt: 6, tmdb: 66 } },
					episode: { season: 1, number: 2, ids: { trakt: 72, tmdb: 772 } },
				},
			]),
		})

		const parsed = await parseImportFile("trakt", archive)

		assert.equal(new Set(parsed.observations.map(({ key }) => key)).size, 2)
		assert.deepEqual(
			parsed.observations.map(({ kind }) => kind),
			["unsupported", "unsupported"],
		)
		assert.match(
			parsed.observations[0].problem?.reason ?? "",
			/episode ratings/,
		)
	})

	it("keeps Trakt custom lists as unsupported observations", async () => {
		const archive = zipFixture({
			"lists-lists.json": JSON.stringify([
				{ name: "A Custom List", ids: { trakt: 91, slug: "a-custom-list" } },
			]),
		})

		const parsed = await parseImportFile("trakt", archive)

		assert.equal(parsed.observations[0].kind, "unsupported")
		assert.equal(parsed.observations[0].title, "A Custom List")
		assert.match(
			parsed.observations[0].problem?.reason ?? "",
			/custom Trakt lists/,
		)
	})

	it("rejects an encrypted file before trying to read its contents", async () => {
		const archive = zipFixture(
			{ "diary.csv": "secret" },
			{ encrypted: "diary.csv" },
		)

		await assert.rejects(parseImportFile("letterboxd", archive), (error) => {
			assert.ok(error instanceof ImportFileError)
			assert.match(error.message, /Password-protected/)
			return true
		})
	})

	it("rejects archive paths that escape their directory", async () => {
		const archive = zipFixture({ "../diary.csv": "Date,Name\n" })

		await assert.rejects(
			parseImportFile("letterboxd", archive),
			/unsafe file path/,
		)
	})

	it("rejects duplicate archive paths even when their case differs", async () => {
		const archive = zipFixture([
			["diary.csv", "Date,Name\n"],
			["DIARY.csv", "Date,Name\n"],
		])

		await assert.rejects(
			parseImportFile("letterboxd", archive),
			/duplicate file path/,
		)
	})

	it("rejects an archive whose file contents fail their checksum", async () => {
		const archive = zipFixture(
			{ "diary.csv": "Date,Name\n" },
			{ method: "store" },
		)
		archive[30 + Buffer.byteLength("diary.csv")] ^= 0xff

		await assert.rejects(parseImportFile("letterboxd", archive), /corrupt/)
	})

	it("accepts and ignores safe ZIP directory entries", async () => {
		const archive = zipFixture([
			["likes/", ""],
			[
				"likes/films.csv",
				"Date,Name,Year,Letterboxd URI\n2026-10-09,The Example,2024,https://boxd.it/example\n",
			],
		])

		const parsed = await parseImportFile("letterboxd", archive)

		assert.equal(parsed.observations[0].kind, "favorite")
	})

	it("treats impossible calendar dates as unknown", async () => {
		const archive = zipFixture({
			"diary.csv":
				"Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date\n2026-10-09,The Example,2024,https://boxd.it/example,,,,2026-02-30\n",
		})

		const parsed = await parseImportFile("letterboxd", archive)

		assert.equal(parsed.observations[0].watchedAt, null)
		assert.equal(parsed.observations[0].precision, "unknown")
	})
})

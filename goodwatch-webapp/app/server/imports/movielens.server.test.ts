import assert from "node:assert/strict"
import { test } from "node:test"
import { parseImportFile } from "./files.server.ts"

test("MovieLens ratings preserve half-stars and normalize external IDs without inventing watches", async () => {
	const parsed = await parseImportFile(
		"movielens",
		Buffer.from(
			'movie_id,imdb_id,tmdb_id,rating,average_rating,title\n1,0114709,862,4.5,3.8,Toy Story (1995)\n1305,87884,655,0.5,3.9,"Paris, Texas (1984)"\n',
		),
	)
	assert.equal(parsed.source, "movielens")
	assert.deepEqual(
		parsed.observations.map((x) => [
			x.key,
			x.kind,
			x.tmdbId,
			x.imdbId,
			x.score,
			x.title,
			x.year,
			x.watchedAt,
			x.addedAt,
		]),
		[
			[
				"movielens:rating:1",
				"rating",
				862,
				"tt0114709",
				9,
				"Toy Story",
				1995,
				undefined,
				undefined,
			],
			[
				"movielens:rating:1305",
				"rating",
				655,
				"tt0087884",
				1,
				"Paris, Texas",
				1984,
				undefined,
				undefined,
			],
		],
	)
	assert.match(parsed.warnings.map((w) => w.message).join(" "), /tags/i)
	assert.match(parsed.warnings.map((w) => w.message).join(" "), /activity log/i)
})

test("MovieLens optionally imports wishlist alongside reordered ratings with extra columns", async () => {
	const parsed = await parseImportFile(
		"movielens",
		Buffer.from(
			"title,rating,movie_id,tmdb_id,imdb_id,extra\nToy Story (1995),5,1,862,0114709,anything\n",
		),
		Buffer.from(
			"title,tmdb_id,movie_id,imdb_id,average_rating\nOther (2000),20,2,tt12345678,4.2\n",
		),
	)
	assert.deepEqual(
		parsed.observations.map((x) => [
			x.kind,
			x.key,
			x.score,
			x.tmdbId,
			x.imdbId,
		]),
		[
			["rating", "movielens:rating:1", 10, 862, "tt0114709"],
			["want", "movielens:want:2", undefined, 20, "tt12345678"],
		],
	)
	assert.match(parsed.warnings.map((w) => w.message).join(" "), /extra/)
})

test("MovieLens rejects wrong export formats and limits, and exposes invalid ratings", async () => {
	const header = "movie_id,imdb_id,tmdb_id,rating,average_rating,title\n"
	const parsed = await parseImportFile(
		"movielens",
		Buffer.from(
			header +
				["0", "5.5", "NaN", "2.25", ""]
					.map((score, i) => `${i + 1},0114709,862,${score},4,Toy Story (1995)`)
					.join("\n"),
		),
	)
	assert.ok(parsed.observations.every((x) => x.problem?.outcome === "invalid"))
	for (const [csv, message] of [
		["", "That file is empty."],
		[
			"userId,movieId,rating,timestamp\n1,1,4,1234",
			"MovieLens rating CSV is missing required columns: movie_id, imdb_id, tmdb_id, title, rating. Use your personal export from Settings, not a GroupLens dataset.",
		],
		[
			"movie_id,rating,title\n1,4,A",
			"MovieLens rating CSV is missing required columns: movie_id, imdb_id, tmdb_id, title, rating. Use your personal export from Settings, not a GroupLens dataset.",
		],
		[`${header}1,0114709,862,4,4,"Unclosed`, "The CSV has an unclosed quote."],
		[
			`${header}1,0114709,862,4,4,A\n1,0114709,862,5,4,A`,
			"The MovieLens file contains a duplicate movie_id.",
		],
	])
		await assert.rejects(parseImportFile("movielens", Buffer.from(csv)), {
			message,
		})
	await assert.rejects(
		parseImportFile(
			"movielens",
			Buffer.from(header),
			Buffer.alloc(20 * 1024 * 1024),
		),
		{ message: "The combined export is larger than 20 MB." },
	)
	await assert.rejects(
		parseImportFile(
			"movielens",
			Buffer.from(`${header}${"1,0114709,862,4,4,A\n".repeat(50001)}`),
		),
		{ message: "That export has more than 50,000 rows." },
	)
})

test("MovieLens keeps repeated invalid IDs as individual invalid rows", async () => {
	const parsed = await parseImportFile(
		"movielens",
		Buffer.from(
			"movie_id,imdb_id,tmdb_id,rating,title\n,114709,862,4,One\n,114709,862,3,Two\n0,114709,862,2,Three\n0,114709,862,1,Four\n",
		),
	)
	assert.equal(parsed.observations.length, 4)
	assert.ok(
		parsed.observations.every(
			(x) =>
				x.problem?.reason === "MovieLens movie_id must be a positive integer.",
		),
	)
	assert.equal(new Set(parsed.observations.map((x) => x.key)).size, 4)
})

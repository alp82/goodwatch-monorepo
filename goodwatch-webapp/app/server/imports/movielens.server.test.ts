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
	assert.match(parsed.warnings.join(" "), /tags/i)
	assert.match(parsed.warnings.join(" "), /activity log/i)
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
	assert.match(parsed.warnings.join(" "), /extra/)
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
	for (const csv of [
		"",
		"userId,movieId,rating,timestamp\n1,1,4,1234",
		"movie_id,rating,title\n1,4,A",
		`${header}1,0114709,862,4,4,"Unclosed`,
		`${header}1,0114709,862,4,4,A\n1,0114709,862,5,4,A`,
	]) {
		await assert.rejects(
			parseImportFile("movielens", Buffer.from(csv)),
			/empty|column|quote|duplicate/i,
		)
	}
	await assert.rejects(
		parseImportFile(
			"movielens",
			Buffer.from(header),
			Buffer.alloc(20 * 1024 * 1024),
		),
		/20 MB/,
	)
	await assert.rejects(
		parseImportFile(
			"movielens",
			Buffer.from(`${header}${"1,0114709,862,4,4,A\n".repeat(50001)}`),
		),
		/50,000/,
	)
})

import assert from "node:assert/strict"
import { test } from "node:test"
import { parseImportFile } from "./files.server.ts"

test("generic CSV imports ratings and dated watches using documented columns", async () => {
	const parsed = await parseImportFile(
		"csv",
		Buffer.from(
			'tmdbID,imdbID,Title,Year,Rating,Rating10,WatchedDate,Review,Extra\n862,tt0114709,Toy Story,1995,4.5,8,2026-01-02,"Great \\"movie\\"",ignored\n,tt0087884,"Paris, Texas",1984,2.5,,,,\n',
		),
	)
	assert.equal(parsed.source, "csv")
	assert.deepEqual(
		parsed.observations.map((x) => [x.kind, x.score, x.watchedAt, x.review]),
		[
			["watch", undefined, "2026-01-02", undefined],
			["rating", 8, undefined, undefined],
			["review", undefined, undefined, 'Great "movie"'],
			["rating", 5, undefined, undefined],
		],
	)
	assert.equal(parsed.observations[0].tmdbId, 862)
	assert.equal(parsed.observations[0].precision, "day")
	assert.match(parsed.warnings.join(" "), /Extra/)
})

test("generic CSV accepts export aliases and rejects malformed or excessive input", async () => {
	const parsed = await parseImportFile(
		"csv",
		Buffer.from(
			"\ufeffName,Year,Watched Date,Rating\r\nExample,2024,2024-02-30,4.2\r\n",
		),
	)
	assert.deepEqual(
		parsed.observations.map((x) => x.problem?.outcome),
		["invalid", "invalid"],
	)
	assert.equal(parsed.observations[0].title, "Example")
	for (const csv of [
		"",
		'Title,Rating\n"Unclosed,4',
		"Title,Title\nA,B",
		"Nonsense\nA",
		"Title,Rating\nA,4,extra",
	]) {
		await assert.rejects(
			parseImportFile("csv", Buffer.from(csv)),
			/empty|quote|duplicate|column|field/i,
		)
	}
	await assert.rejects(
		parseImportFile("csv", Buffer.alloc(20 * 1024 * 1024 + 1)),
		/20 MB/,
	)
	await assert.rejects(
		parseImportFile(
			"csv",
			Buffer.from(`Title,Rating\n${"A,4\n".repeat(50001)}`),
		),
		/50,000/,
	)
})

test("CSV reordering preserves distinct viewing identities and explains unused metadata", async () => {
	const header =
		"LetterboxdURI,Name,Year,Rating10,Rating,Watched Date,Rewatch,Tags,Directors\n"
	const first =
		"https://letterboxd.com/film/example/,Example,2024,9,2,2024-01-01,false,tag,Director\n"
	const second =
		"https://letterboxd.com/film/example/,Example,2024,8,1,2024-02-01,true,,Director\n"
	const a = await parseImportFile("csv", Buffer.from(header + first + second))
	const b = await parseImportFile("csv", Buffer.from(header + second + first))
	assert.deepEqual(a.observations, b.observations)
	assert.equal(
		new Set(a.observations.filter((x) => x.kind === "watch").map((x) => x.key))
			.size,
		2,
	)
	assert.match(a.warnings.join(" "), /Tags/)
	assert.match(a.warnings.join(" "), /Directors/)
})

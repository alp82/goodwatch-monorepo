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
	assert.match(parsed.warnings.map((w) => w.message).join(" "), /Extra/)
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
	for (const [csv, message] of [
		["", "That file is empty."],
		['Title,Rating\n"Unclosed,4', "The CSV has an unclosed quote."],
		["Title,Title\nA,B", "The CSV has duplicate columns."],
		["Nonsense\nA", "Include a Title, tmdbID, imdbID or LetterboxdURI column."],
		["Title,Rating\nA,4,extra", "A CSV row has the wrong number of fields."],
	])
		await assert.rejects(parseImportFile("csv", Buffer.from(csv)), { message })
	await assert.rejects(
		parseImportFile("csv", Buffer.alloc(20 * 1024 * 1024 + 1)),
		{ message: "That export is larger than 20 MB." },
	)
	await assert.rejects(
		parseImportFile(
			"csv",
			Buffer.from(`Title,Rating\n${"A,4\n".repeat(50001)}`),
		),
		{ message: "That export has more than 50,000 rows." },
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
	assert.match(a.warnings.map((w) => w.message).join(" "), /Tags/)
	assert.match(a.warnings.map((w) => w.message).join(" "), /Directors/)
})

test("CSV preserves trailing backslashes and multiline reviews without swallowing rows", async () => {
	const csv = String.raw`Title,Rating,Review
One,4,"ends with \"
Two,3,"C:\\"
Three,5,"first line
second line with \"quotes\""
Four,2,"last"`
	const parsed = await parseImportFile("csv", Buffer.from(csv))
	assert.deepEqual(
		parsed.observations.filter((x) => x.kind === "review").map((x) => x.review),
		["ends with \\", "C:\\", 'first line\nsecond line with "quotes"', "last"],
	)
	assert.equal(parsed.observations.filter((x) => x.kind === "rating").length, 4)
})

test("CSV distinguishes absent ratings from invalid ratings and falls back from invalid Rating10", async () => {
	const parsed = await parseImportFile(
		"csv",
		Buffer.from(
			"Title,Rating10,Rating,Review\nTitle only,,,\nReview only,,,A review\nFallback,11,4,\nInvalid,11,6,\n",
		),
	)
	assert.equal(
		parsed.observations.find((x) => x.title === "Title only")?.problem?.reason,
		"This row has no rating or watched date.",
	)
	assert.deepEqual(
		parsed.observations
			.filter((x) => x.title === "Review only")
			.map((x) => x.kind),
		["review"],
	)
	assert.equal(
		parsed.observations.find((x) => x.title === "Fallback")?.score,
		8,
	)
	assert.equal(
		parsed.observations.find((x) => x.title === "Invalid")?.problem?.outcome,
		"invalid",
	)
})

test("CSV normalizes bare IMDb IDs and clips reviews to the existing 20,000 character limit", async () => {
	const parsed = await parseImportFile(
		"csv",
		Buffer.from(`Title,imdbID,Review\nExample,114709,${"x".repeat(20001)}\n`),
	)
	assert.equal(parsed.observations[0].imdbId, "tt0114709")
	assert.equal(parsed.observations[0].review, "x".repeat(20000))
})

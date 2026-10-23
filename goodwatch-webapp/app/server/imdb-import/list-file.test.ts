import "./loader.test-support.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { it } from "node:test"
const { parseCsv, readRatingsFile, readImdbListFile } = await import(
	"./file.server.ts"
)
import { classifyImdbHeader } from "../../domain/imdb-file.ts"
const fixture = (name: string) =>
	readFileSync(
		new URL(`./fixtures/imdb-${name}-synthetic.csv`, import.meta.url),
		"utf8",
	)

it("distinguishes Ratings from IMDb title-list headers without guessing Watchlist versus custom-list intent", () => {
	assert.equal(classifyImdbHeader(parseCsv(fixture("ratings"))[0]), "ratings")
	assert.equal(classifyImdbHeader(parseCsv(fixture("watchlist"))[0]), "list")
	assert.equal(classifyImdbHeader(parseCsv(fixture("custom-list"))[0]), "list")
	assert.equal(classifyImdbHeader(["Title", "Rating"]), "unknown")
	assert.equal(readRatingsFile(fixture("ratings"))[0].score, 7)
	assert.throws(() => readRatingsFile(fixture("watchlist")), /Watchlist|list/i)
})

it("reads Watchlist wants and personal ratings with Created as addedAt and keeps notes distinct from reviews", () => {
	const parsed = readImdbListFile(fixture("watchlist"), "watchlist")
	assert.equal(parsed.source, "imdb_list")
	assert.deepEqual(
		parsed.observations
			.filter((row) => row.kind === "want")
			.map((row) => [row.imdbId, row.mediaType, row.addedAt]),
		[
			["tt0114709", "movie", "2020-02-01"],
			["tt1234567", "show", "2022-05-06"],
		],
	)
	assert.deepEqual(
		parsed.observations
			.filter((row) => row.kind === "rating")
			.map((row) => [row.imdbId, row.score]),
		[["tt0114709", 7]],
	)
	assert.ok(
		parsed.observations.every(
			(row) => row.kind !== "watch" && row.kind !== "review",
		),
	)
	assert.ok(
		parsed.observations.some(
			(row) =>
				row.kind === "unsupported" &&
				row.imdbList?.description ===
					"A list note, not a review.\nSecond line.",
		),
	)
	assert.ok(
		parsed.observations.some(
			(row) =>
				row.imdbId === "tt7654321" && row.problem?.outcome === "unsupported",
		),
	)
})

it("keeps custom-list membership as unsupported while importing its personal ratings without inventing wants or reviews", () => {
	const parsed = readImdbListFile(fixture("custom-list"), "custom-list")
	assert.ok(
		parsed.observations.every(
			(row) =>
				row.kind !== "want" && row.kind !== "review" && row.kind !== "watch",
		),
	)
	assert.equal(
		parsed.observations.filter((row) => row.kind === "rating").length,
		1,
	)
	assert.equal(parsed.observations[0].imdbList?.position, "1")
	assert.equal(parsed.observations[0].imdbList?.modified, "2025-03-04")
	assert.equal(parsed.observations[0].imdbList?.dateRated, "2021-01-02")
})

it("retains ambiguous or invalid Created dates and malformed personal scores independently of Watchlist membership", () => {
	const csv =
		"Position,Const,Created,Modified,Description,Title,Title Type,IMDb Rating,Your Rating\n1,tt0114709,02/03/24,2024-02-01,,Movie,Movie,9.1,invalid\n2,tt1234567,2024-02-30,2024-03-01,,Show,TV Series,8.0,\n"
	const parsed = readImdbListFile(csv, "watchlist")
	assert.equal(
		parsed.observations.filter((row) => row.kind === "want" && !row.problem)
			.length,
		2,
	)
	assert.ok(
		parsed.observations
			.filter((row) => row.kind === "want")
			.every((row) => row.addedAt === null),
	)
	assert.equal(
		parsed.observations.find((row) => row.kind === "rating")?.problem?.outcome,
		"invalid",
	)
	assert.ok(parsed.warnings.some((warning) => warning.kind === "actionable"))
	assert.equal(parsed.observations[0].imdbList?.created, "02/03/24")
})

it("recognizes legacy Position/Created/You rated files as ambiguous and can read either explicitly chosen meaning", () => {
	const csv = fixture("legacy")
	assert.equal(classifyImdbHeader(parseCsv(csv)[0]), "legacy-ambiguous")
	assert.equal(readRatingsFile(csv)[0].score, 7)
	assert.equal(readRatingsFile(csv)[0].dateRated, "2011-03-04")
	const watchlist = readImdbListFile(csv, "watchlist")
	assert.equal(
		watchlist.observations.find((row) => row.kind === "want")?.addedAt,
		"2010-02-01",
	)
})

it("turns an IMDb custom list into one named ordered list with notes while keeping its personal ratings independent", () => {
	const parsed = readImdbListFile(
		fixture("custom-list"),
		"custom-list",
		"Original IMDb list name",
	)
	const list = parsed.observations.find(
		(row) => row.kind === "list",
	)?.customList
	assert.equal(list?.name, "Original IMDb list name")
	assert.deepEqual(
		list?.entries.map((item) => item.position),
		[1, 2, 3],
	)
	assert.equal(
		list?.entries[0].note,
		"A list note, not a review.\nSecond line.",
	)
	assert.equal(list?.entries[2].entry.problem?.outcome, "unsupported")
	assert.equal(
		parsed.observations.filter((row) => row.kind === "rating").length,
		1,
	)
	assert.ok(
		parsed.observations.every(
			(row) => row.kind !== "want" && row.kind !== "review",
		),
	)
})

it("retains an ambiguous custom-list Created date without claiming a new wish will be added", () => {
	const parsed = readImdbListFile(
		"Position,Const,Created,Description,Title,Title Type\n1,tt0114709,02/03/24,Note,Synthetic movie,Movie\n",
		"custom-list",
		"Original name",
	)
	assert.ok(
		parsed.warnings.every(
			(warning) =>
				!warning.message.includes("uses the import date for the new wish"),
		),
	)
	assert.equal(
		parsed.observations.find((row) => row.kind === "list")?.customList
			?.entries[0].entry.imdbList?.created,
		"02/03/24",
	)
})

it("keeps TV Episode ratings as episode rows with their IMDb ID and score, and still leaves shorts out", () => {
	const rows = readRatingsFile(
		[
			"Const,Your Rating,Date Rated,Title,Title Type,Year",
			"tt9000001,9,2021-01-02,Winter Is Coming,TV Episode,2011",
			"tt9000002,,2021-01-02,No rating,TV Episode,2011",
			"tt9000003,8,2021-01-02,A short,Short,2011",
		].join("\n"),
	)
	assert.deepEqual(
		rows.map((row) => [
			row.imdbId,
			row.episode,
			row.mediaType,
			row.score,
			row.problem?.outcome,
		]),
		[
			["tt9000001", true, null, 9, undefined],
			["tt9000002", undefined, null, null, "invalid"],
			["tt9000003", undefined, null, 8, "unsupported"],
		],
	)
	assert.match(rows[2].problem?.reason ?? "", /movies, shows and episodes/)
})

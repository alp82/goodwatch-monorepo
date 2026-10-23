import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { parseImportFile } from "./files.server.ts"

const movie = `<movie><title>Toy &amp; Story</title><year>1995</year><uniqueid type="tmdb">862</uniqueid><uniqueid type="imdb">tt0114709</uniqueid><userrating>9</userrating><playcount>4</playcount><lastplayed>2026-10-12</lastplayed></movie>`
test("Kodi imports one day-precision watch and the member score per movie, ignoring unset ratings and partial plays", async () => {
	const parsed = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb>${movie}<movie><title>Partial</title><playcount>0</playcount><lastplayed>2026-10-12</lastplayed><userrating>0</userrating></movie></videodb>`,
		),
	)
	assert.equal(parsed.source, "kodi")
	assert.deepEqual(
		parsed.observations.map((x) => [
			x.kind,
			x.title,
			x.tmdbId,
			x.imdbId,
			x.score,
			x.watchedAt,
			x.precision,
			x.pass,
		]),
		[
			[
				"rating",
				"Toy & Story",
				862,
				"tt0114709",
				9,
				undefined,
				undefined,
				undefined,
			],
			[
				"watch",
				"Toy & Story",
				862,
				"tt0114709",
				undefined,
				"2026-10-12",
				"day",
				1,
			],
		],
	)
})

test("Kodi passes nested episode evidence with unknown numbering and ignores the show's playcount", async () => {
	const parsed = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb><tvshow><title>Friends</title><uniqueid type="tmdb">1668</uniqueid><userrating>8</userrating><playcount>50</playcount><episodedetails><title>Pilot</title><uniqueid type="tmdb">1001</uniqueid><uniqueid type="tvdb">2001</uniqueid><season>0</season><episode>2</episode><userrating>7</userrating><playcount>9</playcount><lastplayed/></episodedetails></tvshow><musicvideo><title>Clip</title></musicvideo></videodb>`,
		),
	)
	const watch = parsed.observations.find((x) => x.kind === "watch")
	assert.equal(parsed.observations.filter((x) => x.kind === "watch").length, 1)
	assert.deepEqual(
		[
			watch?.tmdbId,
			watch?.episodeTmdbId,
			watch?.episodeTvdbId,
			watch?.season,
			watch?.episode,
			watch?.episodeNumbering,
			watch?.watchedAt,
			watch?.precision,
		],
		[1668, 1001, 2001, 0, 2, "unknown", null, "unknown"],
	)
	assert.equal(parsed.observations.find((x) => x.kind === "rating")?.score, 8)
	// The episode's userrating is an episode score with the same evidence as its watch (#759); only the music
	// video stays unsupported.
	const score = parsed.observations.find((x) => x.kind === "episode_rating")
	assert.deepEqual(
		[
			score?.key,
			score?.scoreScope,
			score?.mediaType,
			score?.tmdbId,
			score?.episodeTmdbId,
			score?.episodeTvdbId,
			score?.episodeName,
			score?.season,
			score?.episode,
			score?.episodeNumbering,
			score?.score,
			score?.problem,
		],
		[
			"kodi:episode_rating:show:tmdb:1668:episode:tmdb:1001",
			"episode",
			"show",
			1668,
			1001,
			2001,
			"Pilot",
			0,
			2,
			"unknown",
			7,
			undefined,
		],
	)
	assert.equal(
		parsed.observations.filter((x) => x.problem?.outcome === "unsupported")
			.length,
		1,
	)
})

test("a Kodi episode userrating outside 1 to 10 stays visible as an invalid episode score", async () => {
	const parsed = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb><tvshow><title>Friends</title><uniqueid type="tmdb">1668</uniqueid><episodedetails><title>Pilot</title><uniqueid type="tmdb">1001</uniqueid><season>1</season><episode>1</episode><userrating>12</userrating></episodedetails></tvshow></videodb>`,
		),
	)
	const score = parsed.observations.find((x) => x.kind === "episode_rating")
	assert.equal(score?.problem?.outcome, "invalid")
	assert.equal(score?.score, null)
	assert.equal(score?.episodeTmdbId, 1001)
})

test("Kodi accepts a zipped library without artwork and collapses video versions to the latest watch with stable identities", async () => {
	const { zipFixture } = await import("./zip-fixture.test-support.ts")
	const xml = `<videodb>${movie}${movie.replace("2026-10-12", "2026-10-14")}</videodb>`
	const raw = await parseImportFile("kodi", Buffer.from(xml))
	const zipped = await parseImportFile(
		"kodi",
		zipFixture({
			"kodi_videodb_2026-10-15/videodb.xml": xml,
			"kodi_videodb_2026-10-15/movies/art.jpg": "ignored",
		}),
	)
	assert.deepEqual(zipped, raw)
	assert.equal(raw.observations.length, 2)
	assert.equal(
		raw.observations.find((x) => x.kind === "watch")?.watchedAt,
		"2026-10-14",
	)
	const changed = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb>${movie.replace("2026-10-12", "2026-09-01")}</videodb>`,
		),
	)
	assert.deepEqual(
		raw.observations.map((x) => x.key),
		changed.observations.map((x) => x.key),
	)
})

test("Kodi rejects untrusted XML, separate NFOs, ambiguous archives and oversized exports", async () => {
	const { zipFixture } = await import("./zip-fixture.test-support.ts")
	const { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } = await import(
		"../../domain/imports.ts"
	)
	for (const [xml, error] of [
		['<!DOCTYPE videodb SYSTEM "file:///etc/passwd"><videodb/>', /DOCTYPE/],
		[
			'<!DOCTYPE videodb [<!ENTITY a "expanded">]><videodb>&a;</videodb>',
			/DOCTYPE/,
		],
		["<videodb>&unknown;</videodb>", /valid XML/],
		["<videodb><movie></videodb>", /valid XML/],
		["<movie><title>NFO</title></movie>", /Single file/],
		[
			`<videodb>${"<nested>".repeat(65)}${"</nested>".repeat(65)}</videodb>`,
			/too complex/,
		],
	] as const)
		await assert.rejects(parseImportFile("kodi", Buffer.from(xml)), error)
	await assert.rejects(
		parseImportFile("kodi", zipFixture({ "movie.nfo": movie })),
		/videodb\.xml/,
	)
	await assert.rejects(
		parseImportFile(
			"kodi",
			zipFixture({
				"a/videodb.xml": "<videodb/>",
				"b/videodb.xml": "<videodb/>",
			}),
		),
		/exactly one/,
	)
	await assert.rejects(
		parseImportFile("kodi", Buffer.alloc(IMPORT_MAX_BYTES + 1)),
		/20 MB/,
	)
	await assert.rejects(
		parseImportFile(
			"kodi",
			Buffer.from(
				`<videodb>${"<movie/>".repeat(IMPORT_MAX_ROWS + 1)}</videodb>`,
			),
		),
		/50,000/,
	)
	await assert.rejects(
		parseImportFile(
			"kodi",
			Buffer.from(`<videodb>${movie.repeat(25_001)}</videodb>`),
		),
		/50,000/,
	)
})

test("Kodi keeps malformed scores and dates visible and warns about mass mark-as-watched dates", async () => {
	const invalid = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb>${movie.replace("<userrating>9", "<userrating>11").replace("2026-10-12", "2026-02-30")}</videodb>`,
		),
	)
	assert.equal(invalid.observations[0].problem?.outcome, "invalid")
	assert.equal(invalid.observations[1].watchedAt, null)
	assert.match(
		invalid.warnings.map((w) => w.message).join(" "),
		/invalid.*date/i,
	)
	const clustered = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb>${Array.from({ length: 100 }, (_, i) => movie.replace(">862<", `>${i + 1}<`)).join("")}</videodb>`,
		),
	)
	assert.match(clustered.warnings.map((w) => w.message).join(" "), /100.*day/)
})

test("Kodi reads a full export ZIP with hundreds of artwork files without expanding artwork", async () => {
	const { zipFixture } = await import("./zip-fixture.test-support.ts")
	const xml = `<videodb>${movie}</videodb>`
	const files: Array<[string, string]> = [
		["export/videodb.xml", xml],
		...Array.from({ length: 201 }, (_, i): [string, string] => [
			`export/actors/${i}.jpg`,
			"art",
		]),
	]
	// Declared artwork sizes exceed expansion limits; unused payloads are never inflated.
	const zip = Buffer.from(zipFixture(files))
	for (let i = 0; i < zip.length - 46; i++)
		if (zip.readUInt32LE(i) === 0x02014b50 && zip.readUInt32LE(i + 24) === 3)
			zip.writeUInt32LE(40 * 1024 * 1024, i + 24)
	assert.deepEqual(
		await parseImportFile("kodi", zip),
		await parseImportFile("kodi", Buffer.from(xml)),
	)
	await assert.rejects(
		parseImportFile("kodi", zipFixture([...files, ["../art.jpg", "art"]])),
		/unsafe file path/,
	)
	await assert.rejects(
		parseImportFile("kodi", Buffer.alloc(20 * 1024 * 1024 + 1)),
		/Upload videodb\.xml by itself/,
	)
})

test("Kodi parses actor-heavy XML within a bounded heap without treating nested metadata as title fields", () => {
	const result = spawnSync(
		process.execPath,
		[
			"--max-old-space-size=64",
			"--input-type=module",
			"-e",
			`
 import assert from "node:assert/strict";
 import { parseImportFile } from ${JSON.stringify(new URL("./files.server.ts", import.meta.url).href)};
 const bytes = Buffer.from('<videodb><movie><title>Movie</title><uniqueid type="tmdb">862</uniqueid><playcount>1</playcount>' + '<actor><name>Actor</name><role>Role</role><title>Not the movie</title></actor>'.repeat(180000) + '</movie></videodb>');
 const result = await parseImportFile("kodi",bytes);
 assert.equal(result.observations.length,1);
 assert.equal(result.observations[0].title,"Movie");
 `,
		],
		{ encoding: "utf8", maxBuffer: 1024 * 1024 },
	)
	assert.equal(result.status, 0, result.stderr.slice(-2000))
})

test("Kodi bounds total XML elements even when their metadata is ignored", async () => {
	await assert.rejects(
		parseImportFile(
			"kodi",
			Buffer.from(`<videodb>${"<ignored/>".repeat(1_000_000)}</videodb>`),
		),
		/too complex/,
	)
})

test("Kodi merges IMDb-only video versions with their paired TMDB identity regardless of export order", async () => {
	const imdbOnly = movie
		.replace('<uniqueid type="tmdb">862</uniqueid>', "")
		.replace("2026-10-12", "2026-10-14")
	for (const entries of [
		[movie, imdbOnly],
		[imdbOnly, movie],
	]) {
		const parsed = await parseImportFile(
			"kodi",
			Buffer.from(`<videodb>${entries.join("")}</videodb>`),
		)
		assert.equal(parsed.observations.length, 2)
		assert.deepEqual(
			parsed.observations.map((x) => x.key),
			["kodi:rating:movie:tmdb:862", "kodi:watch:movie:tmdb:862"],
		)
		assert.equal(
			parsed.observations.find((x) => x.kind === "watch")?.watchedAt,
			"2026-10-14",
		)
		assert.ok(parsed.observations.every((x) => x.tmdbId === 862))
	}
	const ambiguous = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb>${movie}${movie.replace(">862<", ">999<")}${imdbOnly}</videodb>`,
		),
	)
	assert.equal(ambiguous.observations.length, 6)
})

test("Kodi filtered archives still bound entry count and XML expansion and verify XML integrity", async () => {
	const { zipFixture } = await import("./zip-fixture.test-support.ts")
	await assert.rejects(
		parseImportFile(
			"kodi",
			zipFixture(
				Array.from(
					{ length: 50_001 },
					(_, i) => [`art/${i}.jpg`, ""] as [string, string],
				),
			),
		),
		/too many files/,
	)
	const oversized = Buffer.from(zipFixture({ "videodb.xml": "<videodb/>" }))
	for (let i = 0; i < oversized.length - 46; i++)
		if (oversized.readUInt32LE(i) === 0x02014b50)
			oversized.writeUInt32LE(32 * 1024 * 1024 + 1, i + 24)
	await assert.rejects(
		parseImportFile("kodi", oversized),
		/file inside.*too large/,
	)
	const corrupt = Buffer.from(zipFixture({ "videodb.xml": "<videodb/>" }))
	for (let i = 0; i < corrupt.length - 46; i++)
		if (corrupt.readUInt32LE(i) === 0x02014b50) corrupt.writeUInt32LE(0, i + 16)
	await assert.rejects(parseImportFile("kodi", corrupt), /corrupt/)
})

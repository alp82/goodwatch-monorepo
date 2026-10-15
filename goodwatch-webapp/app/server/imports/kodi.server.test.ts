import assert from "node:assert/strict"
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
	assert.equal(
		parsed.observations.filter((x) => x.problem?.outcome === "unsupported")
			.length,
		2,
	)
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
	for (const xml of [
		'<!DOCTYPE videodb SYSTEM "file:///etc/passwd"><videodb/>',
		'<!DOCTYPE videodb [<!ENTITY a "expanded">]><videodb>&a;</videodb>',
		"<videodb>&unknown;</videodb>",
		"<videodb><movie></videodb>",
		"<movie><title>NFO</title></movie>",
		`<videodb>${"<nested>".repeat(65)}${"</nested>".repeat(65)}</videodb>`,
	])
		await assert.rejects(parseImportFile("kodi", Buffer.from(xml)))
	await assert.rejects(
		parseImportFile("kodi", zipFixture({ "movie.nfo": movie })),
		/videodb.xml/,
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
	assert.match(invalid.warnings.join(" "), /invalid.*date/i)
	const clustered = await parseImportFile(
		"kodi",
		Buffer.from(
			`<videodb>${Array.from({ length: 100 }, (_, i) => movie.replace(">862<", `>${i + 1}<`)).join("")}</videodb>`,
		),
	)
	assert.match(clustered.warnings.join(" "), /100.*day/)
})

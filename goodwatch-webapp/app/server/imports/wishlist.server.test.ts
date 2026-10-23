import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "../../domain/imports.ts"
import { ImportFileError, parseImportFile } from "./files.server.ts"

const bytes = (value: unknown) =>
	new TextEncoder().encode(JSON.stringify(value))
const envelope = (
	items: unknown[],
	metadata: Record<string, unknown> = {},
) => ({
	format: "goodwatch-wishlist",
	version: 1,
	source: "example",
	completeness: "complete",
	items,
	...metadata,
})

describe("Wishlist JSON imports", () => {
	it("reads explicit movie and show wishes without creating watches or ratings", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes(
				envelope([
					{
						title: "Movie",
						mediaType: "movie",
						tmdbId: 42,
						year: 2024,
						addedAt: "2026-10-01",
					},
					{ title: "Show", mediaType: "show", imdbId: "tt1234567" },
				]),
			),
		)
		assert.equal(parsed.source, "wishlist")
		assert.deepEqual(
			parsed.observations.map(
				({ kind, mediaType, title, tmdbId, imdbId, addedAt }) => ({
					kind,
					mediaType,
					title,
					tmdbId,
					imdbId,
					addedAt,
				}),
			),
			[
				{
					kind: "want",
					mediaType: "movie",
					title: "Movie",
					tmdbId: 42,
					imdbId: null,
					addedAt: "2026-10-01",
				},
				{
					kind: "want",
					mediaType: "show",
					title: "Show",
					tmdbId: null,
					imdbId: "tt1234567",
					addedAt: null,
				},
			],
		)
	})
	it("retains unknown scope and source evidence for unmatched wishes", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes(
				envelope(
					[
						{
							title: "Unknown title",
							mediaType: "unknown",
							tmdbId: 42,
							sourceId: "provider-123",
							sourceUrl: "https://example.test/title/123",
						},
					],
					{
						profileLabel: "Family",
						country: "DE",
						exportedAt: "2026-10-18T12:00:00Z",
						completeness: "partial",
					},
				),
			),
		)
		const item = parsed.observations[0]
		assert.equal(item.title, "Unknown title")
		assert.equal(item.problem?.outcome, "unmatched")
		assert.deepEqual(item.wishlistEvidence, {
			source: "example",
			profileLabel: "Family",
			country: "DE",
			exportedAt: "2026-10-18T12:00:00Z",
			completeness: "partial",
			mediaType: "unknown",
			sourceId: "provider-123",
			sourceUrl: "https://example.test/title/123",
		})
		assert.equal(parsed.warnings.length, 1)
	})

	it("rejects invalid envelopes and unsupported versions before accepting any wishes", async () => {
		for (const value of [
			null,
			{},
			{ items: [] },
			envelope([], { version: 2 }),
			envelope([], { source: "" }),
			envelope([], { completeness: "yes" }),
			envelope([], { completeness: ["complete"] }),
			envelope([], { exportedAt: "2026-02-30" }),
			envelope([], { country: 123 }),
		]) {
			await assert.rejects(
				parseImportFile("wishlist", bytes(value)),
				ImportFileError,
			)
		}
	})

	it("retains malformed rows as invalid and never repairs identity or dates", async () => {
		for (const invalid of [
			null,
			{ title: "" },
			{ tmdbId: "42" },
			{ tmdbId: -1 },
			{ imdbId: "1234567" },
			{ year: "2024" },
			{ addedAt: "2026-02-30" },
			{ sourceUrl: "javascript:alert(1)" },
			{ mediaType: "tv" },
			{ mediaType: ["movie"] },
			{ addedAt: "2026-10-18T24:00:00Z" },
		]) {
			const row =
				invalid === null
					? null
					: { title: "Evidence", mediaType: "movie", tmdbId: 42, ...invalid }
			const parsed = await parseImportFile(
				"wishlist",
				bytes(
					envelope([row, { title: "Valid", mediaType: "show", tmdbId: 12 }]),
				),
			)
			assert.equal(parsed.observations[0].problem?.outcome, "invalid")
			assert.equal(parsed.observations[1].problem, undefined)
		}
		const unknown = await parseImportFile(
			"wishlist",
			bytes(envelope([{ title: "Title only", mediaType: "movie" }])),
		)
		assert.equal(unknown.observations[0].problem?.outcome, "unmatched")
	})

	it("imports Watcharr statuses, scores out of ten and multiline thoughts as independent kinds", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes([
				{
					id: 1,
					status: "PLANNED",
					content: { title: "Movie", type: "movie", tmdbId: 42 },
				},
				...["FINISHED", "WATCHING", "HOLD", "DROPPED"].map((status, i) => ({
					id: i + 2,
					status,
					content: { title: status, type: "tv", tmdbId: i + 43 },
				})),
				{
					id: 6,
					status: "FINISHED",
					rating: 8.5,
					thoughts: "First line.\nSecond line.",
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2025-01-01T00:00:00Z",
					content: { title: "Seen movie", type: "movie", tmdbId: 50 },
				},
			]),
		)
		assert.deepEqual(
			parsed.observations.map((i) => [i.kind, i.showStatus ?? i.score ?? null]),
			[
				["want", null],
				["show_status", "completed"],
				["show_status", "watching"],
				["show_status", "on_hold"],
				["show_status", "dropped"],
				["watch", null],
				["rating", 9],
				["review", null],
			],
		)
		assert.equal(parsed.observations[1].completionScope, "show")
		assert.equal(parsed.observations[5].watchedAt, null)
		assert.equal(parsed.observations[5].precision, "unknown")
		assert.equal(parsed.observations[7].review, "First line.\nSecond line.")
		assert.ok(parsed.warnings.some((w) => /rounded/i.test(w.message)))
	})

	it("bounds upload bytes and item counts, including ignored native entries", async () => {
		await assert.rejects(
			parseImportFile("wishlist", new Uint8Array()),
			ImportFileError,
		)
		await assert.rejects(
			parseImportFile("wishlist", new Uint8Array(IMPORT_MAX_BYTES + 1)),
			ImportFileError,
		)
		await assert.rejects(
			parseImportFile("wishlist", new Uint8Array([0xff])),
			ImportFileError,
		)
		await assert.rejects(
			parseImportFile(
				"wishlist",
				bytes(
					envelope(
						Array(IMPORT_MAX_ROWS + 1).fill({
							title: "Title",
							mediaType: "movie",
							tmdbId: 1,
						}),
					),
				),
			),
			ImportFileError,
		)
		await assert.rejects(
			parseImportFile(
				"wishlist",
				bytes(
					Array(IMPORT_MAX_ROWS + 1).fill({
						status: "FINISHED",
						content: { title: "Title", type: "movie", tmdbId: 1 },
					}),
				),
			),
			ImportFileError,
		)
	})

	it("keeps identity keys independent of ordering and source-added dates", async () => {
		const first = {
			title: "Movie",
			mediaType: "movie",
			tmdbId: 42,
			addedAt: "2026-10-01",
		}
		const second = { title: "Show", mediaType: "show", tmdbId: 42 }
		const a = await parseImportFile(
			"wishlist",
			bytes(envelope([first, second])),
		)
		const b = await parseImportFile(
			"wishlist",
			bytes(envelope([second, { ...first, addedAt: "2026-10-02" }])),
		)
		assert.equal(a.observations[0].key, b.observations[1].key)
		assert.notEqual(a.observations[0].key, a.observations[1].key)
	})

	it("rejects malformed native identities without trusting IMDb or title guesses", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes([
				{
					status: "PLANNED",
					content: { title: "IMDb only", type: "movie", imdb_id: "tt1234567" },
				},
				{
					status: "PLANNED",
					content: { title: "String TMDB", type: "tv", tmdbId: "42" },
				},
				{
					status: "UNKNOWN",
					content: { title: "Wrong intent", type: "movie", tmdbId: 42 },
				},
				null,
			]),
		)
		assert.deepEqual(
			parsed.observations.map((item) => item.problem?.outcome),
			["invalid", "invalid", "invalid", "invalid"],
		)
	})
	it("allows explicit movie and show title-year evidence without IDs while keeping unknown scopes and title-only rows unmatched", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes(
				envelope([
					{ title: "Toy Story", year: 1995, mediaType: "movie" },
					{ title: "Example Show", year: 2020, mediaType: "show" },
					{ title: "Toy Story", year: 1995, mediaType: "unknown" },
					{ title: "Toy Story", mediaType: "movie" },
				]),
			),
		)
		assert.deepEqual(
			parsed.observations.map((item) => item.problem?.outcome),
			[undefined, undefined, "unmatched", "unmatched"],
		)
	})

	it("retains only source URL origin and path without query tokens or fragments", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes(
				envelope([
					{
						title: "Movie",
						mediaType: "movie",
						tmdbId: 42,
						sourceUrl:
							"https://example.test/title/42?token=secret#private-fragment",
					},
				]),
			),
		)
		assert.equal(
			parsed.observations[0].wishlistEvidence?.sourceUrl,
			"https://example.test/title/42",
		)
		assert.equal(JSON.stringify(parsed).includes("secret"), false)
		assert.equal(JSON.stringify(parsed).includes("private-fragment"), false)
	})

	it("accepts Watcharr unknown optional metadata as exported: empty IMDb and omitted release date", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes([
				{
					status: "PLANNED",
					content: { title: "Movie", type: "movie", tmdbId: 42, imdb_id: "" },
				},
			]),
		)
		assert.equal(parsed.observations[0].problem, undefined)
		assert.equal(parsed.observations[0].imdbId, null)
		assert.equal(parsed.observations[0].year, null)
	})
})

it("reads original bytes of an actual Watcharr backend export from a synthetic account", async () => {
	const fixture = readFileSync(
		new URL("./fixtures/watcharr-synthetic-export.json", import.meta.url),
	)
	const parsed = await parseImportFile("wishlist", fixture)
	assert.deepEqual(
		parsed.observations.map((item) => ({
			kind: item.kind,
			mediaType: item.mediaType,
			title: item.title,
			tmdbId: item.tmdbId,
			imdbId: item.imdbId,
			year: item.year,
			outcome: item.problem?.outcome,
		})),
		[
			{
				kind: "want",
				mediaType: "movie",
				title: "Synthetic planned movie",
				tmdbId: 862,
				imdbId: null,
				year: null,
				outcome: undefined,
			},
			{
				kind: "want",
				mediaType: "show",
				title: "Synthetic planned show",
				tmdbId: 1399,
				imdbId: null,
				year: null,
				outcome: undefined,
			},
			{
				kind: "watch",
				mediaType: "movie",
				title: "Synthetic finished movie",
				tmdbId: 13,
				imdbId: null,
				year: null,
				outcome: undefined,
			},
		],
	)
	assert.ok(
		parsed.observations.every(
			(item) =>
				item.addedAt === null &&
				(item.watchedAt === undefined || item.watchedAt === null) &&
				item.score === undefined,
		),
	)
	assert.deepEqual(
		parsed.observations.map((item) => item.wishlistEvidence?.sourceId),
		["1", "2", "3"],
	)
})

it("reads v1.1 source Seen evidence without making it a GoodWatch watch", async () => {
	const row = {
		title: "Movie",
		mediaType: "movie",
		tmdbId: 42,
		sourceSeen: true,
		sourceSeenAt: "2026-10-01",
	}
	const parsed = await parseImportFile(
		"wishlist",
		bytes(envelope([row], { version: 1.1 })),
	)
	const item = parsed.observations[0]
	assert.equal(item.problem, undefined)
	assert.equal(item.kind, "want")
	assert.equal(item.wishlistEvidence?.sourceSeen, true)
	assert.equal(item.wishlistEvidence?.sourceSeenAt, "2026-10-01")
	assert.deepEqual(
		item.wishlistOriginal?.wishlistEvidence,
		item.wishlistEvidence,
	)
	assert.equal(item.watchedAt, undefined)
	assert.equal(item.score, undefined)
	assert.equal(item.showStatus, undefined)
	const legacy = await parseImportFile("wishlist", bytes(envelope([row])))
	assert.equal(legacy.observations[0].wishlistEvidence?.sourceSeen, undefined)
	assert.equal(legacy.observations[0].wishlistEvidence?.sourceSeenAt, undefined)
})

it("rejects malformed v1.1 Seen evidence without interpreting a date as Seen", async () => {
	for (const fields of [
		{ sourceSeen: "true" },
		{ sourceSeen: null },
		{ sourceSeen: true, sourceSeenAt: "2026-02-30" },
		{ sourceSeenAt: "2026-10-01" },
		{ sourceSeen: false, sourceSeenAt: "2026-10-01" },
	]) {
		const parsed = await parseImportFile(
			"wishlist",
			bytes(
				envelope(
					[{ title: "Movie", mediaType: "movie", tmdbId: 42, ...fields }],
					{ version: 1.1 },
				),
			),
		)
		assert.equal(parsed.observations[0].problem?.outcome, "invalid")
		assert.equal(parsed.observations[0].wishlistOriginal, undefined)
	}
})

it("carries v1.1 season and episode rows as show identities with distinct original coordinates", async () => {
	const parsed = await parseImportFile(
		"wishlist",
		bytes(
			envelope(
				[
					{ title: "Show", mediaType: "season", tmdbId: 42, season: 2 },
					{
						title: "Show",
						mediaType: "episode",
						tmdbId: 42,
						season: 2,
						episode: 3,
					},
					{ title: "Show", mediaType: "season", tmdbId: 42, season: 3 },
				],
				{ version: 1.1 },
			),
		),
	)
	assert.deepEqual(
		parsed.observations.map((row) => [
			row.kind,
			row.mediaType,
			row.season,
			row.episode,
			row.problem,
		]),
		[
			["want", "show", 2, undefined, undefined],
			["want", "show", 2, 3, undefined],
			["want", "show", 3, undefined, undefined],
		],
	)
	assert.deepEqual(
		parsed.observations.map((row) => [
			row.wishlistOriginal?.mediaType,
			row.wishlistOriginal?.season,
			row.wishlistOriginal?.episode,
		]),
		[
			["season", 2, undefined],
			["episode", 2, 3],
			["season", 3, undefined],
		],
	)
	assert.equal(new Set(parsed.observations.map((row) => row.key)).size, 3)
	const legacy = await parseImportFile(
		"wishlist",
		bytes(
			envelope([{ title: "Show", mediaType: "season", season: 2, tmdbId: 42 }]),
		),
	)
	assert.equal(legacy.observations[0].problem?.outcome, "invalid")
})

it("requires valid v1.1 coordinates and rejects episode coordinates on other row types", async () => {
	for (const fields of [
		{ mediaType: "season" },
		{ mediaType: "season", season: -1 },
		{ mediaType: "season", season: 1.5 },
		{ mediaType: "season", season: "2" },
		{ mediaType: "season", season: 2, episode: 3 },
		{ mediaType: "episode", season: 2 },
		{ mediaType: "episode", season: 2, episode: 0 },
		{ mediaType: "episode", season: 2, episode: 1.5 },
		{ mediaType: "movie", season: 2 },
		{ mediaType: "show", episode: 3 },
		{ mediaType: "unknown", season: 1 },
		{ mediaType: "season", season: 1e20 },
	]) {
		const parsed = await parseImportFile(
			"wishlist",
			bytes(
				envelope([{ title: "Show", tmdbId: 42, ...fields }], { version: 1.1 }),
			),
		)
		assert.equal(
			parsed.observations[0].problem?.outcome,
			"invalid",
			JSON.stringify(fields),
		)
	}
	const special = await parseImportFile(
		"wishlist",
		bytes(
			envelope(
				[
					{
						title: "Show",
						mediaType: "episode",
						tmdbId: 42,
						season: 0,
						episode: 1,
					},
					{ title: "Movie", mediaType: "movie", tmdbId: 43, sourceSeen: false },
				],
				{ version: 1.1 },
			),
		),
	)
	assert.ok(special.observations.every((row) => !row.problem))
	assert.equal(special.observations[1].wishlistEvidence?.sourceSeen, false)
})

it("keeps malformed coordinates out of typed storage while retaining an invalid row", async () => {
	const parsed = await parseImportFile(
		"wishlist",
		bytes(
			envelope(
				[
					{
						title: "Show",
						mediaType: "episode",
						tmdbId: 42,
						season: "private-invalid-value",
						episode: {},
					},
				],
				{ version: 1.1 },
			),
		),
	)
	assert.equal(parsed.observations[0].problem?.outcome, "invalid")
	assert.equal(parsed.observations[0].season, null)
	assert.equal(parsed.observations[0].episode, null)
})

it("caps v1.1 season and episode coordinates at 10,000 while retaining oversized rows as invalid", async () => {
	const parsed = await parseImportFile(
		"wishlist",
		bytes(
			envelope(
				[
					{ title: "Show", mediaType: "season", tmdbId: 42, season: 10000 },
					{
						title: "Show",
						mediaType: "episode",
						tmdbId: 42,
						season: 10000,
						episode: 10000,
					},
					{ title: "Show", mediaType: "season", tmdbId: 42, season: 10001 },
					{
						title: "Show",
						mediaType: "episode",
						tmdbId: 42,
						season: 10001,
						episode: 1,
					},
					{
						title: "Show",
						mediaType: "episode",
						tmdbId: 42,
						season: 1,
						episode: 10001,
					},
				],
				{ version: 1.1 },
			),
		),
	)
	assert.deepEqual(
		parsed.observations.map((row) => row.problem?.outcome),
		[undefined, undefined, "invalid", "invalid", "invalid"],
	)
	assert.equal(parsed.observations[2].season, null)
	assert.equal(parsed.observations[3].season, null)
	assert.equal(parsed.observations[4].episode, null)
	assert.ok(
		parsed.observations
			.slice(2)
			.every((row) => row.wishlistOriginal === undefined),
	)
})

it("explains that a string version must be a number instead of calling it a newer layout", async () => {
	for (const version of ["1", "1.1", "2"]) {
		await assert.rejects(
			parseImportFile("wishlist", bytes(envelope([], { version }))),
			{
				name: "Error",
				message:
					"This wishlist file's version must be a number. Ask the maker of the tool that saved it for a file GoodWatch can read.",
			},
		)
	}
	await assert.rejects(
		parseImportFile("wishlist", bytes(envelope([], { version: 2 }))),
		/newer layout/,
	)
})

it("preserves Watcharr play identities and custom dates without adding a second snapshot watch", async () => {
	const fixture = readFileSync(
		new URL("./fixtures/watcharr-library-synthetic.json", import.meta.url),
	)
	const parsed = await parseImportFile("wishlist", fixture)
	const watches = parsed.observations.filter(
		(i) => i.kind === "watch" && i.tmdbId === 9002,
	)
	assert.equal(watches.length, 2)
	assert.notEqual(watches[0].key, watches[1].key)
	assert.deepEqual(
		watches.map((i) => [i.watchedAt, i.precision]),
		[
			["2020-05-04T20:30:00+02:00", "moment"],
			["2020-05-04T20:30:00+02:00", "moment"],
		],
	)
	const reordered = JSON.parse(fixture.toString()).reverse()
	for (const row of reordered) row.activity?.reverse()
	const again = await parseImportFile("wishlist", bytes(reordered))
	assert.deepEqual(
		again.observations
			.filter((i) => i.kind === "watch" && i.tmdbId === 9002)
			.map((i) => i.key)
			.sort(),
		watches.map((i) => i.key).sort(),
	)
})

it("reads finished Watcharr episodes and seasons, and their scores as season and episode scores without rating the whole show", async () => {
	const parsed = await parseImportFile(
		"wishlist",
		readFileSync(
			new URL("./fixtures/watcharr-library-synthetic.json", import.meta.url),
		),
	)
	const watches = parsed.observations.filter(
		(i) => i.kind === "watch" && i.tmdbId === 9005,
	)
	assert.deepEqual(
		watches.map((i) => [i.season, i.episode ?? null, i.watchedAt]),
		[
			[1, 1, "2021-03-04T09:00:00Z"],
			[1, 1, "2022-03-04T09:00:00Z"],
			[2, null, "2023-03-04T09:00:00Z"],
			[2, null, null],
			[1, 1, null],
			[1, 2, null],
		],
	)
	assert.ok(watches.every((i) => i.episodeNumbering === "tmdb"))
	const scores = parsed.observations.filter(
		(i) => i.tmdbId === 9005 && i.kind === "episode_rating",
	)
	assert.deepEqual(
		scores.map((i) => [
			i.scoreScope,
			i.mediaType,
			i.season,
			i.episode ?? null,
			i.episodeNumbering,
			i.score,
			i.problem,
		]),
		[
			["season", "show", 2, null, undefined, 7, undefined],
			["episode", "show", 1, 2, "tmdb", 9, undefined],
		],
	)
	assert.equal(
		parsed.observations.find((i) => i.tmdbId === 9005 && i.kind === "rating")
			?.score,
		1,
	)
})

it("retains malformed Watcharr history as invalid without dropping independent scores and reviews", async () => {
	const parsed = await parseImportFile(
		"wishlist",
		bytes([
			{
				id: 1,
				status: "WATCHING",
				rating: 7,
				thoughts: "Keep this review.",
				content: { type: "tv", tmdbId: 123, title: "Show" },
				activity: [
					{
						id: 1,
						type: "EPISODE_ADDED",
						data: "{broken",
						createdAt: "2024-01-01T00:00:00Z",
					},
					{
						id: 2,
						type: "EPISODE_ADDED",
						data: '{"status":"FINISHED","season":1,"episode":0}',
						customDate: "2024-02-30",
					},
				],
				watchedEpisodes: [
					{ seasonNumber: 1, episodeNumber: 1, status: "FINISHED", rating: 8 },
				],
			},
		]),
	)
	assert.equal(
		parsed.observations.filter((i) => i.problem?.outcome === "invalid").length,
		2,
	)
	assert.equal(parsed.observations.find((i) => i.kind === "rating")?.score, 7)
	assert.equal(
		parsed.observations.find((i) => i.kind === "review")?.review,
		"Keep this review.",
	)
	assert.equal(
		parsed.observations.find((i) => i.watcharrSnapshot)?.watchedAt,
		null,
	)
})

it("uses Watcharr's non-counted original import date, then the entry date, for counted Added activities", async () => {
	const rows = JSON.parse(
		readFileSync(
			new URL("./fixtures/watcharr-library-synthetic.json", import.meta.url),
			"utf8",
		),
	)
	const imported = rows.find((row: { id: number }) => row.id === 10)
	for (const [activity, expected] of [
		[imported.activity, "2017-06-05T22:30:00Z"],
		[[imported.activity[0]], "2018-07-08T12:00:00Z"],
	] as const) {
		const parsed = await parseImportFile(
			"wishlist",
			bytes([{ ...imported, activity }]),
		)
		const watches = parsed.observations.filter((i) => i.kind === "watch")
		assert.equal(watches.length, 1)
		assert.equal(watches[0].watchedAt, expected)
		assert.equal(watches[0].precision, "moment")
	}
})

it("reads legacy Watcharr plays without countAsPlay while avoiding Added/imported-date overlap", async () => {
	const row = {
		id: 1,
		status: "FINISHED",
		createdAt: "2018-01-01T00:00:00Z",
		content: { title: "Legacy movie", type: "movie", tmdbId: 42 },
		activity: [
			{
				id: 1,
				type: "ADDED_WATCHED",
				data: '{"status":"FINISHED","rating":0}',
				createdAt: "2026-01-01T00:00:00Z",
			},
			{
				id: 2,
				type: "IMPORTED_ADDED_WATCHED",
				customDate: "2017-01-01T00:00:00Z",
			},
			{
				id: 3,
				type: "IMPORTED_ADDED_WATCHED",
				customDate: "2019-01-01T00:00:00Z",
			},
			{
				id: 4,
				type: "STATUS_CHANGED",
				data: "FINISHED",
				createdAt: "2020-01-01T00:00:00Z",
			},
			{
				id: 5,
				type: "RATING_CHANGED",
				data: "9",
				createdAt: "2025-01-01T00:00:00Z",
			},
			{
				id: 6,
				type: "STATUS_CHANGED",
				data: "FINISHED",
				countAsPlay: false,
				createdAt: "2025-01-01T00:00:00Z",
			},
		],
	}
	const parsed = await parseImportFile("wishlist", bytes([row]))
	assert.deepEqual(
		parsed.observations
			.filter((i) => i.kind === "watch")
			.map((i) => i.watchedAt),
		["2017-01-01T00:00:00Z", "2019-01-01T00:00:00Z", "2020-01-01T00:00:00Z"],
	)
	const onlyAdded = await parseImportFile(
		"wishlist",
		bytes([{ ...row, activity: [row.activity[0]] }]),
	)
	assert.deepEqual(
		onlyAdded.observations
			.filter((i) => i.kind === "watch")
			.map((i) => i.watchedAt),
		["2018-01-01T00:00:00Z"],
	)
})

it("keeps Jellyfin import, Jellyfin webhook and Plex-created movie and episode history", async () => {
	for (const createdBy of [3, 4, 5]) {
		const parsed = await parseImportFile(
			"wishlist",
			bytes([
				{
					id: 1,
					status: "FINISHED",
					createdAt: "2018-01-01T00:00:00Z",
					content: { title: "Movie", type: "movie", tmdbId: 42 },
					activity: [
						{
							id: 1,
							type: "ADDED_WATCHED",
							data: '{"status":"FINISHED"}',
							countAsPlay: true,
							createdBy,
							createdAt: "2026-01-01T00:00:00Z",
						},
					],
				},
				{
					id: 2,
					status: "WATCHING",
					content: { title: "Show", type: "tv", tmdbId: 43 },
					activity: [
						{
							id: 2,
							type: "EPISODE_ADDED",
							data: '{"season":1,"episode":2,"status":"FINISHED"}',
							countAsPlay: false,
							createdBy,
							customDate: "2019-01-01T00:00:00Z",
						},
					],
				},
			]),
		)
		assert.deepEqual(
			parsed.observations
				.filter((i) => i.kind === "watch")
				.map((i) => [i.tmdbId, i.episode ?? null, i.watchedAt]),
			[
				[42, null, "2018-01-01T00:00:00Z"],
				[43, 2, "2019-01-01T00:00:00Z"],
			],
		)
	}
})

it("rounds decimal Watcharr season and episode scores like its title scores, and keeps off-scale ones invalid", async () => {
	const parsed = await parseImportFile(
		"wishlist",
		bytes([
			{
				id: 1,
				status: "WATCHING",
				content: { type: "tv", tmdbId: 123, title: "Show" },
				watchedSeasons: [
					{ seasonNumber: 1, status: "FINISHED", rating: 7.4 },
					{ seasonNumber: 2, status: "WATCHING", rating: 0.3 },
				],
				watchedEpisodes: [
					{ seasonNumber: 1, episodeNumber: 1, status: "FINISHED", rating: 11 },
				],
			},
		]),
	)
	assert.deepEqual(
		parsed.observations
			.filter((i) => i.kind === "episode_rating")
			.map((i) => [
				i.scoreScope,
				i.season,
				i.episode ?? null,
				i.score,
				i.problem?.outcome ?? null,
			]),
		[
			["season", 1, null, 7, null],
			["season", 2, null, 1, null],
			["episode", 1, 1, null, "invalid"],
		],
	)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/Decimal scores are rounded/,
	)
})

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

	it("imports only native Watcharr PLANNED movie and show entries, preserving other statuses as unsupported", async () => {
		const parsed = await parseImportFile(
			"wishlist",
			bytes([
				{
					id: 1,
					status: "PLANNED",
					rating: 8,
					createdAt: "2026-10-01T12:00:00Z",
					content: {
						title: "Movie",
						type: "movie",
						tmdbId: 42,
						release_date: "2024-02-29T00:00:00Z",
						imdb_id: "tt1234567",
					},
				},
				{
					id: 2,
					status: "PLANNED",
					content: { title: "Show", type: "tv", tmdbId: 43 },
				},
				...["FINISHED", "WATCHING", "HOLD", "DROPPED"].map((status) => ({
					status,
					content: { title: status, type: "movie", tmdbId: 44 },
				})),
				{ status: "PLANNED", game: { name: "Game", igdbId: 2 } },
				{
					status: "PLANNED",
					content: { title: "Episode", type: "tv_episode", tmdbId: 45 },
				},
			]),
		)
		assert.deepEqual(
			parsed.observations.map((item) => [
				item.kind,
				item.mediaType,
				item.problem?.outcome,
			]),
			[
				["want", "movie", undefined],
				["want", "show", undefined],
				...Array.from({ length: 6 }, () => [
					"unsupported",
					"movie",
					"unsupported",
				]),
			],
		)
		assert.equal(parsed.observations[0].year, 2024)
		assert.equal(parsed.observations[0].addedAt, null)
		assert.equal(parsed.observations[0].wishlistEvidence?.source, "watcharr")
		assert.equal(parsed.observations[0].wishlistEvidence?.sourceId, "1")
		assert.equal(
			parsed.observations.some(
				(item) =>
					item.kind === "watch" ||
					item.kind === "rating" ||
					item.kind === "show_status",
			),
			false,
		)
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
				kind: "unsupported",
				mediaType: "movie",
				title: "Synthetic finished movie",
				tmdbId: 13,
				imdbId: null,
				year: null,
				outcome: "unsupported",
			},
		],
	)
	assert.ok(
		parsed.observations.every(
			(item) =>
				item.addedAt === null &&
				item.watchedAt === undefined &&
				item.score === undefined,
		),
	)
	assert.deepEqual(
		parsed.observations.map((item) => item.wishlistEvidence?.sourceId),
		["1", "2", "3"],
	)
})

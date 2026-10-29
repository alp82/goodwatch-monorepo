import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
const { checkFactsManifest, encodeFacts, joinFactsChunks, SnapshotRefused } =
	await import("./format.server.ts")
const { loadFacts, readFactsChunks } = await import("./facts.server.ts")

// Exact bytes asserted by the Python publisher test, including odd N and slot columns.
const bytes = new Uint8Array([
	207, 7, 216, 7, 0, 0, 136, 0, 47, 0, 0, 0, 24, 246, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 157, 18, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 62, 0, 0, 0, 0, 2, 0,
	2, 1, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255,
])
function fixture() {
	return {
		format: 1,
		chunks: 1,
		sha256: createHash("sha256").update(bytes).digest("hex"),
		countries: ["AU", "DE", "US"],
	}
}

test("decodes publisher bytes, odd row count, missing facts and four country columns", () => {
	const c = joinFactsChunks(fixture(), 3, [bytes])
	assert.deepEqual([...c.releaseYears], [1999, 2008, 0])
	assert.deepEqual([...c.lengths], [136, 47, 0])
	assert.deepEqual([...c.budgets], [63000, 0, 0])
	assert.deepEqual([...c.boxOffice], [463517, 0, 0])
	assert.deepEqual([...c.seasons], [0, 5, 0])
	assert.deepEqual([...c.episodes], [0, 62, 0])
	assert.deepEqual([...c.showStatuses], [0, 2, 0])
	assert.deepEqual(
		[...c.countryIndexes],
		[2, 1, 255, 0, 255, 255, 255, 255, 255, 255, 255, 255],
	)
	assert.equal(c.sources, null)
	assert.deepEqual(c.countries, fixture().countries)
	// Every possible split, including chunks ending on or across the unaligned column.
	for (let split = 0; split <= bytes.length; split++)
		assert.deepEqual(
			joinFactsChunks({ ...fixture(), chunks: 2 }, 3, [
				bytes.subarray(0, split),
				bytes.subarray(split),
			]),
			c,
		)
})

test("rejects unknown formats, checksum, size, country tables and invalid values", () => {
	assert.throws(
		() => joinFactsChunks({ ...fixture(), format: 3 }, 3, [bytes]),
		/format/,
	)
	assert.throws(
		() => joinFactsChunks({ ...fixture(), sha256: "0".repeat(64) }, 3, [bytes]),
		/checksum/,
	)
	assert.throws(() => joinFactsChunks(fixture(), 4, [bytes]), /size/)
	assert.throws(() => joinFactsChunks(fixture(), 3, []), /chunk count/)
	for (const countries of [["US", "AU"], ["US", "US"], ["usa"], ["us"]])
		assert.throws(
			() => checkFactsManifest({ ...fixture(), countries }),
			SnapshotRefused,
		)
	for (const [offset, value] of [
		[45, 4],
		[36, 255],
		[48, 3],
	]) {
		const bad = bytes.slice()
		bad[offset] = value
		assert.throws(
			() =>
				joinFactsChunks(
					{
						...fixture(),
						sha256: createHash("sha256").update(bad).digest("hex"),
					},
					3,
					[bad],
				),
			SnapshotRefused,
		)
	}
})

test("sample encoder matches publisher layout and money units", () => {
	const encoded = encodeFacts({
		rows: [
			{
				pointId: 1e12 + 1,
				year: 1999,
				length: 136,
				budget: 63000000,
				boxOffice: 463517383,
				countries: ["us", "AU", "US"],
			},
			{
				pointId: 2e12 + 2,
				year: 2008,
				length: 47,
				seasons: 5,
				episodes: 62,
				status: 2,
				countries: ["DE"],
			},
			{ pointId: 2e12 + 3 },
		],
	})
	assert.deepEqual(encoded.chunks, [
		new Uint8Array([...bytes, ...new Array(15).fill(255)]),
	])
	assert.equal(encoded.manifest.format, 2)
	for (const [value, expected] of [
		[9999, 0],
		[10000, 10],
		[10999, 10],
		[Number.POSITIVE_INFINITY, 0],
		[Number.NaN, 0],
		[2 ** 60, 0xffffffff],
	]) {
		const sample = encodeFacts({
			rows: [{ pointId: 1e12 + 1, budget: value }],
		})
		assert.equal(
			joinFactsChunks(sample.manifest, 1, sample.chunks).budgets[0],
			expected,
		)
	}
})

test("retained storage grows by 25 bytes per title, with at most one alignment byte", () => {
	for (const count of [0, 1, 2, 10000, 10001]) {
		const sample = encodeFacts({
			rows: Array.from({ length: count }, (_, pointId) => ({ pointId })),
		})
		const columns = joinFactsChunks(sample.manifest, count, sample.chunks)
		const views = Object.values(columns).filter(ArrayBuffer.isView)
		assert.equal(views.length, 8)
		assert.equal(new Set(views.map((v) => v.buffer)).size, 1)
		assert.equal(views[0].buffer.byteLength, count * 25 + (count % 2))
	}
})

test("optional reads log once and return null on missing chunks, Redis failure, bad format or checksum", async (t) => {
	const errors = t.mock.method(console, "error", () => {})
	const manifest = {
		version: "test",
		count: 3,
		facts: fixture(),
	} as Parameters<typeof loadFacts>[1]
	const redis = { getBuffer: async () => bytes }
	assert.ok(await loadFacts(redis, manifest))
	assert.equal(await loadFacts(redis, { ...manifest, facts: undefined }), null)
	assert.equal(errors.mock.callCount(), 0)
	const cases = [
		() => loadFacts({ getBuffer: async () => null }, manifest),
		() =>
			loadFacts(
				{
					getBuffer: async () => {
						throw new Error("offline")
					},
				},
				manifest,
			),
		() =>
			loadFacts(redis, { ...manifest, facts: { ...fixture(), format: 999 } }),
		() =>
			loadFacts(redis, {
				...manifest,
				facts: { ...fixture(), sha256: "0".repeat(64) },
			}),
	]
	for (const run of cases) {
		const before = errors.mock.callCount()
		assert.equal(await run(), null)
		assert.equal(errors.mock.callCount(), before + 1)
	}
	const keys: string[] = []
	await readFactsChunks(
		{
			getBuffer: async (key) => {
				keys.push(key)
				return bytes
			},
		},
		manifest,
	)
	assert.deepEqual(keys, ["title-snapshot:test:facts:0"])
})

test("format 2 appends source columns and rejects invalid source bytes", () => {
	for (const count of [0, 1, 2, 3]) {
		const encoded = encodeFacts({
			rows: Array.from({ length: count }, (_, i) => ({
				pointId: 1e12 + i,
				sources: {
					imdb: 0,
					rtCritics: 70,
					rtAudience: 80,
					metacritic: 90,
					metacriticUsers: 100,
				},
			})),
		})
		const decoded = joinFactsChunks(encoded.manifest, count, encoded.chunks)
		assert.deepEqual([...decoded.sources!.imdb], new Array(count).fill(0))
		assert.deepEqual(
			[...decoded.sources!.metacriticUsers],
			new Array(count).fill(100),
		)
		if (!count) continue
		for (let split = 0; split <= encoded.chunks[0].length; split++)
			assert.deepEqual(
				joinFactsChunks({ ...encoded.manifest, chunks: 2 }, count, [
					encoded.chunks[0].subarray(0, split),
					encoded.chunks[0].subarray(split),
				]),
				decoded,
			)
		const bad = encoded.chunks[0].slice()
		bad[20 * count] = 101
		assert.throws(
			() =>
				joinFactsChunks(
					{
						...encoded.manifest,
						sha256: createHash("sha256").update(bad).digest("hex"),
					},
					count,
					[bad],
				),
			/source score/,
		)
	}
})

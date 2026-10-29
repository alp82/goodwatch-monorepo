// Preparation preserves snapshot queries and treats ratings failures as optional.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const {
	encodeSnapshot,
	encodeRatings,
	encodeFacts,
	joinChunks,
	joinRatingsChunks,
	SnapshotRefused,
} = await import("./format.server.ts")
const { buildSnapshot } = await import("./snapshot.server.ts")
const { prepareSnapshot } = await import("./prepare.server.ts")
const { VALID_FINGERPRINT_KEYS } = await import("../utils/fingerprint.ts")

function fixture() {
	const snapshot = encodeSnapshot({
		version: "test",
		builtAt: new Date("2026-01-01"),
		keyOrder: VALID_FINGERPRINT_KEYS,
		rows: [0, 1, 2].map((i) => ({
			pointId: 1e12 + i + 1,
			genres: ["comedy"],
			releaseDay: 19000,
			votes: 20000,
			popularity: 2,
			fingerprint: Array.from({ length: 74 }, (_, k) => (k + i) % 11),
			score: 80,
			origin: "US",
			hasPoster: true,
			hasBackdrop: false,
			adult: false,
			anime: false,
		})),
	})
	const ratings = encodeRatings({
		rows: [0, 1, 2].map((i) => ({
			pointId: 1e12 + i + 1,
			content: i,
			estimate: 12,
			ages: { DE: 12 },
		})),
		ladders: {
			DE: [
				{ age: 0, label: "0" },
				{ age: 12, label: "12" },
			],
		},
	})
	const facts = encodeFacts({
		rows: [0, 1, 2].map((i) => ({
			pointId: 1e12 + i + 1,
			year: 2000 + i,
			length: 120,
			countries: ["US"],
		})),
	})
	return { ...snapshot, ratings, facts }
}

test("prepared derivations give the same facts, moods, cosines, statistics and ratings", () => {
	const input = fixture()
	const result = prepareSnapshot(input)
	const prepared = buildSnapshot(
		input.manifest,
		result.columns,
		result.ratings,
		result.derived,
		result.facts,
	)
	const inline = buildSnapshot(
		input.manifest,
		joinChunks(input.manifest, input.chunks),
		joinRatingsChunks(
			input.ratings.manifest,
			input.manifest.count,
			input.ratings.chunks,
		),
		undefined,
		result.facts,
	)
	assert.deepStrictEqual(prepared.stats, inline.stats)
	assert.deepStrictEqual(prepared.referenceRows, inline.referenceRows)
	assert.deepStrictEqual(prepared.columns.moods, inline.columns.moods)
	assert.deepStrictEqual(prepared.columns.themes, inline.columns.themes)
	assert.deepStrictEqual(prepared.columns.styles, inline.columns.styles)
	const taste = new Float32Array(74).fill(1 / Math.sqrt(74))
	prepared.forEach((key) => {
		assert.deepStrictEqual(prepared.facts(key), inline.facts(key))
		assert.equal(prepared.cosine(key, taste), inline.cosine(key, taste))
		assert.deepStrictEqual(prepared.fingerprint(key), inline.fingerprint(key))
	})
	assert.deepStrictEqual(
		prepared.columns.ratings?.agesOf("DE"),
		inline.columns.ratings?.agesOf("DE"),
	)
	assert.deepStrictEqual(
		prepared.columns.ratings?.content,
		inline.columns.ratings?.content,
	)
	assert.deepStrictEqual(
		prepared.columns.ratings?.estimates,
		inline.columns.ratings?.estimates,
	)
	assert.equal(result.ratingsRefusal, null)
	assert.equal(result.factsRefusal, null)
	assert.equal(prepared.columns.facts, result.facts)
})

test("the snapshot derives each title's themes and styles beside its moods, by the rules' own thresholds", async () => {
	const { themeMaskOf, themesInMask, styleMaskOf, stylesInMask } = await import(
		"../../domain/themes-styles.ts"
	)
	const scored = (scores: Record<string, number>) =>
		VALID_FINGERPRINT_KEYS.map((key) => scores[key] ?? 0)
	const titles = [
		{
			genres: ["Animation"],
			fingerprint: scored({ warfare: 7, slow_burn: 8 }),
		},
		{ genres: ["Drama"], fingerprint: scored({ warfare: 6, slow_burn: 7 }) },
		{ genres: ["News"], fingerprint: scored({ crime: 9, mystery: 8 }) },
		// No title analysis: fewer than ten scores.
		{
			genres: ["Animation"],
			fingerprint: VALID_FINGERPRINT_KEYS.map((_, k) => (k < 5 ? 10 : 255)),
		},
	]
	const { manifest, chunks } = encodeSnapshot({
		version: "themes-styles",
		builtAt: new Date("2026-01-01"),
		keyOrder: VALID_FINGERPRINT_KEYS,
		rows: titles.map((title, i) => ({
			pointId: 1e12 + i + 1,
			releaseDay: 19000,
			votes: 20000,
			popularity: 2,
			score: 80,
			origin: "US",
			hasPoster: true,
			hasBackdrop: false,
			adult: false,
			anime: false,
			...title,
		})),
	})
	const prepared = prepareSnapshot({ manifest, chunks, ratings: null })
	const { columns } = buildSnapshot(
		manifest,
		prepared.columns,
		null,
		prepared.derived,
	)
	assert.deepEqual(
		Array.from(columns.themes, (mask) => themesInMask(mask)),
		[["war"], [], ["crime", "mystery"], []],
	)
	assert.deepEqual(
		Array.from(columns.styles, (mask) => stylesInMask(mask)),
		[["animated", "slow"], [], ["documentary"], []],
	)
	// The same masks the rules give a title's fingerprint and genres directly.
	titles.forEach((title, row) => {
		assert.equal(
			columns.themes[row],
			themeMaskOf(title.fingerprint, title.genres),
		)
		assert.equal(
			columns.styles[row],
			styleMaskOf(title.fingerprint, title.genres),
		)
	})
})

test("snapshot checksum refusal is fatal but ratings refusal still produces a snapshot", () => {
	const input = fixture()
	assert.throws(
		() =>
			prepareSnapshot({
				...input,
				manifest: { ...input.manifest, sha256: "0".repeat(64) },
			}),
		SnapshotRefused,
	)
	input.ratings.manifest.sha256 = "0".repeat(64)
	const result = prepareSnapshot(input)
	assert.equal(result.ratings, null)
	assert.ok(result.ratingsRefusal)
	assert.match(result.ratingsRefusal, /checksum/i)
	assert.equal(
		buildSnapshot(
			input.manifest,
			result.columns,
			result.ratings,
			result.derived,
		).count,
		3,
	)
})

test("source snapshot worker transfers the prepared result and reports refusals", async () => {
	const { Worker } = await import("node:worker_threads")
	const { snapshotTransferables } = await import("./prepare.server.ts")
	async function roundTrip(input: ReturnType<typeof fixture>) {
		const worker = new Worker(
			new URL("./title-snapshot.worker.ts", import.meta.url),
			{
				workerData: input,
				execArgv: [
					"--import",
					new URL("../title-filter/test-alias.ts", import.meta.url).href,
				],
			},
		)
		try {
			return await new Promise<{
				ok: boolean
				result: ReturnType<typeof prepareSnapshot>
				refused: boolean
				message: string
			}>((resolve, reject) => {
				worker.once("error", reject)
				worker.once("message", resolve)
				worker.once("exit", (code) =>
					reject(new Error(`Worker exited before result: ${code}`)),
				)
			})
		} finally {
			await worker.terminate()
			assert.equal(worker.threadId, -1)
		}
	}
	const input = fixture()
	const result = await roundTrip(input)
	assert.equal(result.ok, true)
	assert.deepStrictEqual(result.result, prepareSnapshot(input))
	const buffers = snapshotTransferables(result.result)
	assert.equal(new Set(buffers).size, buffers.length)
	assert.equal(
		result.result.columns.pointIds.buffer,
		result.result.columns.fingerprints.buffer,
	)
	input.manifest.sha256 = "0".repeat(64)
	const refused = await roundTrip(input)
	assert.equal(refused.ok, false)
	assert.equal(refused.refused, true)
})

test("snapshots without facts or with refused facts load with null facts and unchanged queries", () => {
	const input = fixture()
	for (const facts of [
		null,
		{ ...input.facts, manifest: { ...input.facts.manifest, format: 999 } },
		{
			...input.facts,
			manifest: { ...input.facts.manifest, sha256: "0".repeat(64) },
		},
	]) {
		const result = prepareSnapshot({ ...input, facts })
		assert.equal(result.facts, null)
		if (facts) {
			assert.ok(result.factsRefusal)
			assert.match(result.factsRefusal, /format|checksum/)
		} else assert.equal(result.factsRefusal, null)
		const snapshot = buildSnapshot(
			input.manifest,
			result.columns,
			result.ratings,
			result.derived,
			result.facts,
		)
		assert.equal(snapshot.columns.facts, null)
		assert.equal(snapshot.count, 3)
		assert.deepEqual(
			snapshot.factsAt(0),
			buildSnapshot(input.manifest, result.columns).factsAt(0),
		)
	}
})

test("production worker input preserves multiple facts chunks and leaves source buffers attached", async () => {
	const { mkdtemp, writeFile, rm } = await import("node:fs/promises")
	const { tmpdir } = await import("node:os")
	const { join } = await import("node:path")
	const { pathToFileURL } = await import("node:url")
	const { prepareInWorker } = await import("./prepare-worker.server.ts")
	const dir = await mkdtemp(join(tmpdir(), "title-snapshot-worker-"))
	try {
		const entry = join(dir, "worker.mjs")
		await writeFile(
			entry,
			`import ${JSON.stringify(new URL("../title-filter/test-alias.ts", import.meta.url).href)};
` +
				`await import(${JSON.stringify(new URL("./title-snapshot.worker.ts", import.meta.url).href)});
`,
		)
		const input = fixture()
		const source = input.facts.chunks[0]
		input.facts.manifest.chunks = 2
		input.facts.chunks = [source.subarray(0, 40), source.subarray(40)]
		const result = await prepareInWorker(input, pathToFileURL(entry))
		assert.deepEqual(result, prepareSnapshot(input))
		assert.equal(result.factsRefusal, null)
		assert.equal(source.byteLength, 60)
		assert.ok(result.facts)
		assert.equal(result.facts.releaseYears.buffer, result.facts.episodes.buffer)
	} finally {
		await rm(dir, { recursive: true, force: true })
	}
})

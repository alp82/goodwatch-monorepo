// Preparation preserves snapshot queries and treats ratings failures as optional.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

const {
	encodeSnapshot,
	encodeRatings,
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
	return { ...snapshot, ratings }
}

test("prepared derivations give the same facts, moods, cosines, statistics and ratings", () => {
	const input = fixture()
	const result = prepareSnapshot(input)
	const prepared = buildSnapshot(
		input.manifest,
		result.columns,
		result.ratings,
		result.derived,
	)
	const inline = buildSnapshot(
		input.manifest,
		joinChunks(input.manifest, input.chunks),
		joinRatingsChunks(
			input.ratings.manifest,
			input.manifest.count,
			input.ratings.chunks,
		),
	)
	assert.deepStrictEqual(prepared.stats, inline.stats)
	assert.deepStrictEqual(prepared.referenceRows, inline.referenceRows)
	assert.deepStrictEqual(prepared.columns.moods, inline.columns.moods)
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
	assert.match(result.ratingsRefusal!, /checksum/i)
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
					reject(new Error("Worker exited before result: " + code)),
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

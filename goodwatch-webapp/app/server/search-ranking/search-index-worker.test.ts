// The source worker uses the same Crate HTTP contract and assembly as the bundled worker.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import http from "node:http"
import { test } from "node:test"
import type { Worker } from "node:worker_threads"
import { gzipSync } from "node:zlib"
import {
	BlobMissing,
	loadBuild,
	readManifest,
} from "./search-index-build.server.ts"
import { loadIndexBuild, type Manifest } from "./search-index.server.ts"

test("worker matches inline loading and terminates after success and missing blobs", async (t) => {
	const float = {
		shape: [1, 2],
		float32: Buffer.from(new Float32Array([1, 2]).buffer).toString("base64"),
	}
	const quantized = {
		scale: float,
		values: { shape: [1, 2], int8: Buffer.from([1, 2]).toString("base64") },
	}
	const docs = {
		title_table: {
			point_ids: [10],
			titles: ["A"],
			original_titles: ["AA"],
			years: [2000],
			votes: [10000],
			goodwatch_scores: [null],
			popularity: [2],
			imdb_ids: [null],
			flag_names: ["anime"],
			flags: [0],
			production_methods: [null],
		},
		term_statistics: { n: 1, terms: ["a"], ids: [1], df: [1] },
		word_frequencies: { words: ["abc"], df: [1], spell_vocabulary: ["abc"] },
		collocations: { bigrams: ["a b"] },
		name_index: {
			keys: ["a name"],
			entity: [0],
			entities: [
				{
					id: "p:1",
					kind: "person",
					name: "A Name",
					members: ["p:1"],
					mass: 1,
					titles: [[10, 1]],
					codirected: [10],
					mention: ["a"],
				},
			],
		},
		peers: { members: ["p:1"], fingerprints: float, titles: [[10]] },
		negation_labels: { titles: [[10]], stems: [["fun"]] },
		alternate_cuts: { pairs: [[10, 20]] },
		intent_examples: { labels: ["fun"], vectors: float },
		mix_vectors: {
			point_ids: [10],
			text_multi_v1: quantized,
			text_en_v1: quantized,
		},
	}
	const manifest: Manifest = {
		format: 1,
		build_id: "test",
		created_at: "2026-01-01",
		previous_build_id: null,
		files: {},
		profiles: { collection: "test", points: 1 },
	}
	const blobs = new Map<string, Buffer>()
	for (const [name, doc] of Object.entries(docs)) {
		const blob = gzipSync(JSON.stringify(doc))
		const sha1 = createHash("sha1").update(blob).digest("hex")
		manifest.files[name] = { sha1, bytes: blob.length }
		blobs.set(sha1, blob)
	}
	let missing = false
	const server = http.createServer((req, res) => {
		if (req.method === "POST" && req.url === "/_sql") {
			res.end(JSON.stringify({ rows: [[manifest]] }))
			return
		}
		const blob = blobs.get(req.url?.split("/").pop() ?? "")
		res.statusCode = missing || !blob ? 404 : 200
		res.end(missing ? "" : blob)
	})
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject)
		server.listen(0, "127.0.0.1", resolve)
	})
	t.after(() => {
		server.closeAllConnections()
		server.close()
	})
	const previous = {
		host: process.env.CRATE_HOSTS,
		port: process.env.CRATE_PORT,
	}
	t.after(() => {
		for (const [key, value] of [
			["CRATE_HOSTS", previous.host],
			["CRATE_PORT", previous.port],
		]) {
			if (value === undefined) delete process.env[key!]
			else process.env[key!] = value
		}
	})
	process.env.CRATE_HOSTS = "127.0.0.1"
	process.env.CRATE_PORT = String((server.address() as { port: number }).port)
	const workers: Worker[] = []
	const track = (worker: Worker) => workers.push(worker)
	process.on("worker", track)
	t.after(() => process.off("worker", track))
	const source = new URL("./search-index.worker.ts", import.meta.url)
	const fromManifest = await readManifest()
	const expected = await loadBuild(fromManifest)
	const actual = await loadIndexBuild(fromManifest, source)
	const comparable = ({ loadedAt, timings, ...index }: typeof expected) => index
	assert.deepStrictEqual(comparable(actual), comparable(expected))
	missing = true
	await assert.rejects(loadIndexBuild(fromManifest, source), BlobMissing)
	assert.equal(workers.length, 2)
	for (const worker of workers) assert.equal(worker.threadId, -1)
})

test("source worker build failures reject and leave no worker running", async () => {
	const workers: Worker[] = []
	const track = (worker: Worker) => workers.push(worker)
	process.on("worker", track)
	try {
		await assert.rejects(
			loadIndexBuild(
				{
					format: 1,
					build_id: "incomplete",
					created_at: "2026-01-01",
					previous_build_id: null,
					files: {},
					profiles: { collection: "test", points: 0 },
				},
				new URL("./search-index.worker.ts", import.meta.url),
			),
			/lacks title_table/,
		)
		assert.equal(workers.length, 1)
		assert.equal(workers[0].threadId, -1)
	} finally {
		process.off("worker", track)
	}
})

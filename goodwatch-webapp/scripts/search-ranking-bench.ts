// Measures the search ranking's query encoder and Qdrant client on the machine it runs on.
//
//   node scripts/search-ranking-bench.ts --trace=<dir> [--parts=encoder,qdrant]
//     [--passes=2] [--collection=media_fingerprint_v1]
//
// <dir> holds trace.jsonl and vectors.json from the ranking benchmark's store access trace (168 graded queries, the
// texts each query encodes and the reference vectors from Python). See docs/implementation/search-ranking/README.md.
//
// encoder: model download and load time, memory, parity with the reference vectors, and latency per search, one
//          search at a time and four at a time.
// qdrant:  read-only /points/query/batch requests built from each query's vectors, at three response sizes, through
//          this client (node:http) and through fetch (undici), to show whether the 40 ms stall appears.
// Prints one JSON object. Qdrant settings come from QDRANT_URL and QDRANT_API_KEY, as in the webapp.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { queryBatch } from "../app/server/search-ranking/qdrant-http.server.ts"
import {
	encodeQueryTexts,
	startQueryEncoder,
	stopQueryEncoder,
} from "../app/server/search-ranking/query-encoder.server.ts"

const arg = (name: string, fallback: string) =>
	process.argv
		.find((a) => a.startsWith(`--${name}=`))
		?.slice(name.length + 3) ?? fallback
const TRACE = arg("trace", "")
const PARTS = arg("parts", "encoder,qdrant").split(",")
const PASSES = Number(arg("passes", "2"))
const COLLECTION = arg("collection", "media_fingerprint_v1")
if (!TRACE) throw new Error("--trace=<dir> is required")

type Model = "english" | "multilingual"
const MODEL_OF: Record<string, Model> = {
	"bgeb-notitle": "english",
	me5s: "multilingual",
}
interface TraceQuery {
	id: string
	query: string
	encodes: { id: string; model: string; text: string; repeat?: boolean }[]
}
const queries = readFileSync(join(TRACE, "trace.jsonl"), "utf8")
	.split("\n")
	.filter(Boolean)
	.map((line) => JSON.parse(line) as TraceQuery)
const reference = JSON.parse(
	readFileSync(join(TRACE, "vectors.json"), "utf8"),
) as Record<string, Record<string, string>>
const decode = (b64: string) => {
	const bytes = Buffer.from(b64, "base64")
	return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4)
}

// One request per query: the unique texts per model, and which reference vector each one should match.
const requests = queries
	.map((q) => {
		const texts: Record<Model, string[]> = { english: [], multilingual: [] }
		const refs: Record<Model, Float32Array[]> = {
			english: [],
			multilingual: [],
		}
		for (const e of q.encodes) {
			const model = MODEL_OF[e.model]
			if (!model || e.repeat || texts[model].includes(e.text)) continue
			texts[model].push(e.text)
			refs[model].push(decode(reference[q.id][e.id]))
		}
		return { id: q.id, texts, refs }
	})
	.filter((r) => r.texts.english.length + r.texts.multilingual.length > 0)

const round = (x: number) => Math.round(x * 100) / 100
const pct = (xs: number[], p: number) => {
	const s = [...xs].sort((a, b) => a - b)
	return round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))])
}
const stats = (xs: number[]) => ({
	n: xs.length,
	p50: pct(xs, 50),
	p95: pct(xs, 95),
	max: pct(xs, 100),
	mean: round(xs.reduce((a, b) => a + b, 0) / xs.length),
})
const mb = (bytes: number) => Math.round(bytes / 2 ** 20)
const cosine = (a: Float32Array, b: Float32Array) => {
	let dot = 0
	let na = 0
	let nb = 0
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	return dot / Math.sqrt(na * nb)
}

async function runAll<T>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<void>,
) {
	let next = 0
	const started = performance.now()
	await Promise.all(
		Array.from({ length: concurrency }, async () => {
			while (next < items.length) await fn(items[next++])
		}),
	)
	return (performance.now() - started) / 1000
}

const out: Record<string, unknown> = {
	node: process.version,
	cpus: (await import("node:os")).availableParallelism(),
	requests: requests.length,
}

// Vectors per query, for the Qdrant part (the encoder's own output when it ran, else the reference).
const vectorsOf = new Map<string, Record<Model, Float32Array[]>>()

if (PARTS.includes("encoder")) {
	const rssBase = process.memoryUsage().rss
	const startup = await startQueryEncoder()
	const rssLoaded = process.memoryUsage().rss
	let worstCosine = 1
	const cpuStart = process.cpuUsage()
	const runs: Record<string, unknown> = {}
	let peakRss = rssLoaded
	for (const concurrency of [1, 4]) {
		const total: number[] = []
		const queued: number[] = []
		const english: number[] = []
		const multilingual: number[] = []
		let seconds = 0
		for (let pass = 0; pass < PASSES; pass++) {
			seconds += await runAll(requests, concurrency, async (r) => {
				const v = await encodeQueryTexts(r.texts)
				total.push(v.timings.totalMs)
				queued.push(v.timings.queuedMs)
				if (v.timings.encodeMs.english !== undefined)
					english.push(v.timings.encodeMs.english)
				if (v.timings.encodeMs.multilingual !== undefined)
					multilingual.push(v.timings.encodeMs.multilingual)
				for (const model of ["english", "multilingual"] as Model[]) {
					v[model].forEach((vec, i) => {
						worstCosine = Math.min(worstCosine, cosine(vec, r.refs[model][i]))
					})
				}
				vectorsOf.set(r.id, {
					english: v.english,
					multilingual: v.multilingual,
				})
				peakRss = Math.max(peakRss, process.memoryUsage().rss)
			})
		}
		runs[`concurrency_${concurrency}`] = {
			searches_per_s: round(total.length / seconds),
			total_ms: stats(total),
			queued_ms: stats(queued),
			english_ms: stats(english),
			multilingual_ms: stats(multilingual),
		}
	}
	const cpu = process.cpuUsage(cpuStart)
	out.encoder = {
		startup,
		rss_mb: {
			before: mb(rssBase),
			loaded: mb(rssLoaded),
			peak: mb(peakRss),
			models: mb(peakRss - rssBase),
		},
		cpu_seconds: round((cpu.user + cpu.system) / 1e6),
		texts_per_search: stats(
			requests.map((r) => r.texts.english.length + r.texts.multilingual.length),
		),
		worst_cosine_vs_reference: worstCosine,
		runs,
	}
	await stopQueryEncoder()
}

if (PARTS.includes("qdrant")) {
	for (const r of requests)
		if (!vectorsOf.has(r.id)) vectorsOf.set(r.id, r.refs)
	const filter = {
		must: [
			{ key: "goodwatch_overall_score_voting_count", range: { gte: 2000 } },
		],
		must_not: [{ key: "adult", match: { value: true } }],
	}
	const batchFor = (id: string, limit: number) => {
		const v = vectorsOf.get(id) as Record<Model, Float32Array[]>
		return [
			...v.english.map((vec) => ({
				query: Array.from(vec),
				using: "text_en_v1",
				filter,
				limit,
			})),
			...v.multilingual.map((vec) => ({
				query: Array.from(vec),
				using: "text_multi_v1",
				filter,
				limit,
			})),
		]
	}
	const base = new URL(process.env.QDRANT_URL || "http://localhost:6333")
	if (base.port === "6334") base.port = "6333"
	const url = `${base.origin}/collections/${COLLECTION}/points/query/batch`
	const headers: Record<string, string> = { "Content-Type": "application/json" }
	if (process.env.QDRANT_API_KEY)
		headers["api-key"] = process.env.QDRANT_API_KEY
	const viaFetch = async (searches: unknown[]) => {
		const started = performance.now()
		const response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify({ searches }),
		})
		const text = await response.text()
		if (!response.ok)
			throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`)
		const parsed = JSON.parse(text) as {
			time: number
			result: { points: unknown[] }[]
		}
		return {
			wallMs: performance.now() - started,
			serverMs: parsed.time * 1000,
			responseBytes: text.length,
		}
	}
	const viaHttp = async (searches: unknown[]) => {
		const r = await queryBatch(
			COLLECTION,
			searches as Record<string, unknown>[],
		)
		if (r.results.length !== searches.length) throw new Error("missing results")
		return r
	}
	const results: Record<string, unknown> = {}
	for (const limit of [20, 100, 500]) {
		for (const [client, send] of [
			["node_http", viaHttp],
			["fetch", viaFetch],
		] as const) {
			const wall: number[] = []
			const overhead: number[] = []
			const bytes: number[] = []
			await runAll(requests.slice(0, 20), 1, async (r) => {
				await send(batchFor(r.id, limit)) // warm-up
			})
			for (let pass = 0; pass < PASSES; pass++) {
				await runAll(requests, 1, async (r) => {
					const m = await send(batchFor(r.id, limit))
					wall.push(m.wallMs)
					overhead.push(m.wallMs - m.serverMs)
					bytes.push(m.responseBytes)
				})
			}
			results[`limit_${limit}_${client}`] = {
				wall_ms: stats(wall),
				wall_minus_server_ms: stats(overhead),
				stalls_over_30ms: overhead.filter((x) => x > 30).length,
				response_kb: stats(bytes.map((b) => b / 1024)),
			}
		}
	}
	out.qdrant = results
}

console.log(JSON.stringify(out, null, 1))

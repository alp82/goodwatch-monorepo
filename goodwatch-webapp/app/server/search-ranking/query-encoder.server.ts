// Encodes search query texts with the two local query models (see query-models.server.ts) in worker threads.
//
// Nothing starts on import. The first call to startQueryEncoder() or encodeQueryTexts() downloads the model files if
// needed and starts the worker, which loads both models (about 1.35 GB) and warms them up.
//
// Per search, send one request with each model's texts. rank-search.server.ts sends the query's texts (the query or
// residual, facet phrases, coverage units, negated clauses) to the query's main model, bge-base for English and
// multilingual-e5-small otherwise, as the ranker was tuned. The intent text always goes to multilingual-e5-small, a
// non-English query's English chips to bge-base. Dozens of phrases through bge-base would cost over 100 ms, so keep
// the lists short.
import { createHash } from "node:crypto"
import { Worker } from "node:worker_threads"
import { runsSearch } from "../role.server.ts"
import { encoderThreads, encoderWorkers, encoderSpinning } from "../search-runtime/limits.server.ts"
import { onShutdown } from "~/server/lifecycle.server"
import { separateEntryUrl } from "~/server/separate-entry.server"
import {
	type LocalQueryModels,
	type QueryModelName,
	ensureQueryModelFiles,
} from "./query-models.server.ts"

// More requests than this waiting in the queue means the encoder can't keep up. Reject instead of queueing more.
const MAX_PENDING = 32
// After a failed start (download or load), wait this long before trying again instead of retrying on every search.
const RETRY_AFTER_MS = 5 * 60_000

export type QueryTexts = Partial<Record<QueryModelName, string[]>>

export interface QueryVectors {
	english: Float32Array[]
	multilingual: Float32Array[]
	timings: {
		/** From the call until the worker returned the vectors. */
		totalMs: number
		/** Time the request waited in the worker's queue behind earlier searches. */
		queuedMs: number
		encodeMs: Partial<Record<QueryModelName, number>>
		/** The vectors came from the cache of recent requests. */
		cached?: boolean
	}
}

export interface QueryEncoderStartup {
	threads: number
	workers: number
	/** Download and checksum time for the model files; near zero when they are cached. */
	filesMs: number
	loadMs: Record<QueryModelName, number>
	warmMs: number
	totalMs: number
}

type WorkerMessage =
	| {
			type: "ready"
			loadMs: Record<QueryModelName, number>
			warmMs: number
			totalMs: number
	  }
	| { type: "fatal"; message: string }
	| {
			type: "result"
			id: number
			vectors: Partial<Record<QueryModelName, Float32Array>>
			queuedMs: number
			encodeMs: Partial<Record<QueryModelName, number>>
	  }
	| { type: "error"; id: number; message: string }

interface Pending {
	worker: Worker
	started: number
	counts: Record<QueryModelName, number>
	dims: Record<QueryModelName, number>
	resolve: (vectors: QueryVectors) => void
	reject: (error: Error) => void
}

interface RunningEncoder {
	workers: Worker[]
	stop: (error: Error) => Promise<void>
	models: LocalQueryModels
	startup: QueryEncoderStartup
}

let running: Promise<RunningEncoder> | undefined
let generation = 0
let failedAt = 0
let lastFailure: Error | undefined
let nextId = 1
const pending = new Map<number, Pending>()

function failAll(error: Error) {
	for (const request of pending.values()) request.reject(error)
	pending.clear()
}

function workerUrl() {
	// In the build, vite.config.js copies the worker next to build/server/index.js.
	return separateEntryUrl("query-encoder.worker.js", import.meta.url)
}

async function start(startGeneration: number): Promise<RunningEncoder> {
	const started = performance.now()
	const models = await ensureQueryModelFiles()
	const filesMs = performance.now() - started
	const threads = encoderThreads()
	const workers: Worker[] = []
	let stopped = false
	const stop = async (error: Error) => {
		if (stopped) return
		stopped = true
		if (startGeneration === generation) {
			running = undefined
			loaded = false
			failAll(error)
		}
		await Promise.all(workers.map((worker) => worker.terminate()))
	}
	const startWorker = async () => {
		const worker = new Worker(workerUrl(), {
			workerData: { models, threads, spinning: encoderSpinning() },
			name: "query-encoder",
		})
		workers.push(worker)
		// Remove only these listeners afterwards: Worker.removeAllListeners() also stops message delivery.
		let onStartupMessage: (message: WorkerMessage) => void = () => {}
		let onStartupError: (error: Error) => void = () => {}
		let onStartupExit: (code: number) => void = () => {}
		const ready = await new Promise<Extract<WorkerMessage, { type: "ready" }>>(
			(resolve, reject) => {
				onStartupMessage = (message) => {
					if (message.type === "ready") resolve(message)
					if (message.type === "fatal")
						reject(new Error(`Query encoder failed to load: ${message.message}`))
				}
				onStartupError = reject
				onStartupExit = (code) =>
					reject(
						new Error(`Query encoder exited during startup with code ${code}`),
					)
				worker.on("message", onStartupMessage)
				worker.on("error", onStartupError)
				worker.on("exit", onStartupExit)
			},
		)
			.catch(async (error) => {
				await worker.terminate()
				throw error
			})
			.finally(() => {
				worker.off("message", onStartupMessage)
				worker.off("error", onStartupError)
				worker.off("exit", onStartupExit)
			})
		worker.on("message", (message: WorkerMessage) => {
			if (message.type !== "result" && message.type !== "error") return
			const request = pending.get(message.id)
			if (!request) return
			pending.delete(message.id)
			if (message.type === "error") {
				request.reject(new Error(`Query encoding failed: ${message.message}`))
				return
			}
			const unpack = (name: QueryModelName) => {
				const packed = message.vectors[name]
				const dim = request.dims[name]
				return Array.from({ length: request.counts[name] }, (_, i) =>
					(packed as Float32Array).subarray(i * dim, (i + 1) * dim),
				)
			}
			request.resolve({
				english: unpack("english"),
				multilingual: unpack("multilingual"),
				timings: {
					totalMs: performance.now() - request.started,
					queuedMs: message.queuedMs,
					encodeMs: message.encodeMs,
				},
			})
		})
		worker.on("error", (error) => { void stop(error) })
		worker.on("exit", (code) => {
			void stop(new Error(`Query encoder worker exited with code ${code}`))
		})
		return ready
	}
	try {
		const ready = await Promise.all(Array.from({ length: encoderWorkers() }, startWorker))
		if (stopped) throw new Error("Query encoder exited during startup")
		onShutdown("query encoder", () => stop(new Error("Query encoder stopped")))
		return {
			workers,
			stop,
			models,
			startup: {
				threads,
				workers: workers.length,
				filesMs,
				loadMs: {
					english: Math.max(...ready.map((worker) => worker.loadMs.english)),
					multilingual: Math.max(...ready.map((worker) => worker.loadMs.multilingual)),
				},
				warmMs: Math.max(...ready.map((worker) => worker.warmMs)),
				totalMs: performance.now() - started,
			},
		}
	} catch (error) {
		await stop(error instanceof Error ? error : new Error(String(error)))
		throw error
	}
}

function ensureRunning(): Promise<RunningEncoder> {
	if (!runsSearch()) return Promise.reject(new Error("Search is disabled for the page role"))
	if (running) return running
	if (lastFailure && Date.now() - failedAt < RETRY_AFTER_MS) {
		return Promise.reject(lastFailure)
	}
	const startGeneration = ++generation
	const current = start(startGeneration)
	running = current
	current.then(
		() => {
			if (running !== current) return
			lastFailure = undefined
			loaded = true
		},
		(error: Error) => {
			if (generation !== startGeneration) return
			running = undefined
			failedAt = Date.now()
			lastFailure = error
			console.error("Query encoder failed to start", error)
		},
	)
	return current
}

let loaded = false

/** Whether the models are loaded, and how many requests wait. The basic search serves while it isn't ready or busy. */
export function queryEncoderState(): {
	ready: boolean
	pending: number
	maxPending: number
} {
	return { ready: loaded, pending: pending.size, maxPending: MAX_PENDING }
}

/** Starts loading the models in the background, so the first search doesn't wait for it. */
export async function startQueryEncoder(): Promise<QueryEncoderStartup> {
	return (await ensureRunning()).startup
}

// Recent requests' vectors, so a repeated search (a filter change, a page reload) skips the encoder. The key is a
// digest of the whole request: a batch's vectors can differ from each text encoded alone in the last float bits, so
// only an identical request reuses them. Search text is private: entries stay in this process, keyed by a digest.
// Up to about 20 KB per entry (a few texts, 768 floats each for bge-base).
const CACHE_ENTRIES = 500
const vectorCache = new Map<
	string,
	Pick<QueryVectors, "english" | "multilingual">
>()

function requestKey(texts: QueryTexts): string {
	return createHash("sha256")
		.update(
			JSON.stringify([texts.english ?? [], texts.multilingual ?? []]),
		)
		.digest("hex")
}

/**
 * Encodes one search's texts: one batch per model. Returns the vectors in the order of the texts. A request identical
 * to a recent one returns that request's vectors without encoding (timings.cached). Treat the vectors as read-only:
 * they may be shared with other searches.
 */
export async function encodeQueryTexts(
	texts: QueryTexts,
): Promise<QueryVectors> {
	const started = performance.now()
	const key = requestKey(texts)
	const hit = process.env.GW_BENCH_NO_VECTOR_CACHE === "1" ? undefined : vectorCache.get(key)
	if (hit) {
		// Refresh recency so eviction drops the least recently used entry.
		vectorCache.delete(key)
		vectorCache.set(key, hit)
		return {
			...hit,
			timings: {
				totalMs: performance.now() - started,
				queuedMs: 0,
				encodeMs: {},
				cached: true,
			},
		}
	}
	const vectors = await encodeUncached(texts)
	vectorCache.set(key, {
		english: vectors.english,
		multilingual: vectors.multilingual,
	})
	while (vectorCache.size > CACHE_ENTRIES)
		vectorCache.delete(vectorCache.keys().next().value as string)
	return vectors
}

async function encodeUncached(texts: QueryTexts): Promise<QueryVectors> {
	const encoder = await ensureRunning()
	if (pending.size >= MAX_PENDING) {
		throw new Error(
			`Query encoder is busy: ${pending.size} requests are waiting`,
		)
	}
	const counts = {
		english: texts.english?.length ?? 0,
		multilingual: texts.multilingual?.length ?? 0,
	}
	const dims = {
		english: encoder.models.english.spec.dim,
		multilingual: encoder.models.multilingual.spec.dim,
	}
	const countsByWorker = new Map(encoder.workers.map((worker) => [worker, 0]))
	for (const request of pending.values()) {
		countsByWorker.set(request.worker, (countsByWorker.get(request.worker) ?? 0) + 1)
	}
	const worker = encoder.workers.reduce((best, candidate) =>
		countsByWorker.get(candidate)! < countsByWorker.get(best)! ? candidate : best,
	)
	const id = nextId++
	return new Promise<QueryVectors>((resolve, reject) => {
		pending.set(id, {
			worker,
			started: performance.now(),
			counts,
			dims,
			resolve,
			reject,
		})
		try {
			worker.postMessage({ id, texts })
		} catch (error) {
			pending.delete(id)
			reject(error)
		}
	})
}

/** Stops the worker and frees the models. The next call starts them again. */
export async function stopQueryEncoder(): Promise<void> {
	const current = running
	if (!current) return
	const encoder = await current.catch(() => undefined)
	if (encoder) await encoder.stop(new Error("Query encoder stopped"))
}

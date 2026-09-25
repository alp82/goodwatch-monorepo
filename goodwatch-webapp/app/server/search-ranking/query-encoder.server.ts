// Encodes search query texts with the two local query models (see query-models.server.ts) in one worker thread.
//
// Nothing starts on import. The first call to startQueryEncoder() or encodeQueryTexts() downloads the model files if
// needed and starts the worker, which loads both models (about 1.35 GB) and warms them up. Both calls throw while
// SEARCH_RANKING_MODE is off.
//
// Per search, send one request with each model's texts. rank-search.server.ts sends the query's texts (the query or
// residual, facet phrases, coverage units, negated clauses) to the query's main model, bge-base for English and
// multilingual-e5-small otherwise, as the ranker was tuned. The intent text always goes to multilingual-e5-small, a
// non-English query's English chips to bge-base. Dozens of phrases through bge-base would cost over 100 ms, so keep
// the lists short.
import { Worker } from "node:worker_threads"
import { assertSearchRankingEnabled } from "./mode.server.ts"
import {
	type LocalQueryModels,
	type QueryModelName,
	ensureQueryModelFiles,
} from "./query-models.server.ts"

const INTRA_OP_THREADS = 4
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
	}
}

export interface QueryEncoderStartup {
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
	started: number
	counts: Record<QueryModelName, number>
	dims: Record<QueryModelName, number>
	resolve: (vectors: QueryVectors) => void
	reject: (error: Error) => void
}

interface RunningEncoder {
	worker: Worker
	models: LocalQueryModels
	startup: QueryEncoderStartup
}

let running: Promise<RunningEncoder> | undefined
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
	return new URL("./query-encoder.worker.js", import.meta.url)
}

async function start(): Promise<RunningEncoder> {
	const started = performance.now()
	const models = await ensureQueryModelFiles()
	const filesMs = performance.now() - started
	const worker = new Worker(workerUrl(), {
		workerData: { models, threads: INTRA_OP_THREADS },
		name: "query-encoder",
	})
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
	const onGone = (error: Error) => {
		running = undefined
		loaded = false
		failAll(error)
	}
	worker.on("error", (error) => onGone(error))
	worker.on("exit", (code) =>
		onGone(new Error(`Query encoder worker exited with code ${code}`)),
	)
	return {
		worker,
		models,
		startup: {
			filesMs,
			loadMs: ready.loadMs,
			warmMs: ready.warmMs,
			totalMs: performance.now() - started,
		},
	}
}

function ensureRunning(): Promise<RunningEncoder> {
	assertSearchRankingEnabled("The query encoder")
	if (running) return running
	if (lastFailure && Date.now() - failedAt < RETRY_AFTER_MS) {
		return Promise.reject(lastFailure)
	}
	running = start()
	running.then(
		() => {
			lastFailure = undefined
			loaded = true
		},
		(error: Error) => {
			running = undefined
			failedAt = Date.now()
			lastFailure = error
			console.error("Query encoder failed to start", error)
		},
	)
	return running
}

let loaded = false

/** Whether the models are loaded, and how many requests wait. Shadow mode skips a search while it isn't ready or busy. */
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

/** Encodes one search's texts: one batch per model. Returns the vectors in the order of the texts. */
export async function encodeQueryTexts(
	texts: QueryTexts,
): Promise<QueryVectors> {
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
	const id = nextId++
	return new Promise<QueryVectors>((resolve, reject) => {
		pending.set(id, {
			started: performance.now(),
			counts,
			dims,
			resolve,
			reject,
		})
		encoder.worker.postMessage({ id, texts })
	})
}

/** Stops the worker and frees the models. The next call starts them again. */
export async function stopQueryEncoder(): Promise<void> {
	const current = running
	running = undefined
	loaded = false
	if (!current) return
	const encoder = await current.catch(() => undefined)
	if (encoder) await encoder.worker.terminate()
	failAll(new Error("Query encoder stopped"))
}

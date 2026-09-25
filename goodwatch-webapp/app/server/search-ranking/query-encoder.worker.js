// Query encoder worker thread. query-encoder.server.ts starts it with the local model files in workerData.
//
// It loads both fp32 ONNX sessions once, then encodes one request at a time from a queue: one batch per model.
// Encoding requests in parallel only splits the same cores, so it adds no throughput.
//
// This file is plain JavaScript because the server bundle can't hold a worker entry: vite.config.js copies it next
// to build/server/index.js, and in development it runs from this folder.
import { readFileSync } from "node:fs"
import { parentPort, workerData } from "node:worker_threads"
import { Tokenizer } from "@huggingface/tokenizers"
import * as ort from "onnxruntime-node"

const { models, threads } = workerData
const now = () => performance.now()

function loadTokenizer(model) {
	const config = JSON.parse(readFileSync(model.tokenizerConfigPath, "utf8"))
	const tokenizer = new Tokenizer(
		JSON.parse(readFileSync(model.tokenizerPath, "utf8")),
		config,
	)
	const padToken = config.pad_token?.content ?? config.pad_token
	const padId = tokenizer.token_to_id(padToken) ?? 0
	return { tokenizer, padId }
}

async function loadModel(model) {
	const started = now()
	const { tokenizer, padId } = loadTokenizer(model)
	const session = await ort.InferenceSession.create(model.modelPath, {
		intraOpNumThreads: threads,
		interOpNumThreads: 1,
		executionMode: "sequential",
		graphOptimizationLevel: "all",
	})
	const { dim, pooling, queryPrefix, maxTokens } = model.spec

	// Returns the L2-normalized vectors of `texts`, packed into one Float32Array of texts.length * dim.
	async function encode(texts) {
		// Truncate like the Python tokenizers: keep the first tokens and the closing special token.
		const encoded = texts.map((text) => {
			const { ids } = tokenizer.encode(queryPrefix + text)
			return ids.length > maxTokens
				? [...ids.slice(0, maxTokens - 1), ids[ids.length - 1]]
				: ids
		})
		const batch = texts.length
		const length = Math.max(...encoded.map((ids) => ids.length))
		const inputIds = new BigInt64Array(batch * length).fill(BigInt(padId))
		const attentionMask = new BigInt64Array(batch * length)
		encoded.forEach((ids, b) => {
			for (let t = 0; t < ids.length; t++) {
				inputIds[b * length + t] = BigInt(ids[t])
				attentionMask[b * length + t] = 1n
			}
		})
		const feeds = {}
		for (const name of session.inputNames) {
			const data =
				name === "input_ids"
					? inputIds
					: name === "attention_mask"
						? attentionMask
						: new BigInt64Array(batch * length) // token_type_ids: one segment
			feeds[name] = new ort.Tensor("int64", data, [batch, length])
		}
		const output = await session.run(feeds)
		const hidden = output.last_hidden_state ?? output[session.outputNames[0]]
		const states = hidden.data
		if (hidden.dims[2] !== dim) {
			throw new Error(
				`${model.spec.repo} returned ${hidden.dims[2]} dimensions, expected ${dim}`,
			)
		}
		const vectors = new Float32Array(batch * dim)
		for (let b = 0; b < batch; b++) {
			const v = vectors.subarray(b * dim, (b + 1) * dim)
			if (pooling === "cls") {
				v.set(states.subarray(b * length * dim, b * length * dim + dim))
			} else {
				let tokens = 0
				for (let t = 0; t < length; t++) {
					if (!attentionMask[b * length + t]) continue
					tokens++
					const offset = (b * length + t) * dim
					for (let d = 0; d < dim; d++) v[d] += states[offset + d]
				}
				for (let d = 0; d < dim; d++) v[d] /= tokens
			}
			let norm = 0
			for (let d = 0; d < dim; d++) norm += v[d] * v[d]
			norm = Math.sqrt(norm) || 1
			for (let d = 0; d < dim; d++) v[d] /= norm
		}
		return vectors
	}
	return { encode, loadMs: now() - started }
}

const encoders = {}
const loadMs = {}
const loadStarted = now()
try {
	for (const name of Object.keys(models)) {
		encoders[name] = await loadModel(models[name])
		loadMs[name] = encoders[name].loadMs
	}
	// The first runs allocate buffers; warm up so the first search doesn't pay for it.
	const warmStarted = now()
	for (let i = 0; i < 3; i++) {
		for (const name of Object.keys(encoders)) {
			await encoders[name].encode(["warm up the query encoder", "dark comedy"])
		}
	}
	parentPort.postMessage({
		type: "ready",
		loadMs,
		warmMs: now() - warmStarted,
		totalMs: now() - loadStarted,
	})
} catch (error) {
	parentPort.postMessage({
		type: "fatal",
		message: String(error?.stack ?? error),
	})
	process.exit(1)
}

const queue = []
let draining = false

async function drain() {
	if (draining) return
	draining = true
	while (queue.length) {
		const { request, received } = queue.shift()
		const started = now()
		try {
			const vectors = {}
			const encodeMs = {}
			for (const name of Object.keys(encoders)) {
				const texts = request.texts[name] ?? []
				if (!texts.length) continue
				const t = now()
				vectors[name] = await encoders[name].encode(texts)
				encodeMs[name] = now() - t
			}
			parentPort.postMessage(
				{
					type: "result",
					id: request.id,
					vectors,
					queuedMs: started - received,
					encodeMs,
				},
				Object.values(vectors).map((v) => v.buffer),
			)
		} catch (error) {
			parentPort.postMessage({
				type: "error",
				id: request.id,
				message: String(error?.message ?? error),
			})
		}
	}
	draining = false
}

parentPort.on("message", (request) => {
	queue.push({ request, received: now() })
	drain()
})

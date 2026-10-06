// Own a worker for one snapshot preparation, with an inline fallback for unbundled development.
import { existsSync } from "node:fs"
import { Worker } from "node:worker_threads"
import { separateEntryUrl } from "../separate-entry.server"
import { SnapshotRefused } from "./format.server"
import { type PrepareInput, prepareSnapshot } from "./prepare.server"

const active = new Set<Worker>()
let warned = false

export function stopSnapshotWorkers() {
	return Promise.all([...active].map((worker) => worker.terminate()))
}

function copyChunks(chunks: Uint8Array[]): Uint8Array {
	const bytes = new Uint8Array(
		chunks.reduce((size, chunk) => size + chunk.byteLength, 0),
	)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.byteLength
	}
	return bytes
}

export async function prepareInWorker(
	input: PrepareInput,
	url = separateEntryUrl("title-snapshot.worker.js", import.meta.url),
): Promise<ReturnType<typeof prepareSnapshot>> {
	if (!existsSync(url)) {
		if (process.env.NODE_ENV === "production" && !warned) {
			warned = true
			console.error(
				`Missing ${url.pathname}; title snapshot load runs on the main thread`,
			)
		}
		return prepareSnapshot(input)
	}
	// ioredis returns slices of a shared parser pool. Transferring those buffers would detach
	// the pool, so copy into fresh owned buffers before transferring them.
	const chunks = [copyChunks(input.chunks)]
	const ratings = input.ratings
		? {
				manifest: input.ratings.manifest,
				chunks: [copyChunks(input.ratings.chunks)],
			}
		: null
	const transferList = [chunks[0].buffer as ArrayBuffer]
	if (ratings) transferList.push(ratings.chunks[0].buffer as ArrayBuffer)
	const worker = new Worker(url, {
		workerData: { ...input, chunks, ratings },
		transferList,
	})
	active.add(worker)
	let timeout: NodeJS.Timeout | undefined
	try {
		return await new Promise((resolve, reject) => {
			let done = false
			timeout = setTimeout(
				() => reject(new Error("Title snapshot worker timed out")),
				60_000,
			)
			worker.on("error", reject)
			worker.on("exit", (code) => {
				if (!done || code !== 0)
					reject(new Error(`Title snapshot worker exited early (${code})`))
			})
			worker.once("message", (message) => {
				done = true
				if (message.ok) resolve(message.result)
				else
					reject(
						message.refused
							? new SnapshotRefused(message.message)
							: new Error(message.message),
					)
			})
		})
	} finally {
		clearTimeout(timeout)
		await worker.terminate()
		active.delete(worker)
	}
}

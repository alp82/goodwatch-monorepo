// Build once off-thread and send one bounded piece per acknowledgement.
import { parentPort, workerData } from "node:worker_threads"
import { BlobMissing, loadBuild } from "./search-index-build.server.ts"
import { piecesOf, transferablesOf } from "./search-index-pieces.server.ts"

const port = parentPort!
try {
	const index = await loadBuild(workerData.manifest)
	for (const piece of piecesOf(index)) {
		await new Promise<void>((resolve) => {
			const next = (message: { type: string }) => {
				if (message.type !== "next") return
				port.off("message", next)
				resolve()
			}
			port.on("message", next)
			port.postMessage({ type: "piece", piece }, transferablesOf(piece))
		})
	}
	port.postMessage({ type: "done" })
} catch (error) {
	port.postMessage({
		type: "error",
		message: error instanceof Error ? error.message : String(error),
		blobMissing: error instanceof BlobMissing,
	})
} finally {
	port.close()
}

// Check and derive one snapshot, returning typed arrays without copying their buffers.
import { parentPort, workerData } from "node:worker_threads"
import { SnapshotRefused } from "./format.server"
import { prepareSnapshot, snapshotTransferables } from "./prepare.server"

try {
	const result = prepareSnapshot(workerData)
	parentPort!.postMessage({ ok: true, result }, snapshotTransferables(result))
} catch (error) {
	parentPort!.postMessage({
		ok: false,
		refused: error instanceof SnapshotRefused,
		message: error instanceof Error ? error.message : String(error),
	})
} finally {
	parentPort!.close()
}

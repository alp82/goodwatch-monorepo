// One log line a minute with the server process's memory, its longest event loop stall and the query encoder's
// queue, so an outage leaves a trail in the container logs. The memory includes the query encoder's worker thread;
// the share card renderers are separate processes and aren't counted.
import { monitorEventLoopDelay } from "node:perf_hooks"
import { queryEncoderState } from "~/server/search-ranking/query-encoder.server"

const LOG_EVERY_MS = 60_000

let timer: NodeJS.Timeout | undefined

/** Starts the log line. Safe to call more than once. */
export function startProcessStats(): void {
	if (timer) return
	const loopDelay = monitorEventLoopDelay({ resolution: 20 })
	loopDelay.enable()
	const mb = (bytes: number) => Math.round(bytes / 1024 / 1024)
	timer = setInterval(() => {
		const memory = process.memoryUsage()
		const encoder = queryEncoderState()
		console.info(
			`Process: rss ${mb(memory.rss)} MB, heap ${mb(memory.heapUsed)} of ${mb(memory.heapTotal)} MB, external ${mb(memory.external)} MB, ` +
				`longest event loop stall ${Math.round(loopDelay.max / 1e6)} ms, ` +
				`query encoder ${encoder.ready ? "ready" : "not ready"} with ${encoder.pending} waiting, up ${Math.round(process.uptime() / 60)} min`,
		)
		loopDelay.reset()
	}, LOG_EVERY_MS)
	timer.unref()
}

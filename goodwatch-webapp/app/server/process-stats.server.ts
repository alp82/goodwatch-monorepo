// One log line a minute with the server process's memory, its longest event loop stall and the query encoder's
// queue, so an outage leaves a trail in the container logs. The memory includes the query encoder's worker thread;
// the share card renderers are separate processes and aren't counted. A second line says what happened to the requests
// for filtered person pages, when there were any.
//
// The line also says how long the garbage collector held the process in the minute and its longest single pause, by
// kind. After the deploys of November 13, 2026 every instance stopped for 20 to 35 seconds three to four minutes after
// its start, while its heap fell from about 700 MB to 400 MB; these numbers say whether the collector is that stop.
import {
	constants,
	PerformanceObserver,
	monitorEventLoopDelay,
} from "node:perf_hooks"
import { reportFilteredViews } from "~/server/crawlers.server"
import { onShutdown } from "~/server/lifecycle.server"
import { queryEncoderState } from "~/server/search-ranking/query-encoder.server"

const LOG_EVERY_MS = 60_000

let timer: NodeJS.Timeout | undefined

/** Starts the log line. Safe to call more than once. */
export function startProcessStats(): void {
	if (timer) return
	const loopDelay = monitorEventLoopDelay({ resolution: 20 })
	loopDelay.enable()
	const mb = (bytes: number) => Math.round(bytes / 1024 / 1024)
	const gc = { totalMs: 0, longestMs: 0, longestKind: "" }
	const KINDS: Record<number, string> = {
		[constants.NODE_PERFORMANCE_GC_MINOR]: "minor",
		[constants.NODE_PERFORMANCE_GC_MAJOR]: "major",
		[constants.NODE_PERFORMANCE_GC_INCREMENTAL]: "incremental",
		[constants.NODE_PERFORMANCE_GC_WEAKCB]: "weak callbacks",
	}
	const collections = new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			gc.totalMs += entry.duration
			if (entry.duration > gc.longestMs) {
				gc.longestMs = entry.duration
				const kind = (entry.detail as { kind?: number } | undefined)?.kind ?? 0
				gc.longestKind = KINDS[kind] ?? String(kind)
			}
		}
	})
	collections.observe({ entryTypes: ["gc"] })
	timer = setInterval(() => {
		const memory = process.memoryUsage()
		const encoder = queryEncoderState()
		console.info(
			`Process: rss ${mb(memory.rss)} MB, heap ${mb(memory.heapUsed)} of ${mb(memory.heapTotal)} MB, external ${mb(memory.external)} MB, ` +
				`longest event loop stall ${Math.round(loopDelay.max / 1e6)} ms, ` +
				`query encoder ${encoder.ready ? "ready" : "not ready"} with ${encoder.pending} waiting, up ${Math.round(process.uptime() / 60)} min, ` +
				// Last, so that tools that show the start of the line still see the fields before it.
				`garbage collection ${Math.round(gc.totalMs)} ms (longest ${Math.round(gc.longestMs)} ms${gc.longestKind ? ` ${gc.longestKind}` : ""})`,
		)
		loopDelay.reset()
		gc.totalMs = 0
		gc.longestMs = 0
		gc.longestKind = ""
		const filteredViews = reportFilteredViews()
		if (filteredViews) console.info(`Filtered person views: ${filteredViews}`)
	}, LOG_EVERY_MS)
	timer.unref()
	onShutdown("process stats", () => {
		clearInterval(timer)
		loopDelay.disable()
		collections.disconnect()
	})
}

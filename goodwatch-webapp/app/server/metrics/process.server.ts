// Samples process health when scraped, keeping background work to one event loop monitor.
import { monitorEventLoopDelay } from "node:perf_hooks"
import { gauge } from "./registry.server"

const RESOLUTION_MS = 20

export function startProcessMetrics(): void {
	const delay = monitorEventLoopDelay({ resolution: RESOLUTION_MS })
	delay.enable()
	gauge(
		"goodwatch_process_resident_memory_bytes",
		"Resident process memory in bytes.",
		[],
		() => [{ labels: [], value: process.memoryUsage.rss() }],
	)
	gauge(
		"goodwatch_process_heap_used_bytes",
		"Used JavaScript heap in bytes.",
		[],
		() => [{ labels: [], value: process.memoryUsage().heapUsed }],
	)
	// The monitor's timer fires every RESOLUTION_MS and records the time between two fires, so a free event loop reads
	// as the resolution. The gauge reports only what comes on top: how long the loop was late.
	const late = (nanoseconds: number) =>
		delay.count ? Math.max(0, nanoseconds / 1e9 - RESOLUTION_MS / 1000) : 0
	gauge(
		"goodwatch_process_event_loop_delay_seconds",
		"How late the event loop ran since the previous scrape.",
		["quantile"],
		() => {
			const samples = [
				{ labels: ["0.5"], value: late(delay.percentile(50)) },
				{ labels: ["0.99"], value: late(delay.percentile(99)) },
				{ labels: ["max"], value: late(delay.max) },
			]
			delay.reset()
			return samples
		},
	)
	gauge(
		"goodwatch_process_uptime_seconds",
		"Process uptime in seconds.",
		[],
		() => [{ labels: [], value: process.uptime() }],
	)
	const commit = process.env.SOURCE_COMMIT?.slice(0, 8) || "unknown"
	gauge(
		"goodwatch_build_info",
		"Running application build.",
		["commit"],
		() => [{ labels: [commit], value: 1 }],
	)
}

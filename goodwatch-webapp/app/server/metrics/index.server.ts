// Starts process metrics once, including across Vite server module reloads.
import { startAuthMetrics } from "./auth.server"
import { startHttpMetrics } from "./http.server"
import { startMetricsListener } from "./listener.server"
import { startProcessMetrics } from "./process.server"

const key = Symbol.for("goodwatch.metrics.started")
const shared = globalThis as typeof globalThis & { [key]?: boolean }
export function startMetrics(): void {
	if (shared[key]) return
	shared[key] = true
	startAuthMetrics()
	startHttpMetrics()
	startProcessMetrics()
	startMetricsListener()
}

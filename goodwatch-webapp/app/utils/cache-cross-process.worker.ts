// Each fork imports a real, independent cache module and GuardedCluster.
import "ioredis"
import "../server/title-filter/test-alias.ts"
const cache = await import("./cache.ts")
const { renderMetrics } = await import("../server/metrics/registry.server.ts")
export interface WorkerRequest {
	id: number
	command:
		| "declare"
		| "lookup"
		| "release"
		| "reset"
		| "metrics"
		| "pending"
		| "setRetryMs"
		| "ready"
	name?: string
	params?: Record<string, unknown>
	ttl?: number
	stale?: number
	value?: string
	gate?: string
	ms?: number
}
const gates = new Map<string, () => void>()
async function handle(request: WorkerRequest): Promise<unknown> {
	const { name = "", params = {}, ttl = 1, stale = 1 } = request
	switch (request.command) {
		case "declare":
			cache.declareResettableCache({
				name,
				ttlMinutes: ttl,
				staleMinutes: stale,
			})
			return true
		case "lookup":
			return cache.cached({
				name,
				params,
				ttlMinutes: ttl,
				staleMinutes: stale,
				target: async () => {
					if (request.gate) {
						const gate = request.gate
						await new Promise<void>((resolve) => {
							gates.set(gate, resolve)
							process.send?.({ started: gate })
						})
					}
					return { v: request.value }
				},
			})
		case "release":
			gates.get(request.gate ?? "")?.()
			gates.delete(request.gate ?? "")
			return true
		case "reset":
			return cache.resetCacheConfirmed({ name, params })
		case "metrics":
			return renderMetrics()
		case "pending":
			return cache.pendingResetCount()
		case "setRetryMs":
			cache.setResetRetryMsForTest(request.ms ?? null)
			return true
		case "ready": {
			const deadline = Date.now() + 10_000
			while (!cache.getRedisCluster()) {
				if (Date.now() > deadline)
					throw new Error("Worker Redis readiness timed out")
				await new Promise((resolve) => setTimeout(resolve, 25))
			}
			return true
		}
	}
}
process.on("message", (request: WorkerRequest) => {
	void handle(request).then(
		(value) => process.send?.({ id: request.id, value }),
		(error: unknown) =>
			process.send?.({ id: request.id, error: String(error) }),
	)
})
process.on("disconnect", () => {
	cache.resetPendingResetsForTest()
	cache.stopRedisClusterForTest()
	process.exit(0)
})

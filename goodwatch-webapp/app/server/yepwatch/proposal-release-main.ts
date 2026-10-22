import { createReleaseBus } from "./proposal-release-bus.ts"
import Redis from "ioredis"
import { loadReleaseSecrets, releaseConfig } from "./proposal-release-config.ts"
import { crateSql } from "./repository.server.ts"
import { createReleaseRuntime } from "./proposal-release-runtime.ts"
import { releaseHttp } from "./proposal-release-http.ts"
import {
	readonlyCatalogEnvironment,
	assertNoSharedCatalogWriter,
} from "./proposal-release-catalog-env.ts"
// Nothing importing the catalog may run before secret files and role configuration are loaded.
await loadReleaseSecrets(process.env)
const config = releaseConfig(process.env)
process.env.WEBAPP_ROLE = "page"
const sourceConfig = readonlyCatalogEnvironment(process.env)
const source = new Redis.Cluster(sourceConfig.nodes, {
	lazyConnect: true,
	clusterRetryStrategy: () => null,
	slotsRefreshTimeout: 3000,
	redisOptions: {
		username: sourceConfig.username,
		password: sourceConfig.password,
		connectTimeout: 3000,
		commandTimeout: sourceConfig.timeoutMs,
		maxRetriesPerRequest: 1,
	},
})
source.on("error", () => {})
const snapshot = await import("../title-snapshot/index.server.ts")
let sourceReads = 0
snapshot.configureTitleSnapshotReader({
	get: (key) => {
		sourceReads++
		return source.get(key)
	},
	getBuffer: (key) => {
		sourceReads++
		return source.getBuffer(key)
	},
})
const [{ guestProposalCatalog }, { searchQuery }, cache] = await Promise.all([
	import("./proposal-guest-catalog.server.ts"),
	import("../combined-search/catalog.server.ts"),
	import("../../utils/cache.ts"),
])
assertNoSharedCatalogWriter(cache.getRedisCluster)
const bus = createReleaseBus(config)
bus.on("error", () => {})
void bus.connect().catch(() => {}) // A missing bus keeps readiness red and reconnects; no startup room writes.
snapshot.startTitleSnapshot()
const runtime = createReleaseRuntime(config, {
	sql: crateSql(config.origin, config.username, config.password),
	catalog: guestProposalCatalog(),
	memberCatalog: guestProposalCatalog,
	bus,
	snapshot: snapshot.getTitleSnapshot,
	async catalogProbe() {
		assertNoSharedCatalogWriter(cache.getRedisCluster)
		await searchQuery("SELECT tmdb_id FROM streaming_service LIMIT 1")
		await searchQuery("SELECT media_tmdb_id FROM streaming_evidence LIMIT 0")
		await searchQuery("SELECT tmdb_id FROM episode LIMIT 0")
	},
})
const server = await releaseHttp(runtime.handler, config.host, config.port)
void runtime.probe()
const readyLog = setInterval(() => {
	if (!runtime.readiness().ready) return
	console.info(
		JSON.stringify({
			event: "yepwatch_release_ready",
			snapshotTitles: snapshot.getTitleSnapshot()?.count,
			sourceReadCommands: sourceReads,
			derivedCache: "disabled",
			sharedCatalogWriterInitialized: cache.getRedisCluster() !== null,
			rssBytes: process.memoryUsage().rss,
			heapUsedBytes: process.memoryUsage().heapUsed,
			cpu: process.cpuUsage(),
			uptimeMs: Math.round(process.uptime() * 1000),
		})
	)
	clearInterval(readyLog)
}, 1000)
readyLog.unref()
console.info(
	JSON.stringify({
		event: "yepwatch_release_listening",
		mode: config.member ? "member" : "guest",
		contractVersion: 3,
		derivedCache: "disabled",
		sharedCatalogWriterInitialized: false,
		port: (server.address() as { port: number }).port,
		sourceCommit: config.sourceCommit,
	})
)
let stopping = false
async function shutdown(signal: string) {
	if (stopping) return
	stopping = true
	runtime.drain()
	console.info(JSON.stringify({ event: "yepwatch_release_draining", signal }))
	const hard = setTimeout(() => process.exit(1), 25000)
	hard.unref()
	if (signal !== "SIGINT")
		await new Promise((r) => setTimeout(r, config.shutdownDelayMs))
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			server.closeAllConnections()
			resolve()
		}, config.drainMs)
		server.close(() => {
			clearTimeout(timeout)
			resolve()
		})
		server.closeIdleConnections()
	})
	runtime.stop()
	clearInterval(readyLog)
	snapshot.stopTitleSnapshot()
	cache.stopRedisClusterForTest()
	source.disconnect()
	bus.disconnect()
	console.info(JSON.stringify({ event: "yepwatch_release_stopped" }))
	process.exit(0)
}
for (const signal of ["SIGTERM", "SIGINT"] as const)
	process.once(signal, () => void shutdown(signal))

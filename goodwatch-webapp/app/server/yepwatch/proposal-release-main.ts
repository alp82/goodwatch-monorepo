import { createReleaseBus } from "./proposal-release-bus.ts"
import { ValkeyTicketStore } from "./proposal-tickets.ts"
import { ValkeyCommandBudget } from "./proposal-command-budget.ts"
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
const [{ guestProposalCatalog }, { warmRankings }, { searchQuery }, cache] = await Promise.all([
	import("./proposal-guest-catalog.server.ts"),
	import("./goodwatch.server.ts"),
	import("../combined-search/catalog.server.ts"),
	import("../../utils/cache.ts"),
])
assertNoSharedCatalogWriter(cache.getRedisCluster)
const bus = createReleaseBus(config)
bus.on("error", () => {})
void bus.connect().catch(() => {}) // A missing bus keeps readiness red and reconnects; no startup room writes.
// Tickets on a connection of their own that never resends a command (their scripts are replay-safe anyway).
const ticketBus = createReleaseBus(config, { once: true })
ticketBus.on("error", () => {})
void ticketBus.connect().catch(() => {})
const tickets = new ValkeyTicketStore(ticketBus)
snapshot.startTitleSnapshot()
const runtime = createReleaseRuntime(config, {
	sql: crateSql(config.origin, config.username, config.password),
	catalog: guestProposalCatalog(),
	memberCatalog: guestProposalCatalog,
	bus,
	tickets,
	// On the tickets' connection: its script is replay-safe too.
	commands: new ValkeyCommandBudget(ticketBus),
	snapshot: snapshot.getTitleSnapshot,
	async catalogProbe() {
		assertNoSharedCatalogWriter(cache.getRedisCluster)
		await searchQuery("SELECT tmdb_id FROM streaming_service LIMIT 1")
		await searchQuery("SELECT media_tmdb_id FROM streaming_evidence LIMIT 0")
		await searchQuery("SELECT tmdb_id FROM episode LIMIT 0")
	},
})
// Each new snapshot version gets the base rankings of common and recently used room settings built in the background
// (slice by slice, see goodwatch.server.ts), so the first room of each doesn't wait for them.
const WARM_RANKINGS = ["US", "DE", "GB"].map((country) => ({ country, type: "all" as const, moods: [] }))
let warmedVersion: string | undefined
let warming = false
const warm = setInterval(() => {
	const version = snapshot.getTitleSnapshot()?.version
	if (!version || version === warmedVersion || warming) return
	warming = true
	void warmRankings(WARM_RANKINGS)
		.then(() => { warmedVersion = version })
		.catch(() => {})
		.finally(() => { warming = false })
}, 5_000)
warm.unref()
// The listener opens only once the release is initialized (snapshot loaded, every dependency answered, about 9 s
// after start). During a deploy the front, and goodwatch-proxy's hold in front of it, then see a refused connection
// and keep each request waiting (lb_try_duration) instead of passing "YepWatch is starting" 503s on to phones.
// The Docker health check fails until then, within its start period.
while (!runtime.initialized()) {
	await runtime.probe()
	if (!runtime.initialized()) await new Promise((resolve) => setTimeout(resolve, 500))
}
const server = await releaseHttp(runtime.handler, config.host, config.port)
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
	clearInterval(warm)
	clearInterval(readyLog)
	snapshot.stopTitleSnapshot()
	cache.stopRedisClusterForTest()
	source.disconnect()
	bus.disconnect()
	ticketBus.disconnect()
	console.info(JSON.stringify({ event: "yepwatch_release_stopped" }))
	process.exit(0)
}
for (const signal of ["SIGTERM", "SIGINT"] as const)
	process.once(signal, () => void shutdown(signal))

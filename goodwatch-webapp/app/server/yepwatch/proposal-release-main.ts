import { createReleaseBus } from "./proposal-release-bus.ts"
import { createRoomsValkey } from "./proposal-rooms-valkey.ts"
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
// Startup phases (ms since the process started), logged once with yepwatch_release_listening/_initialized: a deploy
// keeps phones waiting for exactly this long, so each phase is visible in the container log.
const phases: Record<string, number> = { modules: Math.round(performance.now()) }
const mark = (phase: string) => {
	phases[phase] = Math.round(performance.now())
}
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
const [{ guestProposalCatalog }, { warmRankings, warmCatalogLists }, { searchQuery }, cache] = await Promise.all([
	import("./proposal-guest-catalog.server.ts"),
	import("./goodwatch.server.ts"),
	import("../combined-search/catalog.server.ts"),
	import("../../utils/cache.ts"),
])
assertNoSharedCatalogWriter(cache.getRedisCluster)
mark("imports")
const bus = createReleaseBus(config)
bus.on("error", () => {})
void bus.connect().catch(() => {}) // A missing bus keeps readiness red and reconnects; no startup room writes.
// Live rooms, tickets and rate windows in the dedicated rooms Valkey, on a connection that never resends a command
// (a lost answer is an unknown outcome; every script is replay-safe or re-read). The bus above stays the shared
// cluster: it carries revision hints to the gateway.
// Without a rooms Valkey (older deployment routes), rooms stay in Crate and tickets on a once-only bus connection.
const rooms = config.roomsValkeyUrl ? createRoomsValkey(config.roomsValkeyUrl, config.secret) : createReleaseBus(config, { once: true })
rooms.on("error", () => {})
void rooms.connect().catch(() => {})
const tickets = new ValkeyTicketStore(rooms)
snapshot.startTitleSnapshot()
// The country and service lists every new room's setup reads, read while the release initializes, so the first room
// after a deploy is as quick as the next (best effort: a failed read is read again by the first room that needs it).
// Held requests wait for them, at most 5 s.
const lists = warmCatalogLists().catch(() => {})
const runtime = createReleaseRuntime(config, {
	// The listener opens at once (below). A request that comes in while the release initializes waits here, as it
	// would in the front's retry loop; the live channel's routes (ticket, attach, room read) only until the rooms
	// answer, so phones are live again about a second after a deploy's containers start, before the title snapshot
	// has loaded (about 3 s more on production).
	startupHoldMs: 25_000,
	warm: Promise.race([lists, new Promise((resolve) => setTimeout(resolve, 5000).unref())]),
	sql: crateSql(config.origin, config.username, config.password),
	catalog: guestProposalCatalog(),
	memberCatalog: guestProposalCatalog,
	bus,
	tickets,
	commands: new ValkeyCommandBudget(rooms),
	...(config.roomsValkeyUrl ? { rooms: rooms as ReturnType<typeof createRoomsValkey> } : {}),
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
// The listener opens now: the hold above keeps each early request waiting in this process, and the Docker health
// check (readiness) stays red until the release is initialized, within its start period.
const server = await releaseHttp(runtime.handler, config.host, config.port)
mark("listening")
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
// Probes until initialized: quickly, so neither the live routes nor everything else waits a whole probe period
// after the rooms, or the snapshot, came in.
let loggedRooms = false
while (!runtime.initialized()) {
	await runtime.probe()
	if (!loggedRooms && runtime.roomsAnswer()) {
		loggedRooms = true
		mark("roomsAnswer")
	}
	if (phases.snapshot === undefined && snapshot.getTitleSnapshot()) mark("snapshot")
	if (!runtime.initialized()) await new Promise((resolve) => setTimeout(resolve, 100))
}
mark("initialized")
console.info(JSON.stringify({ event: "yepwatch_release_initialized", phases }))
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
	await Promise.race([runtime.stop(), new Promise((r) => setTimeout(r, 3000))])
	clearInterval(warm)
	clearInterval(readyLog)
	snapshot.stopTitleSnapshot()
	cache.stopRedisClusterForTest()
	source.disconnect()
	bus.disconnect()
	rooms.disconnect()
	console.info(JSON.stringify({ event: "yepwatch_release_stopped" }))
	process.exit(0)
}
for (const signal of ["SIGTERM", "SIGINT"] as const)
	process.once(signal, () => void shutdown(signal))

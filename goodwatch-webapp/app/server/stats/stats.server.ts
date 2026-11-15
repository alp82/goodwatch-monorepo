// The /stats snapshot for the page: computed in the background (store.ts says when), never on a request.
//
// Only a deployed production server shares its snapshot through Valkey: NODE_ENV production and the 40-character
// SOURCE_COMMIT that Coolify supplies at runtime (see list-exposure.server.ts). Anywhere else, a local `npm run dev`
// or `npm start` included, the snapshot is computed and kept in memory only, so branch code that runs against the
// production .env never writes the copy that production adopts.
import { gauge } from "~/server/metrics/registry.server"
import { getRedisCluster } from "~/utils/cache"
import { computeStatsSnapshot } from "./compute.server"
import { type StatsRedis, statsSnapshotSource, statsStore } from "./store"

const deployed = () =>
	process.env.NODE_ENV === "production" &&
	/^[a-f0-9]{40}$/.test(process.env.SOURCE_COMMIT ?? "")

// The error carries the cause and its stack (store.ts says which attempt it was and when the next one comes).
const report = (error: unknown) => console.error("Stats snapshot:", error)

const source = statsSnapshotSource({
	store: statsStore({
		redis: () =>
			deployed() ? (getRedisCluster() as StatsRedis | null | undefined) : null,
		onError: report,
	}),
	compute: async (signal) => {
		const start = Date.now()
		const { snapshot, timings } = await computeStatsSnapshot(
			undefined,
			Date.now(),
			signal,
		)
		const slowest = [...timings].sort((a, b) => b.ms - a.ms).slice(0, 3)
		console.info(
			`Stats snapshot computed in ${Math.round((Date.now() - start) / 1000)} s (${timings.length} statements; slowest ${slowest
				.map((t) => `${t.name} ${t.ms} ms`)
				.join(", ")})`,
		)
		return snapshot
	},
	onError: report,
})

/** The last snapshot, or null while the first one is counted. */
export const readStatsSnapshot = () => source.read()

const started = Symbol.for("goodwatch.stats-snapshot.refresh")
const shared = globalThis as typeof globalThis & { [started]?: boolean }

/**
 * For a process that serves pages (entry.server.tsx): the snapshot's metrics, and on a deployed production server an
 * hourly look whether the snapshot is a day old, the first after startup has settled. Once per process, also across
 * Vite's module reloads. Elsewhere the first /stats request starts the computation.
 */
export function startStatsRefresh(): void {
	if (shared[started]) return
	shared[started] = true
	gauge(
		"goodwatch_stats_snapshot_age_seconds",
		"Age of the /stats snapshot this process serves; absent while it has none.",
		[],
		() => {
			const { builtAt } = source.status()
			return builtAt === null
				? []
				: [{ labels: [], value: (Date.now() - builtAt) / 1000 }]
		},
	)
	gauge(
		"goodwatch_stats_snapshot_failures",
		"Failed /stats snapshot computations in a row.",
		[],
		() => [{ labels: [], value: source.status().failures }],
	)
	if (!deployed()) return
	const look = () => void source.check().catch(report)
	setTimeout(look, 30_000).unref()
	setInterval(look, 60 * 60 * 1000).unref()
}

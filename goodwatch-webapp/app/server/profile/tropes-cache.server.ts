import { withBackendTimeout } from "~/utils/backend-timeout"
import { execute, query } from "~/utils/crate"
import type { TropePool } from "./tropes-model"
import { createTropeSnapshots } from "./trope-snapshots"

const bounded = <T>(run: () => Promise<T>) =>
	withBackendTimeout("valkey", 800, run)
async function redis() {
	const { getRedisCluster } = await import("~/utils/cache")
	return getRedisCluster()
}

// Redis is the fast tier. Crate retains the last complete snapshot across expiry, eviction and restarts.
// Neither cache contains viewer state; every request checks the current profile visibility first.
const snapshots = createTropeSnapshots({
	readFast: async (userId) => {
		const store = await redis()
		if (!store) return null
		return bounded(() => store.get(`profile-tropes:v1:${userId}`))
	},
	readStored: async (userId) => {
		const rows = await query<{ read_from: number; pool: string }>(
			"SELECT read_from, pool FROM profile_tropes_snapshot WHERE owner_id = ?",
			[userId],
			{ timeoutMs: 800 },
		)
		const row = rows[0]
		return row
			? JSON.stringify({
					readFrom: Number(row.read_from),
					stats: JSON.parse(row.pool),
				})
			: null
	},
	readTouched: async (userId) => {
		const store = await redis()
		return store ? bounded(() => store.get(`taste:touched:${userId}`)) : null
	},
	writeFast: async (userId, raw) => {
		const store = await redis()
		if (store)
			await bounded(() =>
				store.eval(
					`
   local old = redis.call('GET', KEYS[1])
   if old then
    local ok, entry = pcall(cjson.decode, old)
    if ok and type(entry) == 'table' and tonumber(entry.readFrom) and tonumber(entry.readFrom) > tonumber(ARGV[2]) then return 0 end
   end
   redis.call('SET', KEYS[1], ARGV[1], 'EX', 600)
   return 1
  `,
					1,
					`profile-tropes:v1:${userId}`,
					raw,
					String(JSON.parse(raw).readFrom),
				),
			)
	},
	writeStored: async (userId, pool: TropePool, readFrom) => {
		// An older build on another instance must never replace a newer completed snapshot.
		await execute(
			`INSERT INTO profile_tropes_snapshot (owner_id, read_from, pool) VALUES (?, ?, ?)
   ON CONFLICT (owner_id) DO UPDATE SET
   pool = CASE WHEN read_from <= excluded.read_from THEN excluded.pool ELSE pool END,
   read_from = greatest(read_from, excluded.read_from)`,
			[userId, readFrom, JSON.stringify(pool)],
		)
	},
})

export const readCachedTropePool = snapshots.read
export const writeCachedTropePool = snapshots.write

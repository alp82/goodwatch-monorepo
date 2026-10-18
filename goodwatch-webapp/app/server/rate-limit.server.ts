// A per-client rate limit over one or more fixed windows, counted in Valkey so that every process on the same
// cluster shares the count: the page instances and the search roles all use the cluster in REDIS_HOST.
//
// - A request counts in every window only when it is allowed: a client that keeps knocking while limited doesn't
//   push its own wait further out. The answer is how long until the fullest window empties.
// - The keys of one client share a hash tag ({...}), so the script's keys sit on one slot of the cluster.
// - Without Valkey (no client, or a command failed or timed out) the count falls back to this process's memory:
//   each process then limits on its own, which is looser than the shared count but never off.
import { getRedisCluster } from "~/utils/cache"

export interface RateWindow {
	/** Requests allowed in the window. */
	limit: number
	seconds: number
}

export type RateVerdict =
	| { allowed: true; store: "valkey" | "memory" }
	| { allowed: false; store: "valkey" | "memory"; retryAfterSeconds: number }

export interface EvalClient {
	eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>
}

// KEYS: one counter per window. ARGV: the limit and the seconds of each window, in the keys' order, then the cost
// (1 when absent). Returns 0 when the request was counted, or the seconds to wait.
export const RATE_LIMIT_SCRIPT = `
local wait = 0
local cost = tonumber(ARGV[2 * #KEYS + 1] or '1')
for i, key in ipairs(KEYS) do
	local limit = tonumber(ARGV[2 * i - 1])
	local seconds = tonumber(ARGV[2 * i])
	local count = tonumber(redis.call('GET', key) or '0')
	if count + cost > limit then
		local ttl = redis.call('TTL', key)
		if ttl < 0 then
			redis.call('EXPIRE', key, seconds)
			ttl = seconds
		end
		if ttl > wait then wait = ttl end
	end
end
if wait > 0 then return wait end
for i, key in ipairs(KEYS) do
	if redis.call('INCRBY', key, cost) == cost then redis.call('EXPIRE', key, tonumber(ARGV[2 * i])) end
end
return 0
`

// The memory fallback holds at most this many counters; expired ones are swept first, and past the cap the
// oldest go (a forgotten counter only lets its client start over).
const MEMORY_KEYS = 50_000

export function createRateLimiter(
	options: { redis?: () => EvalClient | null; now?: () => number } = {},
) {
	const redis = options.redis ?? (() => getRedisCluster() as EvalClient | null)
	const now = options.now ?? Date.now
	const memory = new Map<string, { count: number; until: number }>()

	const keysOf = (name: string, client: string, windows: RateWindow[]) =>
		windows.map((window) => `${name}:{${client}}:${window.seconds}`)

	const inMemory = (keys: string[], windows: RateWindow[], cost: number): RateVerdict => {
		const at = now()
		let wait = 0
		const counters = keys.map((key) => {
			const counter = memory.get(key)
			return counter && counter.until > at ? counter : null
		})
		counters.forEach((counter, i) => {
			if (counter && counter.count + cost > windows[i].limit)
				wait = Math.max(wait, Math.ceil((counter.until - at) / 1000))
			else if (!counter && cost > windows[i].limit) wait = Math.max(wait, windows[i].seconds)
		})
		if (wait > 0) return { allowed: false, store: "memory", retryAfterSeconds: wait }
		if (memory.size + keys.length > MEMORY_KEYS) {
			for (const [key, counter] of memory) if (counter.until <= at) memory.delete(key)
			for (const key of memory.keys()) {
				if (memory.size + keys.length <= MEMORY_KEYS) break
				memory.delete(key)
			}
		}
		keys.forEach((key, i) => {
			const counter = counters[i]
			if (counter) counter.count += cost
			else memory.set(key, { count: cost, until: at + windows[i].seconds * 1000 })
		})
		return { allowed: true, store: "memory" }
	}

	return {
		/**
		 * Counts one request of `client` under `name`, or says how long it must wait. Never throws. `cost` counts the
		 * request as that many (a batch of writes); a cost above a window's limit is never allowed.
		 */
		async take(name: string, client: string, windows: RateWindow[], requested = 1): Promise<RateVerdict> {
			const cost = Math.max(1, Math.floor(requested))
			const keys = keysOf(name, client, windows)
			const valkey = redis()
			if (valkey) {
				try {
					const args = [...windows.flatMap((window) => [window.limit, window.seconds]), cost]
					const wait = Number(await valkey.eval(RATE_LIMIT_SCRIPT, keys.length, ...keys, ...args))
					if (Number.isFinite(wait))
						return wait > 0
							? { allowed: false, store: "valkey", retryAfterSeconds: wait }
							: { allowed: true, store: "valkey" }
				} catch {
					// Counted in memory below.
				}
			}
			return inMemory(keys, windows, cost)
		},
	}
}

export const rateLimiter = createRateLimiter()

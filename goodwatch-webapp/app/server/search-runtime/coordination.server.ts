import type { Cluster } from "ioredis"
import { getRedisCluster } from "~/utils/cache"

export type SearchRedis = Pick<Cluster, "get" | "set" | "eval">
const prefix = "{goodwatch-search-v2}"
const lease = `${prefix}:active`
const cache = (key: string) => `${prefix}:interpretation:${key}`
const lock = (key: string) => `${prefix}:lock:${key}`
const admission = (id: string) => `${prefix}:admission:${id}`

// All keys share a Redis Cluster slot. This is temporary coordination, not money accounting.
const admit = `
local clock = redis.call('TIME')
local now = clock[1] * 1000 + math.floor(clock[2] / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 30000)
if redis.call('EXISTS', KEYS[2]) == 1 or redis.call('ZCARD', KEYS[1]) >= 16 then return 'busy' end
for i = 5, #KEYS do
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', now - 60000)
  local reuse = i > 5 and redis.call('SISMEMBER', KEYS[3], KEYS[i]) == 1
  local limit = i == 5 and 240 or 20
  if not reuse and redis.call('ZCARD', KEYS[i]) >= limit then return 'rate' end
end
for i = 5, #KEYS do
  local reuse = i > 5 and redis.call('SISMEMBER', KEYS[3], KEYS[i]) == 1
  if not reuse then redis.call('ZADD', KEYS[i], now, ARGV[1]) end
  redis.call('PEXPIRE', KEYS[i], 120000)
  redis.call('SADD', KEYS[4], KEYS[i])
end
redis.call('PEXPIRE', KEYS[4], 60000)
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('PEXPIRE', KEYS[1], 60000)
redis.call('SET', KEYS[2], ARGV[1], 'PX', 30000)
return 'ok'
`

export class SearchCoordination {
	constructor(
		private readonly client: () => SearchRedis | null = getRedisCluster,
	) {}
	private required() {
		const redis = this.client()
		if (!redis) throw new Error("Search coordination unavailable")
		return redis
	}
	async cached(key: string) {
		return (
			this.client()
				?.get(cache(key))
				.catch(() => null) ?? null
		)
	}
	async cache(key: string, ciphertext: string) {
		// Crate retains the authoritative interpretation without expiry.
		await this.client()
			?.set(cache(key), ciphertext, "EX", 86400)
			.catch(() => {})
	}
	async claim(id: string, key: string, scopes: string[], prior?: string) {
		const unique = ["global", ...new Set(scopes.filter((s) => s !== "global"))]
		const keys = [
			lease,
			lock(key),
			admission(prior ?? "none"),
			admission(id),
			...unique.map((scope) => `${prefix}:rate:${scope}`),
		]
		return (await this.required().eval(admit, keys.length, ...keys, id)) as
			| "ok"
			| "busy"
			| "rate"
	}
	async dispatch(id: string, key: string) {
		const owned = await this.required().eval(
			`
      if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
      return redis.call('PEXPIRE', KEYS[1], 30000)
    `,
			1,
			lock(key),
			id,
		)
		if (owned !== 1) throw new Error("Search lease expired")
	}
	async release(id: string, key: string) {
		await this.client()
			?.eval(
				`
      redis.call('ZREM', KEYS[1], ARGV[1])
      if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]) end
    `,
				2,
				lease,
				lock(key),
				id,
			)
			.catch(() => {})
	}
}

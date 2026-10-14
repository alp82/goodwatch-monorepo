import type { Cluster } from "ioredis"
import type { SecondaryStorage } from "better-auth"

/** Single-key operations route correctly through ioredis Cluster. Never SCAN. */
export class ValkeyAuthStorage implements SecondaryStorage {
 private readonly client: () => Cluster | null
 constructor(client: () => Cluster | null) { this.client = client }
 private redis() {
  const client = this.client()
  if (!client) throw new Error("Auth secondary storage unavailable")
  return client
 }
 private key(key: string) { return `gw:auth:${key}` }
 async get(key: string) { return this.redis().get(this.key(key)) }
 async set(key: string, value: string, ttl = 90 * 86400) {
  await this.redis().set(this.key(key), value, "EX", Math.max(1, Math.ceil(ttl)))
 }
 async delete(key: string) { await this.redis().del(this.key(key)) }
 async getAndDelete(key: string) { return this.redis().getdel(this.key(key)) }
 async increment(key: string, ttl: number) {
  return Number(await this.redis().eval(
   "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n",
   1, this.key(key), Math.max(1, Math.ceil(ttl)),
  ))
 }
}

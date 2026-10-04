// In-memory Redis commands, including the atomic semantics of cacheScripts.
export class CacheTestRedis {
	values = new Map<string, string>()
	calls: { command: string; args: unknown[] }[] = []
	reads = 0
	deletes = 0
	writes: { key: string; ttl: number }[] = []
	failDelete = false
	async get(key: string): Promise<string | null> {
		this.calls.push({ command: "get", args: [key] })
		this.reads++
		return this.values.get(key) ?? null
	}
	async mget(...keys: string[]): Promise<(string | null)[]> {
		this.calls.push({ command: "mget", args: keys })
		this.reads++
		return keys.map((key) => this.values.get(key) ?? null)
	}
	async setex(key: string, ttl: number, value: string): Promise<void> {
		this.calls.push({ command: "setex", args: [key, ttl, value] })
		this.writes.push({ key, ttl })
		this.values.set(key, value)
	}
	async del(key: string): Promise<number> {
		this.calls.push({ command: "del", args: [key] })
		this.deletes++
		if (this.failDelete) throw new Error("Redis down")
		return Number(this.values.delete(key))
	}
	async gwCacheStore(
		key: string,
		marker: string,
		expected: string,
		ttl: number,
		value: string,
	): Promise<number> {
		this.calls.push({
			command: "gwCacheStore",
			args: [key, marker, expected, ttl, value],
		})
		if ((this.values.get(marker) ?? "") !== expected) return 0
		this.writes.push({ key, ttl })
		this.values.set(key, value)
		return 1
	}
	async gwCacheReset(
		key: string,
		marker: string,
		token: string,
		ttl: number,
	): Promise<number> {
		this.calls.push({
			command: "gwCacheReset",
			args: [key, marker, token, ttl],
		})
		this.deletes++
		if (this.failDelete) throw new Error("Redis down")
		this.values.set(marker, token)
		return Number(this.values.delete(key))
	}
}

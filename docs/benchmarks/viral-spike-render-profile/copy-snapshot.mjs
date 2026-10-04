// Copies the title snapshot keys from the production Redis cluster (read-only: SCAN, GETBUFFER, PTTL) into the
// measurement instance's own Redis. Run inside the measurement image.
import Redis from "ioredis"
const prod = new Redis.Cluster(
	[process.env.PROD_REDIS_HOST, process.env.PROD_REDIS_HOST2, process.env.PROD_REDIS_HOST3].map((host) => ({ host, port: Number(process.env.PROD_REDIS_PORT) })),
	{ dnsLookup: (a, cb) => cb(null, a), redisOptions: { password: process.env.PROD_REDIS_PASS } },
)
const local = new Redis.Cluster([{ host: process.env.LOCAL_REDIS_HOST ?? "172.31.251.10", port: 6379 }], { dnsLookup: (a, cb) => cb(null, a), redisOptions: { password: "bench" } })
await Promise.all([prod, local].map((c) => (c.status === "ready" ? null : new Promise((resolve, reject) => { c.once("ready", resolve); c.once("error", reject) }))))
const patterns = (process.argv[2] ?? "title-snapshot:*").split(",")
let keys = 0, bytes = 0
for (const node of prod.nodes("master")) {
	for (const match of patterns) {
		let cursor = "0"
		do {
			const [next, found] = await node.scan(cursor, "MATCH", match, "COUNT", 5000)
			cursor = next
			for (const key of found) {
				const value = await prod.getBuffer(key)
				if (!value) continue
				await local.set(key, value)
				keys++
				bytes += value.length
			}
		} while (cursor !== "0")
	}
}
console.log(JSON.stringify({ patterns, keys, megabytes: Math.round(bytes / 1e5) / 10 }))
prod.disconnect(); local.disconnect()

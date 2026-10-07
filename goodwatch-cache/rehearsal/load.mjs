// Fills the rehearsal cluster: KEYS entries with an expiry and SNAPSHOT_CHUNKS entries of
// 1 MB without one. With START=<KEYS> and DENSE_SLOTS set, it writes only the dense keys.
// Usage: REDIS_HOSTS=a,b,c REDIS_PASS=... node load.mjs
import crypto from "node:crypto"
import { KEYS, Redis, SNAPSHOT_CHUNKS, TOTAL, chunkKeyOf, keyOf, startupNodes, ttlOf, valueOf } from "./common.mjs"

const cluster = new Redis.Cluster(startupNodes, {
	dnsLookup: (address, callback) => callback(null, address),
	redisOptions: { password: process.env.REDIS_PASS || "" },
})
const started = Date.now()
const START = Number(process.env.START || 0)
let next = START
let bytes = 0
async function worker() {
	while (next < TOTAL) {
		const i = next++
		const value = valueOf(i)
		bytes += value.length
		await cluster.setex(keyOf(i), ttlOf(i), value)
	}
}
// Eight writers keep the load on a shared host low.
await Promise.all(Array.from({ length: 8 }, worker))
for (let n = 0; START === 0 && n < SNAPSHOT_CHUNKS; n++) {
	const chunk = crypto.randomBytes(1024 * 1024)
	bytes += chunk.length
	await cluster.set(chunkKeyOf(n), chunk)
}
console.log(JSON.stringify({ keys: TOTAL - START, chunks: START === 0 ? SNAPSHOT_CHUNKS : 0, megabytes: Math.round(bytes / 1e6), seconds: (Date.now() - started) / 1000 }))
cluster.disconnect()

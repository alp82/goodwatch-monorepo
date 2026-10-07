// Shows what the webapp's client sees for keys in a slot that is left open (migrating on
// the source, importing on the target) after an interrupted move.
// Usage: REDIS_HOSTS=a,b,c REDIS_PASS=... node open-slot.mjs <key on the source> [<key on the target>]
import { REDIS_COMMAND_TIMEOUT_MS, Redis, markerKeyOf, redisOptions, startupNodes } from "./common.mjs"

const cluster = new Redis.Cluster(startupNodes, redisOptions)
await cluster.connect()
async function show(label, run) {
	const started = performance.now()
	const operation = run().then((value) => `ok (${Array.isArray(value) ? value.map((v) => (v === null ? "null" : `${v.length} chars`)) : value === null ? "null" : `${String(value).length} chars`})`, (error) => `error: ${error.message}`)
	// The webapp gives up after 1 second and runs the target (withRedisDeadline in cache.ts).
	const deadline = new Promise((resolve) => setTimeout(() => resolve(null), REDIS_COMMAND_TIMEOUT_MS))
	const atDeadline = await Promise.race([operation, deadline])
	const afterDeadline = Math.round(performance.now() - started)
	const final = await operation
	console.log(`${label}: ${atDeadline === null ? `no answer after ${afterDeadline} ms (webapp deadline), then ` : ""}${final} after ${Math.round(performance.now() - started)} ms`)
}
for (const key of process.argv.slice(2)) {
	await show(`GET ${key}`, () => cluster.get(key))
	await show(`MGET ${key} + missing reset marker`, () => cluster.mget(key, markerKeyOf(key)))
	await show(`gwCacheStore-style read of the marker (GET marker)`, () => cluster.get(markerKeyOf(key)))
}
await show("MGET of two missing keys in one slot", () => cluster.mget("cached-none:{open-slot-probe}", "cached-reset:{open-slot-probe}"))
cluster.disconnect()

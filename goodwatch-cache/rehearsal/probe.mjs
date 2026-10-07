// A client loop for the rehearsal: reads and writes through an ioredis 5.4.1 Cluster with
// the webapp's options, its two Lua scripts, its 1-second deadline, and a copy of its
// per-node breaker. Prints one JSON line per second with what the client saw.
// Usage: REDIS_HOSTS=a,b,c REDIS_PASS=... RATE=300 node probe.mjs >> probe.log
import {
	KEYS, REDIS_COMMAND_TIMEOUT_MS, Redis, SNAPSHOT_CHUNKS, TOTAL, checkValue, chunkKeyOf, isCard, keyOf,
	markerKeyOf, redisOptions, startupNodes, ttlOf, valueOf,
} from "./common.mjs"

const RATE = Number(process.env.RATE || 300)
const BREAKER_OPEN_MS = 1000
// The share of operations that go to the dense slots, when the cluster has them.
const DENSE_SHARE = TOTAL > KEYS ? Number(process.env.DENSE_SHARE || 0.5) : 0

// Counts the redirects that ioredis follows by itself and never shows to its caller.
const seen = { moved: 0, ask: 0, tryagain: 0, clusterDown: 0, connectionClosed: 0, maxRedirections: 0 }
const originalHandleError = Redis.Cluster.prototype.handleError
Redis.Cluster.prototype.handleError = function (error, ttl, handlers) {
	const counted = {}
	for (const [name, handler] of Object.entries(handlers)) {
		counted[name] = (...args) => {
			if (name in seen) seen[name]++
			return handler(...args)
		}
	}
	return originalHandleError.call(this, error, ttl, counted)
}

// The breaker and the guard follow goodwatch-webapp/app/utils/redis-breaker.ts and the
// GuardedCluster class in cache.ts.
class NodeDownError extends Error {
	name = "RedisNodeDownError"
}
const breakers = new Map()
const events = { opened: 0, closed: 0, probe_failed: 0, rejected: 0 }
const state = (node) => breakers.get(node) ?? breakers.set(node, { open: false, openedAt: 0, probing: false }).get(node)
function failure(node) {
	const s = state(node)
	if (s.open) return
	s.open = true
	s.openedAt = Date.now()
	events.opened++
	console.log(JSON.stringify({ t: new Date().toISOString(), breaker: "opened", node }))
}
function probeFailed(node) {
	const s = state(node)
	s.open = true
	s.probing = false
	s.openedAt = Date.now()
	events.probe_failed++
}
function success(node) {
	const s = state(node)
	const wasOpen = s.open
	s.open = false
	s.probing = false
	if (wasOpen) {
		events.closed++
		console.log(JSON.stringify({ t: new Date().toISOString(), breaker: "closed", node }))
	}
}
function isNodeFailure(error) {
	if (error instanceof NodeDownError) return false
	if (typeof error !== "object" || error === null) return true
	return !(error.name === "ReplyError" && typeof error.message === "string" && !/^(CLUSTERDOWN|LOADING|MASTERDOWN|TRYAGAIN)/.test(error.message))
}
class GuardedCluster extends Redis.Cluster {
	sendCommand(command, stream, node) {
		const slot = node ? node.slot : command.getSlot()
		const owner = command.name === "cluster" || slot == null ? undefined : this.slots[slot]?.[0]
		if (!owner) return super.sendCommand(command, stream, node)
		const s = breakers.get(owner)
		if (s?.open) {
			const key = command.getKeys()[0]
			if (key && !s.probing && Date.now() - s.openedAt >= BREAKER_OPEN_MS) {
				s.probing = true
				const probe = new Redis.Command("exists", [key])
				this.track(probe, undefined, undefined, owner, true)
				probe.promise.catch(() => {})
			}
			events.rejected++
			command.reject(new NodeDownError("Redis node is marked down"))
			return command.promise
		}
		return this.track(command, stream, node, owner, false)
	}
	track(command, stream, node, owner, probe) {
		let settled = false
		let timedOut = false
		const fail = () => (probe ? probeFailed(owner) : failure(owner))
		const timer = setTimeout(() => {
			if (settled) return
			timedOut = true
			fail()
			command.reject(new Error("Command timed out"))
		}, REDIS_COMMAND_TIMEOUT_MS)
		command.promise.then(
			() => { settled = true; clearTimeout(timer); success(owner) },
			(error) => {
				settled = true
				clearTimeout(timer)
				if (timedOut || error instanceof NodeDownError) return
				if (isNodeFailure(error)) fail()
				else success(owner)
			},
		).catch(() => {})
		try {
			super.sendCommand(command, stream, node)
		} catch (error) {
			command.reject(error)
		}
		return command.promise
	}
}

const cluster = new GuardedCluster(startupNodes, redisOptions)
cluster.on("error", (error) => console.log(JSON.stringify({ t: new Date().toISOString(), clusterError: String(error.message).slice(0, 200) })))
cluster.on("end", () => { console.log(JSON.stringify({ t: new Date().toISOString(), clusterEnded: true })); process.exit(2) })
await cluster.connect()

let latencies = []
let outcomes = {}
const count = (name) => { outcomes[name] = (outcomes[name] || 0) + 1 }
async function timed(kind, run, verify) {
	const started = performance.now()
	try {
		const result = await run()
		count(verify(result) ? `${kind}:ok` : `${kind}:wrong`)
	} catch (error) {
		const message = String(error?.message || error)
		count(`${kind}:error:${error instanceof NodeDownError ? "open" : message.split(/[ :]/)[0].slice(0, 24)}`)
		if (!(error instanceof NodeDownError)) count(`errorText:${message.slice(0, 80)}`)
	}
	latencies.push(performance.now() - started)
}
function one() {
	const i = Math.random() < DENSE_SHARE ? KEYS + Math.floor(Math.random() * (TOTAL - KEYS)) : Math.floor(Math.random() * KEYS)
	const key = keyOf(i)
	const roll = Math.random() * 100
	// Plain caches read with GET. A missing key counts as right: the value can have been evicted.
	if (roll < 55) return timed("get", () => cluster.get(key), (v) => v === null || checkValue(i, v))
	// Resettable caches read the value and its reset marker in one MGET.
	if (roll < 72) return timed("mget", () => cluster.mget(key, markerKeyOf(key)), (v) => (v[0] === null || checkValue(i, v[0])) && v[1] === null)
	if (roll < 84) return timed("setex", () => cluster.setex(key, ttlOf(i), valueOf(i)), (v) => v === "OK")
	// Resettable caches store through the script, which reads the marker first.
	if (roll < 92) return timed("store", () => cluster.gwCacheStore(key, markerKeyOf(key), "", ttlOf(i), valueOf(i)), (v) => v === 1)
	if (roll < 96 && isCard(i)) return timed("getBuffer", () => cluster.getBuffer(key), (v) => v === null || v.length === valueOf(i).length)
	if (roll < 99) {
		const n = Math.floor(Math.random() * SNAPSHOT_CHUNKS)
		return timed("chunk", () => cluster.getBuffer(chunkKeyOf(n)), (v) => v !== null && v.length === 1024 * 1024)
	}
	// A reset on its own key range, so that it never deletes a value another read checks.
	const resetKey = `cached-reset-probe:${i % 500}`
	return timed("reset", () => cluster.gwCacheReset(resetKey, markerKeyOf(resetKey), String(Date.now()), 60), (v) => v === 0 || v === 1)
}

const quantile = (sorted, q) => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] * 100) / 100 : null)
setInterval(() => { for (let n = 0; n < RATE / 20; n++) one() }, 50)
setInterval(() => {
	const sorted = latencies.sort((a, b) => a - b)
	console.log(JSON.stringify({
		t: new Date().toISOString(), ops: sorted.length,
		p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95), p99: quantile(sorted, 0.99), max: quantile(sorted, 1),
		over100: sorted.filter((ms) => ms >= 100).length, over1000: sorted.filter((ms) => ms >= 1000).length,
		redirects: { ...seen }, breaker: { ...events }, outcomes,
	}))
	latencies = []
	outcomes = {}
	for (const name of Object.keys(seen)) seen[name] = 0
	for (const name of Object.keys(events)) events[name] = 0
}, 1000)

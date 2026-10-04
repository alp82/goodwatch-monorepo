import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { afterEach, beforeEach, test } from "node:test"
// Load CommonJS dependencies before the alias hook rewrites relative imports.
import { Command } from "ioredis"
import "../server/title-filter/test-alias.ts"
const {
	GuardedCluster,
	cacheScripts,
	declareResettableCache,
	resetPendingResetsForTest,
	cached,
	cacheEntryKey,
	getRedisCluster,
	resetCache,
	redisBreakerStates,
	resetRedisBreakersForTest,
	setRedisClusterForTest,
	setRedisCommandTimeoutForTest,
	startRedisClusterForTest,
	stopRedisClusterForTest,
	isRedisNodeFailure,
} = await import("./cache.ts")
const { RedisNodeDownError } = await import("./redis-breaker.ts")
const { renderMetrics, resetMetricsForTest } = await import(
	"../server/metrics/registry.server.ts"
)
const pause = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))
const owners = ["fake-a:1", "fake-b:2", "fake-c:3"]
const ownerFor = (key: string) =>
	owners[
		Math.min(2, Math.floor((new Command("get", [key]).getSlot() ?? 0) / 5461))
	]
const unhandled: unknown[] = []
const onUnhandled = (error: unknown) => unhandled.push(error)
beforeEach(() => {
	declareResettableCache({ name: "guard", ttlMinutes: 1 })
	resetPendingResetsForTest()
	resetRedisBreakersForTest()
	resetMetricsForTest()
	unhandled.length = 0
	process.on("unhandledRejection", onUnhandled)
})
afterEach(async () => {
	resetPendingResetsForTest()
	stopRedisClusterForTest()
	setRedisCommandTimeoutForTest(null)
	await pause()
	process.off("unhandledRejection", onUnhandled)
	assert.deepEqual(unhandled, [])
})

class FakeCluster extends GuardedCluster {
	mode: "silent" | "stopped" | "healthy" | "reply" = "healthy"
	reply = "WRONGTYPE bad type"
	store = new Map<string, string>()
	commands: Command[] = []
	constructor() {
		super([], { lazyConnect: true, scripts: cacheScripts })
		this.status = "ready"
		for (let slot = 0; slot < 16384; slot++)
			this.slots[slot] = [owners[Math.min(2, Math.floor(slot / 5461))]]
	}
	protected dispatch(command: Command): unknown {
		this.commands.push(command)
		const key = command.getKeys()[0]?.toString()
		if (key && ownerFor(key) === owners[0]) {
			if (this.mode === "silent") return command.promise
			if (this.mode === "stopped") {
				command.reject(new Error("Connection is closed."))
				return command.promise
			}
			if (this.mode === "reply") {
				const error = new Error(this.reply)
				error.name = "ReplyError"
				command.reject(error)
				return command.promise
			}
		}
		if (command.name === "mget")
			command.resolve(
				command.args.map((key) => this.store.get(String(key)) ?? null),
			)
		else if (command.name === "get")
			command.resolve(this.store.get(key ?? "") ?? null)
		else if (command.name === "setex") {
			this.store.set(key ?? "", String(command.args[2]))
			command.resolve("OK")
		} else if (command.name === "eval" || command.name === "evalsha") {
			const [, , valueKey, markerKey, token, , value] = command.args.map(String)
			if (command.args.length === 7) {
				if ((this.store.get(markerKey) ?? "") !== token) command.resolve(0)
				else {
					this.store.set(valueKey, value)
					command.resolve(1)
				}
			} else {
				this.store.set(markerKey, token)
				command.resolve(Number(this.store.delete(valueKey)))
			}
		} else command.resolve(1)
		return command.promise
	}
}
function paramsFor(owner: string, count = 1) {
	const params: { id: number }[] = []
	for (let id = 0; params.length < count; id++) {
		if (ownerFor(cacheEntryKey("guard", { id })) === owner) params.push({ id })
	}
	return params
}
const lookup = (params: { id: number }) =>
	cached({
		name: "guard",
		params,
		ttlMinutes: 1,
		target: async () => ({ answer: 42 }),
	})
async function fast<T>(run: () => Promise<T>): Promise<T> {
	const start = performance.now()
	const value = await run()
	assert.ok(
		performance.now() - start < 50,
		`elapsed ${performance.now() - start} ms`,
	)
	return value
}
function metric(line: string) {
	assert.ok(
		renderMetrics().split("\n").includes(line),
		`${line}\n${renderMetrics()}`,
	)
}

test("silent owner costs one second once; later cache lookups fail fast through probes and recover", async (t) => {
	t.mock.method(console, "warn", () => {})
	const cluster = new FakeCluster()
	cluster.mode = "silent"
	setRedisClusterForTest(cluster)
	const params = paramsFor(owners[0], 25)
	const start = performance.now()
	assert.deepEqual(await lookup(params[0]), { answer: 42 })
	assert.ok(performance.now() - start >= 990)
	assert.ok(performance.now() - start < 1500)
	metric('goodwatch_data_cache_requests_total{cache="guard",result="error"} 1')
	metric("goodwatch_redis_breaker_open_nodes 1")
	for (let i = 0; i < 20; i++) {
		if (i === 10) await pause(1010)
		assert.deepEqual(await fast(() => lookup(params[i])), { answer: 42 })
	}
	metric('goodwatch_data_cache_requests_total{cache="guard",result="open"} 20')
	assert.equal(
		cluster.commands.filter((cmd) => cmd.name === "exists").length,
		1,
	)
	for (const owner of owners.slice(1)) {
		const [healthy] = paramsFor(owner)
		await fast(() => lookup(healthy))
		await fast(() => lookup(healthy))
	}
	metric('goodwatch_data_cache_requests_total{cache="guard",result="miss"} 2')
	metric('goodwatch_data_cache_requests_total{cache="guard",result="hit"} 2')
	assert.deepEqual(
		redisBreakerStates().filter((state) => state.open),
		[{ node: owners[0], open: true }],
	)
	await pause(1010)
	metric(
		'goodwatch_redis_breaker_events_total{node="fake-a:1",event="probe_failed"} 1',
	)
	await fast(() => lookup(params[20]))
	assert.equal(
		cluster.commands.filter((cmd) => cmd.name === "exists").length,
		1,
	)
	cluster.mode = "healthy"
	await pause(1010)
	await fast(() => lookup(params[21]))
	metric("goodwatch_redis_breaker_open_nodes 0")
	metric(
		'goodwatch_redis_breaker_events_total{node="fake-a:1",event="opened"} 1',
	)
	metric(
		'goodwatch_redis_breaker_events_total{node="fake-a:1",event="closed"} 1',
	)
	metric(
		'goodwatch_redis_breaker_events_total{node="fake-a:1",event="rejected"} 22',
	)
	await fast(() => lookup(params[22]))
	await fast(() => lookup(params[22]))
	metric('goodwatch_data_cache_requests_total{cache="guard",result="miss"} 3')
	metric('goodwatch_data_cache_requests_total{cache="guard",result="hit"} 3')
	assert.equal(
		cluster.commands.filter((cmd) => cmd.name === "exists").length,
		2,
	)
})

test("stopped owner rejects once, then pipelines and resetCache reject immediately without dispatch", async () => {
	const cluster = new FakeCluster()
	cluster.mode = "stopped"
	setRedisClusterForTest(cluster)
	const [params] = paramsFor(owners[0])
	const key = cacheEntryKey("guard", params)
	await fast(() => assert.rejects(cluster.get(key), /Connection is closed/))
	assert.equal(redisBreakerStates()[0].open, true)
	let tag = 0
	while (ownerFor(`{${tag}}a`) !== owners[0]) tag++
	const before = cluster.commands.length
	const results = await fast(() =>
		cluster.pipeline().get(`{${tag}}a`).get(`{${tag}}b`).exec(),
	)
	assert.equal(results?.length, 2)
	for (const [error] of results ?? [])
		assert.ok(error instanceof RedisNodeDownError)
	assert.equal(await fast(() => resetCache({ name: "guard", params })), 0)
	assert.equal(cluster.commands.length, before)
	metric(
		'goodwatch_redis_breaker_events_total{node="fake-a:1",event="rejected"} 3',
	)
})

test("live replies preserve errors without opening; unavailable replies open", async () => {
	for (const reply of [
		"WRONGTYPE wrong",
		"ERR invalid",
		"CLUSTERDOWN unavailable",
		"LOADING busy",
		"MASTERDOWN unavailable",
		"TRYAGAIN busy",
	]) {
		resetRedisBreakersForTest()
		const cluster = new FakeCluster()
		cluster.mode = "reply"
		cluster.reply = reply
		const key = cacheEntryKey("guard", paramsFor(owners[0])[0])
		await assert.rejects(cluster.get(key), {
			name: "ReplyError",
			message: reply,
		})
		assert.equal(redisBreakerStates()[0].open, !/^(WRONGTYPE|ERR)/.test(reply))
	}
	assert.equal(isRedisNodeFailure(new RedisNodeDownError("a")), false)
	assert.equal(isRedisNodeFailure(new Error("timeout")), true)
})

test("direct getBuffer and eval commands share the guard; keyless and cluster commands bypass it", async () => {
	const cluster = new FakeCluster()
	cluster.mode = "stopped"
	const key = cacheEntryKey("guard", paramsFor(owners[0])[0])
	await assert.rejects(cluster.eval("return 1", 1, key), /Connection is closed/)
	await assert.rejects(cluster.getBuffer(key), RedisNodeDownError)
	await cluster.ping()
	await cluster.cluster("INFO")
	assert.deepEqual(
		cluster.commands.map((command) => command.name),
		["eval", "ping", "cluster"],
	)
})

test("a late in-flight answer closes an open breaker and keeps the original value", async () => {
	const cluster = new FakeCluster()
	cluster.mode = "silent"
	const key = cacheEntryKey("guard", paramsFor(owners[0])[0])
	const pending = cluster.get(key)
	cluster.mode = "stopped"
	await assert.rejects(cluster.get(key))
	assert.equal(redisBreakerStates()[0].open, true)
	cluster.commands[0].resolve("late answer")
	assert.equal(await pending, "late answer")
	assert.equal(redisBreakerStates()[0].open, false)
})

class FakeClient extends EventEmitter {
	disconnects = 0
	fail = false
	connects = 0
	async connect() {
		this.connects++
		assert.ok(this.listenerCount("error") > 0)
		if (this.fail) throw new Error("connect failed")
		this.emit("ready")
	}
	disconnect() {
		this.disconnects++
		this.emit("end")
	}
}

test("failed first connect retries; ready/end retire clients; error only logs; stale listeners do nothing", async (t) => {
	t.mock.method(console, "warn", () => {})
	const clients: FakeClient[] = []
	startRedisClusterForTest(() => {
		for (const previous of clients) assert.equal(previous.disconnects, 1)
		const client = new FakeClient()
		client.fail = clients.length === 0
		clients.push(client)
		return client
	}, [10, 20])
	await pause(1)
	assert.equal(getRedisCluster(), null)
	metric("goodwatch_redis_client_ready 0")
	assert.equal(clients[0].disconnects, 1)
	await pause(25)
	assert.equal(clients.length, 2)
	assert.equal(getRedisCluster(), clients[1])
	metric("goodwatch_redis_client_ready 1")
	clients[1].emit("error", new Error("connection timeout closed"))
	await pause(25)
	assert.equal(clients.length, 2)
	clients[1].emit("end")
	assert.equal(getRedisCluster(), null)
	assert.equal(clients[1].disconnects, 1)
	clients[1].emit("ready")
	clients[1].emit("end")
	clients[1].emit("error", new Error("old error"))
	assert.equal(getRedisCluster(), null)
	await pause(25)
	assert.equal(clients.length, 3)
	assert.equal(getRedisCluster(), clients[2])
	metric('goodwatch_redis_client_events_total{event="connect_failed"} 1')
	metric('goodwatch_redis_client_events_total{event="ended"} 1')
	metric('goodwatch_redis_client_events_total{event="ready"} 2')
	stopRedisClusterForTest()
	assert.equal(clients[2].disconnects, 1)
	await pause(25)
	assert.equal(clients.length, 3)
	metric("goodwatch_redis_client_ready 0")
})

test("open lookups deduplicate targets and suppress get, set and delete logs", async (t) => {
	const warn = t.mock.method(console, "warn", () => {})
	const cluster = new FakeCluster()
	cluster.mode = "stopped"
	setRedisClusterForTest(cluster)
	const [params] = paramsFor(owners[0])
	await assert.rejects(cluster.get(cacheEntryKey("guard", params)))
	let finish: (value: { answer: number }) => void = () => {}
	const pending = new Promise<{ answer: number }>((resolve) => {
		finish = resolve
	})
	let runs = 0
	const calls = Array.from({ length: 10 }, () =>
		cached({
			name: "guard",
			params,
			ttlMinutes: 1,
			target: () => {
				runs++
				return pending
			},
		}),
	)
	await pause()
	assert.equal(runs, 1)
	finish({ answer: 42 })
	assert.deepEqual(
		await Promise.all(calls),
		Array.from({ length: 10 }, () => ({ answer: 42 })),
	)
	assert.equal(await resetCache({ name: "guard", params }), 0)
	assert.equal(warn.mock.callCount(), 0)
	metric('goodwatch_data_cache_requests_total{cache="guard",result="open"} 1')
	metric('goodwatch_data_cache_requests_total{cache="guard",result="joined"} 9')
	// Client replacement does not erase node knowledge.
	const replacement = new FakeCluster()
	await assert.rejects(
		replacement.get(cacheEntryKey("guard", params)),
		RedisNodeDownError,
	)
	assert.equal(replacement.commands.length, 0)
})

test("direct silent commands use the configured deadline and ignore late rejection", async () => {
	setRedisCommandTimeoutForTest(20)
	const cluster = new FakeCluster()
	cluster.mode = "silent"
	const key = cacheEntryKey("guard", paramsFor(owners[0])[0])
	const start = performance.now()
	await assert.rejects(cluster.getBuffer(key), { message: "Command timed out" })
	assert.ok(performance.now() - start >= 15)
	assert.ok(performance.now() - start < 500)
	cluster.commands[0].reject(new Error("late connection failure"))
	await pause()
	metric(
		'goodwatch_redis_breaker_events_total{node="fake-a:1",event="opened"} 1',
	)
})

test("reconnect backoff doubles, caps at 30 seconds, resets at ready, and cancels on stop", async (t) => {
	t.mock.method(console, "warn", () => {})
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const clients: FakeClient[] = []
	let fail = true
	startRedisClusterForTest(() => {
		assert.ok(clients.every((client) => client.disconnects === 1))
		const client = new FakeClient()
		client.fail = fail
		clients.push(client)
		return client
	})
	await Promise.resolve()
	for (const delay of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) {
		const before = clients.length
		t.mock.timers.tick(delay - 1)
		assert.equal(clients.length, before)
		t.mock.timers.tick(1)
		await Promise.resolve()
		assert.equal(clients.length, before + 1)
	}
	fail = false
	t.mock.timers.tick(30000)
	await Promise.resolve()
	const ready = clients.at(-1)
	assert.equal(getRedisCluster(), ready)
	ready?.emit("end")
	const before = clients.length
	t.mock.timers.tick(999)
	assert.equal(clients.length, before)
	t.mock.timers.tick(1)
	assert.equal(clients.length, before + 1)
	clients.at(-1)?.emit("end")
	stopRedisClusterForTest()
	t.mock.timers.tick(30000)
	assert.equal(clients.length, before + 1)
	// Restore real timers before the shared afterEach flushes the event loop.
	t.mock.timers.reset()
})

test("end during connect schedules only one retry and late connect rejection cannot retire its replacement", async (t) => {
	t.mock.method(console, "warn", () => {})
	let rejectConnect: (error: Error) => void = () => {}
	const old = new FakeClient()
	old.connect = () =>
		new Promise<void>((_resolve, reject) => {
			rejectConnect = reject
		})
	const replacement = new FakeClient()
	let creates = 0
	startRedisClusterForTest(() => (++creates === 1 ? old : replacement), [5])
	assert.equal(getRedisCluster(), null)
	old.emit("end")
	old.emit("end")
	await pause(15)
	assert.equal(getRedisCluster(), replacement)
	rejectConnect(new Error("late failure"))
	old.emit("ready")
	await pause(15)
	assert.equal(getRedisCluster(), replacement)
	assert.equal(creates, 2)
	assert.equal(old.disconnects, 1)
	assert.equal(replacement.disconnects, 0)
})

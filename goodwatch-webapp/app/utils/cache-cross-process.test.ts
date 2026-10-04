// Two real Node processes against a real three-node Valkey cluster: a reset in one must stop the
// other from storing or serving the pre-reset value. Skipped unless GW_TEST_VALKEY_NODES names a
// throwaway cluster (never production: the test pauses clients and can kill a node), for example
// GW_TEST_VALKEY_NODES=10.9.0.2:6379,10.9.0.3:6379,10.9.0.4:6379 GW_TEST_VALKEY_PASSWORD=...
// GW_TEST_VALKEY_CONTAINERS=name1,name2,name3 node --test app/utils/cache-cross-process.test.ts
// The container names (same order as the nodes) enable the append-only file case.
import assert from "node:assert/strict"
import { execFile, fork } from "node:child_process"
import { randomBytes } from "node:crypto"
import { once } from "node:events"
import { test } from "node:test"
import { promisify } from "node:util"
import Redis, { type Cluster } from "ioredis"
import "../server/title-filter/test-alias.ts"
import type { WorkerRequest } from "./cache-cross-process.worker.ts"
// The parent uses only the explicitly configured throwaway cluster.
process.env.REDIS_HOST = ""
const {
	cacheEntryKey,
	cacheResetMarkerKey,
	cachePhysicalTtlSeconds,
	serializeCacheEntry,
} = await import("./cache.ts")
const nodes = process.env.GW_TEST_VALKEY_NODES
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(check: () => Promise<boolean>, timeout = 12_000) {
	const deadline = Date.now() + timeout
	while (!(await check())) {
		assert.ok(Date.now() < deadline, "condition timed out")
		await sleep(50)
	}
}
function worker(env: NodeJS.ProcessEnv) {
	const child = fork(
		new URL("./cache-cross-process.worker.ts", import.meta.url),
		[],
		{
			env,
			execArgv: process.execArgv.filter((arg) => !arg.startsWith("--test")),
			stdio: ["ignore", "inherit", "inherit", "ipc"],
		},
	)
	let sequence = 0
	const replies = new Map<
		number,
		{ resolve: (value: unknown) => void; reject: (error: Error) => void }
	>()
	const started = new Set<string>()
	child.on(
		"message",
		(reply: {
			id?: number
			started?: string
			value?: unknown
			error?: string
		}) => {
			if (reply.started) started.add(reply.started)
			if (reply.id !== undefined) {
				const pending = replies.get(reply.id)
				replies.delete(reply.id)
				if (reply.error) pending?.reject(new Error(reply.error))
				else pending?.resolve(reply.value)
			}
		},
	)
	child.on("exit", () => {
		for (const pending of replies.values())
			pending.reject(new Error("Worker exited"))
		replies.clear()
	})
	async function request(message: Omit<WorkerRequest, "id">): Promise<unknown> {
		const id = ++sequence
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				replies.delete(id)
				reject(new Error(`Worker ${message.command} timed out`))
			}, 15_000)
			replies.set(id, {
				resolve: (value) => {
					clearTimeout(timer)
					resolve(value)
				},
				reject: (error) => {
					clearTimeout(timer)
					reject(error)
				},
			})
			child.send({ ...message, id })
		})
	}
	return {
		request,
		started: (gate: string) => until(async () => started.has(gate)),
		stop: async () => {
			if (child.exitCode !== null || child.signalCode !== null) return
			const exited = once(child, "exit")
			child.kill("SIGKILL")
			await exited
		},
	}
}
const tracked = [
	"get",
	"mget",
	"evalsha",
	"eval",
	"setex",
	"set",
	"del",
] as const
type Counts = Record<(typeof tracked)[number], number>
async function commandstats(cluster: Cluster): Promise<Counts> {
	const counts = Object.fromEntries(tracked.map((name) => [name, 0])) as Counts
	for (const master of cluster.nodes("master")) {
		const info = await master.info("commandstats")
		for (const name of tracked)
			counts[name] += Number(
				info.match(new RegExp(`cmdstat_${name}:calls=(\\d+)`))?.[1] ?? 0,
			)
	}
	return counts
}
function delta(before: Counts, after: Counts): Counts {
	return Object.fromEntries(
		tracked.map((name) => [name, after[name] - before[name]]),
	) as Counts
}
function metric(
	text: unknown,
	cache: string,
	kind: "requests" | "refreshes" | "reset_guard",
	label: string,
	value = 1,
) {
	assert.ok(
		String(text).includes(
			`goodwatch_data_cache_${kind}_total{cache="${cache}",${kind === "reset_guard" ? "event" : "result"}="${label}"} ${value}\n`,
		),
		String(text),
	)
}

test(
	"cross-process cache reset guards on a throwaway Valkey cluster",
	{ skip: !nodes, timeout: 90_000 },
	async (t) => {
		const addresses = (nodes ?? "").split(",").map((node) => {
			const [host, port] = node.split(":")
			return { host, port: Number(port) }
		})
		assert.equal(addresses.length, 3)
		assert.ok(addresses.every((node) => node.port === addresses[0].port))
		const env = {
			...process.env,
			REDIS_HOST: addresses[0].host,
			REDIS_HOST2: addresses[1].host,
			REDIS_HOST3: addresses[2].host,
			REDIS_PORT: String(addresses[0].port),
			REDIS_PASS: process.env.GW_TEST_VALKEY_PASSWORD ?? "",
		}
		const cluster = new Redis.Cluster(addresses, {
			lazyConnect: true,
			clusterRetryStrategy: () => null,
			redisOptions: {
				password: env.REDIS_PASS,
				connectTimeout: 1000,
				commandTimeout: 3000,
				maxRetriesPerRequest: 0,
			},
		})
		cluster.on("error", () => {})
		const a = worker(env)
		const b = worker(env)
		t.after(async () => {
			await Promise.all([a.stop(), b.stop()])
			try {
				await cluster.quit()
			} finally {
				cluster.disconnect()
			}
		})
		await cluster.connect()
		await Promise.all([
			a.request({ command: "ready" }),
			b.request({ command: "ready" }),
		])
		async function setup(name: string) {
			const config = {
				name: `gw311-${name}`,
				params: { nonce: randomBytes(9).toString("hex") },
				ttl: 1,
				stale: 2,
			}
			await Promise.all([
				a.request({ ...config, command: "declare" }),
				b.request({ ...config, command: "declare" }),
			])
			const key = cacheEntryKey(config.name, config.params)
			return { config, key, marker: cacheResetMarkerKey(key) }
		}
		await t.test(
			"B's in-flight miss started before A's reset cannot store",
			async () => {
				const { config, key, marker } = await setup("miss")
				const old = b.request({
					...config,
					command: "lookup",
					value: "old",
					gate: "miss",
				})
				old.catch(() => {})
				await b.started("miss")
				assert.equal(await a.request({ ...config, command: "reset" }), true)
				await b.request({ command: "release", gate: "miss" })
				assert.deepEqual(await old, { v: "old" })
				assert.equal(await cluster.get(key), null)
				metric(
					await b.request({ command: "metrics" }),
					config.name,
					"reset_guard",
					"store_rejected",
				)
				const ttl = await cluster.ttl(marker)
				assert.ok(
					ttl >= 1 &&
						ttl <= cachePhysicalTtlSeconds(config.ttl, config.stale) + 300,
				)
				assert.equal(
					await cluster.cluster("KEYSLOT", key),
					await cluster.cluster("KEYSLOT", marker),
				)
			},
		)
		await t.test(
			"B's stale refresh is replaced after A's reset and cannot resurrect old data",
			async () => {
				const { config, key } = await setup("stale")
				await cluster.setex(
					key,
					cachePhysicalTtlSeconds(config.ttl, config.stale),
					serializeCacheEntry(
						{ v: "old" },
						Date.now() - (config.ttl + 1) * 60_000,
					),
				)
				assert.deepEqual(
					await b.request({
						...config,
						command: "lookup",
						value: "old-refresh",
						gate: "stale",
					}),
					{ v: "old" },
				)
				await b.started("stale")
				metric(
					await b.request({ command: "metrics" }),
					config.name,
					"requests",
					"stale",
				)
				assert.equal(await a.request({ ...config, command: "reset" }), true)
				assert.deepEqual(
					await b.request({ ...config, command: "lookup", value: "new" }),
					{ v: "new" },
				)
				metric(
					await b.request({ command: "metrics" }),
					config.name,
					"reset_guard",
					"join_refused",
				)
				await b.request({ command: "release", gate: "stale" })
				await until(async () =>
					String(await b.request({ command: "metrics" })).includes(
						`refreshes_total{cache="${config.name}",result="discarded"} 1`,
					),
				)
				assert.equal(JSON.parse((await cluster.get(key)) ?? "").data.v, "new")
			},
		)
		await t.test(
			"a run after reset stores normally and another process hits it",
			async () => {
				const { config, key } = await setup("after")
				assert.equal(await a.request({ ...config, command: "reset" }), true)
				assert.deepEqual(
					await b.request({ ...config, command: "lookup", value: "new" }),
					{ v: "new" },
				)
				assert.equal(JSON.parse((await cluster.get(key)) ?? "").data.v, "new")
				assert.deepEqual(
					await a.request({ ...config, command: "lookup", value: "wrong" }),
					{ v: "new" },
				)
				metric(
					await b.request({ command: "metrics" }),
					config.name,
					"requests",
					"miss",
				)
				metric(
					await a.request({ command: "metrics" }),
					config.name,
					"requests",
					"hit",
				)
			},
		)
		await t.test(
			"plain hits add only GET; guarded hits, misses and resets have exact command costs",
			async () => {
				const { config } = await setup("cost")
				const plain = { ...config, name: "gw311-plain" }
				const zero = {
					get: 0,
					mget: 0,
					evalsha: 0,
					eval: 0,
					setex: 0,
					set: 0,
					del: 0,
				}
				for (const [options, command] of [
					[plain, "get"],
					[config, "mget"],
				] as const) {
					await b.request({ ...options, command: "lookup", value: "seed" })
					const before = await commandstats(cluster)
					for (let i = 0; i < 50; i++)
						assert.deepEqual(
							await b.request({
								...options,
								command: "lookup",
								value: "unused",
							}),
							{ v: "seed" },
						)
					const observed = delta(before, await commandstats(cluster))
					t.diagnostic(`${command} 50 hits: ${JSON.stringify(observed)}`)
					assert.deepEqual(observed, { ...zero, [command]: 50 })
				}
				const fresh = {
					...config,
					params: { nonce: randomBytes(9).toString("hex") },
				}
				let before = await commandstats(cluster)
				await b.request({ ...fresh, command: "lookup", value: "new" })
				let observed = delta(before, await commandstats(cluster))
				t.diagnostic(`guarded miss: ${JSON.stringify(observed)}`)
				// INFO includes the script's inner GET and SET, as well as its EVAL/EVALSHA.
				assert.equal(observed.eval + observed.evalsha, 1)
				assert.deepEqual(
					{ ...observed, eval: 0, evalsha: 0 },
					{ ...zero, mget: 1, get: 1, set: 1 },
				)
				before = await commandstats(cluster)
				assert.equal(await a.request({ ...fresh, command: "reset" }), true)
				observed = delta(before, await commandstats(cluster))
				t.diagnostic(`reset: ${JSON.stringify(observed)}`)
				// The reset script adds its inner SET and DEL to commandstats.
				assert.equal(observed.eval + observed.evalsha, 1)
				assert.deepEqual(
					{ ...observed, eval: 0, evalsha: 0 },
					{ ...zero, set: 1, del: 1 },
				)
			},
		)
		await t.test(
			"an unconfirmed reset bypasses lookups and retries after CLIENT PAUSE",
			async () => {
				const { config, key, marker } = await setup("pause")
				await b.request({ ...config, command: "lookup", value: "old" })
				await a.request({ command: "setRetryMs", ms: 500 })
				await Promise.all(
					cluster
						.nodes("master")
						.map((master) => master.call("CLIENT", "PAUSE", "2500", "ALL")),
				)
				const start = performance.now()
				assert.equal(await a.request({ ...config, command: "reset" }), false)
				assert.ok(
					performance.now() - start >= 900 && performance.now() - start < 2000,
				)
				assert.equal(await a.request({ command: "pending" }), 1)
				assert.deepEqual(
					await a.request({ ...config, command: "lookup", value: "fresh" }),
					{ v: "fresh" },
				)
				metric(
					await a.request({ command: "metrics" }),
					config.name,
					"requests",
					"reset_pending",
				)
				metric(
					await a.request({ command: "metrics" }),
					config.name,
					"reset_guard",
					"store_skipped",
				)
				await until(async () => (await a.request({ command: "pending" })) === 0)
				assert.equal(await cluster.get(key), null)
				assert.ok(await cluster.get(marker))
				assert.deepEqual(
					await b.request({ ...config, command: "lookup", value: "fresh" }),
					{ v: "fresh" },
				)
				metric(
					await b.request({ command: "metrics" }),
					config.name,
					"requests",
					"miss",
					2,
				)
				assert.equal(JSON.parse((await cluster.get(key)) ?? "").data.v, "fresh")
			},
		)
		await t.test(
			"a node returning from its append-only file loses its pre-reset value on retry",
			{ skip: !process.env.GW_TEST_VALKEY_CONTAINERS },
			async () => {
				const containers = (process.env.GW_TEST_VALKEY_CONTAINERS ?? "").split(
					",",
				)
				assert.equal(containers.length, 3)
				const { config, key, marker } = await setup("aof")
				await b.request({ ...config, command: "lookup", value: "old" })
				assert.deepEqual(
					await b.request({ ...config, command: "lookup", value: "unused" }),
					{ v: "old" },
				)
				await sleep(1500)
				const slot = Number(await cluster.cluster("KEYSLOT", key))
				const owner = cluster.slots[slot][0]
				const ownerIndex = addresses.findIndex(
					(node) => `${node.host}:${node.port}` === owner,
				)
				assert.ok(ownerIndex >= 0)
				const docker = promisify(execFile)
				await a.request({ command: "setRetryMs", ms: 500 })
				try {
					await docker("docker", ["kill", containers[ownerIndex]])
					assert.equal(await a.request({ ...config, command: "reset" }), false)
					assert.equal(await a.request({ command: "pending" }), 1)
				} finally {
					await docker("docker", ["start", containers[ownerIndex]])
				}
				let firstOld: number | undefined
				let lastOld: number | undefined
				await until(async () => {
					try {
						const value = await cluster.get(key)
						if (value && JSON.parse(value).data.v === "old") {
							firstOld ??= Date.now()
							lastOld = Date.now()
						}
						return (
							(await a.request({ command: "pending" })) === 0 && value === null
						)
					} catch {
						return false
					}
				}, 20_000)
				t.diagnostic(
					`AOF old value observed: ${firstOld !== undefined}; readable observation window: ${firstOld === undefined ? 0 : (lastOld ?? firstOld) - firstOld} ms`,
				)
				assert.equal(await cluster.get(key), null)
				assert.ok(await cluster.get(marker))
			},
		)
	},
)

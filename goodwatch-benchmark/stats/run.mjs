// Real Stats computation and catalog queue, synthetic member rows, loopback catalog only.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs"
const root = resolve(process.argv[2] || ".")
const out = resolve(
	process.argv[3] || `${process.env.HOME}/.cache/gw-perf/scratch-stats/before`,
)
mkdirSync(out, { recursive: true })
const app = resolve(root, "goodwatch-webapp/app")
const require = createRequire(resolve(root, "goodwatch-webapp/package.json"))
const { build } = require("esbuild")
const Redis = require("ioredis")
const redis = new Redis(6473, "127.0.0.1")
const expectedRedis = execFileSync(
	"docker",
	[
		"exec",
		"gw-perf-stats-cache",
		"valkey-cli",
		"-p",
		"6473",
		"cluster",
		"myid",
	],
	{ encoding: "utf8" },
).trim()
assert.equal(
	await redis.cluster("myid"),
	expectedRedis,
	"refusing another local Redis",
)
assert.match(await redis.cluster("info"), /cluster_state:ok/)
const queries = []
globalThis.statsFixture = {
	redis,
	cached: null,
	queries,
	async query(stmt, args) {
		const start = performance.now()
		const response = await fetch("http://127.0.0.1:15873/_sql", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ stmt, args }),
		})
		const raw = await response.text()
		const d = JSON.parse(raw)
		if (!response.ok) throw Error(raw)
		const rows = d.rows.map((row) =>
			Object.fromEntries(d.cols.map((col, i) => [col, row[i]])),
		)
		queries.push({
			stmt,
			args,
			ms: performance.now() - start,
			engineMs: d.duration,
			rows: rows.length,
			bytes: raw.length,
		})
		return rows
	},
}
const modules = {
	"server/userData.server": `export const getUserData = async () => ({scores: Object.fromEntries(['movie','show'].flatMap(k=>Array.from({length:k==='movie'?700:300},(_,i)=>[k+'-'+(i+1),{score:1+i%10,updatedAt:'2026-10-01'}]))),watchState:{}})`,
	"utils/crate": `export const query = (s,a) => globalThis.statsFixture.query(s,a)`,
	"utils/helpers": `export const titlePath = (k,id) => '/'+k+'/'+id`,
	"utils/cache": `export const getRedisCluster = () => globalThis.statsFixture.redis`,
}
const cacheExports = existsSync(
	resolve(app, "server/profile/summary-cache.server.ts"),
)
	? `export {readSummary,writeSummary} from './server/profile/summary-cache.server';`
	: ""
const result = await build({
	stdin: {
		contents: `${cacheExports}export {getTasteStats} from './server/profile/taste-stats.server'; export {requestServerTiming} from './utils/request-work'; export {statsPayload} from './server/profile/stats-payload'; export {statsForViewer} from './server/profile/taste-stats-view'`,
		resolveDir: app,
	},
	bundle: true,
	write: false,
	platform: "node",
	format: "esm",
	alias: { "~": app },
	plugins: [
		{
			name: "fixture",
			setup(b) {
				b.onResolve({ filter: /.*/ }, (a) => {
					const name = a.path.startsWith("~/")
						? a.path.slice(2)
						: a.path.startsWith(".")
							? resolve(a.resolveDir, a.path)
									.slice(app.length + 1)
									.replace(/\.ts$/, "")
							: a.path
					if (name in modules) return { path: name, namespace: "fixture" }
				})
				b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
					contents: modules[a.path],
				}))
			},
		},
	],
})
const mod = await import(
	`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
)
const runs = []
for (let i = 0; i < 10; i++) {
	if (i < 5) await redis.flushall()
	const request = new Request("http://127.0.0.1/u/synthetic/stats")
	const queryStart = queries.length
	const start = performance.now()
	const value = await mod.getTasteStats("synthetic-only", request)
	runs.push({
		kind: i < 5 ? "cold" : "warm",
		ms: performance.now() - start,
		timing: mod.requestServerTiming(request),
		bytes: JSON.stringify(value).length,
		queryCount: queries.length - queryStart,
	})
	writeFileSync(resolve(out, "value.json"), JSON.stringify(value, null, 2))
	const views = Array.from({ length: 16 }, (_, mask) =>
		mod.statsPayload(
			mod.statsForViewer(
				value,
				Object.fromEntries(
					["scores", "seen", "shows", "hours"].map((k, j) => [
						k,
						Boolean(mask & (1 << j)),
					]),
				),
			),
		),
	)
	writeFileSync(
		resolve(out, i < 5 ? "cold-views.json" : "warm-views.json"),
		JSON.stringify(views, null, 2),
	)
}
const plans = []
for (const q of queries.slice(0, runs[0].queryCount)) {
	let parameter = 0
	const r = await fetch("http://127.0.0.1:15873/_sql", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			stmt:
				"EXPLAIN " +
				q.stmt.replace(/\?/g, () => {
					const value = q.args[parameter++]
					return typeof value === "number"
						? String(value)
						: "'" + String(value).replaceAll("'", "''") + "'"
				}),
		}),
	})
	plans.push(await r.json())
}
writeFileSync(resolve(out, "queries.json"), JSON.stringify(queries, null, 2))
writeFileSync(resolve(out, "plans.json"), JSON.stringify(plans, null, 2))
writeFileSync(resolve(out, "runs.json"), JSON.stringify(runs, null, 2))
assert.ok(
	runs.slice(5).every((run) => run.queryCount === 0),
	"warm reads must skip all catalog queries",
)
const cold = JSON.parse(readFileSync(resolve(out, "cold-views.json")))
assert.deepEqual(
	cold,
	JSON.parse(readFileSync(resolve(out, "warm-views.json"))),
	"warm visibility projections",
)
if (process.argv[4])
	assert.deepEqual(
		cold,
		JSON.parse(readFileSync(resolve(process.argv[4], "cold-views.json"))),
		"base visibility projections",
	)
console.log(JSON.stringify(runs, null, 2))
// Exercise the real post-activity cache path. Stale hits must return while the catalog is held.
if (process.env.STATS_ACTIVITY_CHECK || root === resolve(".")) {
	if (mod.writeSummary) {
		await mod.writeSummary(
			"race",
			"synthetic-only",
			{ version: 2 },
			Date.now() + 10,
		)
		await mod.writeSummary(
			"race",
			"synthetic-only",
			{ version: 1 },
			Date.now() - 100,
		)
		assert.equal(
			(await mod.readSummary("race", "synthetic-only")).value.version,
			2,
			"an older writer cannot replace a newer value",
		)
		assert.ok(
			(await redis.ttl("profile-summary:v2:race:synthetic-only")) >
				6 * 24 * 3600,
		)
	}
	const oldQuery = globalThis.statsFixture.query
	let release
	const gate = new Promise((resolve) => {
		release = resolve
	})
	globalThis.statsFixture.query = async (...args) => {
		await gate
		return oldQuery(...args)
	}
	await redis.set(
		"taste:touched:synthetic-only",
		String(Date.now()),
		"EX",
		3600,
	)
	const requests = Array.from(
		{ length: 3 },
		() => new Request("http://127.0.0.1/u/synthetic/stats"),
	)
	const start = performance.now()
	const readers = Promise.all(
		requests.map((request) => mod.getTasteStats("synthetic-only", request)),
	)
	try {
		await Promise.race([
			readers,
			new Promise((_, reject) =>
				setTimeout(
					() => reject(Error("Activity blocked a visitor on recomputation")),
					200,
				),
			),
		])
	} catch (error) {
		console.error(error.message)
		process.exitCode = 1
	}
	if (!process.exitCode)
		for (const request of requests)
			assert.match(mod.requestServerTiming(request), /stats_cache_hit/)
	const activity = {
		ms: performance.now() - start,
		timings: requests.map((r) => mod.requestServerTiming(r)),
	}
	writeFileSync(
		resolve(out, "activity.json"),
		JSON.stringify(activity, null, 2),
	)
	release()
	await readers
	// Wait for the shared refresh to drain before stopping its cache connection.
	globalThis.statsFixture.query = oldQuery
	await new Promise((resolve) => setTimeout(resolve, 200))
}
redis.disconnect()
if (
	process.env.STATS_ASSERT_BUDGET &&
	runs.slice(1, 5).some((r) => r.ms >= 300)
)
	process.exitCode = 1

import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createServer, request } from "node:http"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { promisify, format } from "node:util"
import { setTimeout as delay } from "node:timers/promises"

const exec = promisify(execFile)
const directory = fileURLToPath(new URL(".", import.meta.url))
const output = process.argv[2] ?? `${directory}results/observations.json`
const compose = ["compose", "-f", `${directory}compose.yaml`, "-p", "goodwatch-client-588"]
const endpoints = [1, 2, 3].map((i) => `http://127.0.0.${i}:17430`)
assert.match(process.env.DOCKER_HOST ?? "", /^unix:\//, "Only a local Unix Docker socket is allowed")
assert.ok(!process.env.DOCKER_CONTEXT, "Unset DOCKER_CONTEXT")
if (process.env.CRATE_PROOF_TRACKING_ONLY === "1") {
	assert.equal(process.env.CRATE_PROOF_PAGES, "1", "Tracking-only proof requires real HTTP routes")
	assert.equal(process.env.CRATE_PROOF_FIRST_INSERT, "1", "Tracking-only proof requires tracking recovery scenarios")
}
Object.assign(process.env, {
	CRATE_HOSTS: "127.0.0.1,127.0.0.2,127.0.0.3", CRATE_PORT: "17430",
	CRATE_USER: "crate", CRATE_PASS: "", CRATE_TIMEOUT_MS: "10000",
})
const clientPath = process.env.CRATE_PROOF_BASELINE === "1" ? "./baseline-crate.ts" : "../../app/utils/crate.ts"
const { query, execute, upsert, insertRows, setCrateClientForTest } = await import(clientPath)
const report = { startedAt: new Date().toISOString(), client: clientPath,
	clientSha256: createHash("sha256").update(await readFile(new URL(clientPath, import.meta.url))).digest("hex"),
	baselineCommit: process.env.CRATE_PROOF_BASELINE === "1" ? process.env.CRATE_PROOF_BASELINE_COMMIT : null,
	trackingOnly: process.env.CRATE_PROOF_TRACKING_ONLY === "1",
	nodeVersion: process.version, endpointScope: endpoints, assertions: [], failures: [] }
report.sourceSha256 = {}
for (const path of ["../../app/utils/crate.ts", "../../app/utils/crate-diagnostics.ts", "../../app/server/tracking.server.ts", "../../app/server/combined-search/catalog.server.ts", "../../app/server/search-ranking/search-index-build.server.ts", "../../app/server/page-cache.server.ts", "./verify.mjs", "./first-insert-proof.mjs", "./removal-retry-proof.mjs", "./page-proof.mjs", "./build-page-proof.mjs", "./page-loaders.ts", "./compose.yaml", "./run.sh", ...(process.env.CRATE_PROOF_PAGES === "1" ? ["./page-loaders.generated.mjs"] : [])])
 report.sourceSha256[path] = createHash("sha256").update(await readFile(new URL(path, import.meta.url))).digest("hex")
report.trackingBaselineCommit = process.env.CRATE_PROOF_TRACKING_BASELINE_COMMIT ?? null
report.trackingRuntimeSha256 = report.trackingBaselineCommit
 ? createHash("sha256").update((await exec("git", ["show", `${report.trackingBaselineCommit}:goodwatch-webapp/app/server/tracking.server.ts`])).stdout).digest("hex")
 : report.sourceSha256["../../app/server/tracking.server.ts"]
const log = []
const progress = console.log.bind(console)
for (const method of ["log", "warn", "error", "trace"]) console[method] = (...args) => log.push(format(...args))
const docker = async (...args) => (await exec("docker", [...compose, ...args], { timeout: 120_000 })).stdout.trim()
const snapshot = async () => (await docker("ps", "-a", "--format", "json")).split("\n").filter(Boolean).map((line) => JSON.parse(line))
const sql = async (stmt, args = [], endpoint = endpoints[2], timeoutMs = 10_000) => {
	const response = await fetch(`${endpoint}/_sql?types`, {
		method: "POST", headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ stmt, args }), signal: AbortSignal.timeout(timeoutMs),
	})
	const result = await response.json()
	if (!response.ok || result.error) throw new Error(JSON.stringify({ status: response.status, ...result.error }))
	return result
}
const waitFor = async (label, check, timeout = 90_000) => {
	const end = Date.now() + timeout
	let last
	while (Date.now() < end) {
		try { if (await check()) return } catch (error) { last = error.message }
		await delay(250)
	}
	throw new Error(`${label} timed out: ${last}`)
}
const rows = async (stmt, args) => (await sql(stmt, args)).rows
const check = (label, actual, expected) => {
	assert.deepEqual(actual, expected, label)
	report.assertions.push({ label, actual, expected })
}

// A transparent loopback proxy drops exactly one acknowledged response. This
// proves the outcome is applied on real CrateDB before a caller sees a failure.
async function lostResponseProof(kind, timeout = false) {
	setCrateClientForTest(null)
	const trackingCas = kind === "tracking-cas"
	const versionQuery = trackingCas
		? "SELECT _seq_no FROM user_watch_state WHERE user_id = ? AND tmdb_id = ? AND media_type = ?"
		: "SELECT _seq_no FROM client_failover_588 WHERE id = ?"
	const versionKey = trackingCas ? ["proof-member", 2, "show"] : undefined
	const id = `lost-${kind}-${timeout ? "timeout" : "reset"}`
	await sql("INSERT INTO client_failover_588 (id, kind, n) VALUES (?, ?, 0)", [id, "lost"])
	const [[seqBefore]] = await rows(versionQuery, versionKey ?? [id])
	let dropped = false
	let appliedSeq
	let writes = 0
	const servers = []
	let port = 0
	for (const [i, endpoint] of endpoints.entries()) {
		const server = createServer((req, res) => {
			let body = ""
			req.on("data", (chunk) => { body += chunk })
			req.on("end", () => {
				const { stmt } = JSON.parse(body)
				const mutation = trackingCas ? /^UPDATE user_watch_state\b/i.test(stmt.trim()) : /^(INSERT|UPDATE)/i.test(stmt.trim())
				if (mutation) writes++
				const forward = request(`${endpoint}${req.url}`, { method: "POST", headers: { "Content-Type": "application/json" } }, (upstream) => {
					let responseBody = ""
					upstream.on("data", (chunk) => { responseBody += chunk })
					upstream.on("end", async () => {
						if (mutation && !dropped) {
							dropped = true
							try {
								const result = JSON.parse(responseBody)
								assert.equal(result.rowcount, 1, "Drop only a successfully applied write response")
								;[[appliedSeq]] = await rows(versionQuery, versionKey ?? [id])
								if (!timeout) req.socket.destroy()
							} catch (error) { report.failures.push({ phase: "proxy", message: error.message }); req.socket.destroy() }
						} else {
							res.writeHead(upstream.statusCode, { "Content-Type": "application/json" })
							res.end(responseBody)
						}
					})
				})
				forward.on("error", () => req.socket.destroy())
				forward.end(body)
			})
		})
		await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, `127.0.0.${i + 1}`, resolve) })
		port = server.address().port
		servers.push(server)
	}
	// Keep the production default budget. The write is stalled indefinitely, so
	// timeouts remain deterministic without starving readback during node rejoin.
	Object.assign(process.env, { CRATE_PORT: String(port), CRATE_TIMEOUT_MS: "10000" })
	let outcome
	try {
		if (trackingCas) {
			await pageProof.requestRoute("score")
			const [[seqAfter]] = await rows(versionQuery, versionKey)
			check(`${id}: no second application after lost CAS response`, seqAfter, appliedSeq)
			check(`${id}: one dispatched CAS`, writes, 1)
			return { id, timeout, kind, writes, seqBefore, appliedSeq, seqAfter, outcome: "Real score action recovered CAS by versioned state readback" }
		} else if (kind === "increment") {
			await assert.rejects(execute("UPDATE client_failover_588 SET n = n + 1 WHERE id = ?", [id]))
			outcome = "Returned indeterminate error without replay"
		} else if (kind === "upsert") {
			await upsert({ table: "client_failover_588", data: [{ id, kind: "lost", n: 1 }], conflictColumns: ["id"] })
			outcome = "Recovered by key readback"
		} else {
			// Start absent so the first batch really inserts; its replay must be a no-op.
			await sql("DELETE FROM client_failover_588 WHERE id = ?", [id])
			await insertRows("client_failover_588", ["id", "kind", "n"], [[id, "lost", 1]], { conflict: ["id"] })
			outcome = "Replayed fixed key with DO NOTHING"
		}
		const [[n, seqAfter]] = await rows("SELECT n, _seq_no FROM client_failover_588 WHERE id = ?", [id])
		check(`${id}: one durable effect`, n, 1)
		check(`${id}: no second application after lost response`, seqAfter, appliedSeq)
		check(`${id}: transport write attempts`, writes, kind === "insert" ? 2 : 1)
		return { id, timeout, kind, writes, seqBefore, appliedSeq, seqAfter, n, outcome }
	} finally {
		setCrateClientForTest(null)
		Object.assign(process.env, { CRATE_PORT: "17430", CRATE_TIMEOUT_MS: "10000" })
		await Promise.all(servers.map(async (server) => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }))
	}
}

let pageProof
try {
	progress("Waiting for isolated three-node CrateDB cluster")
	await waitFor("three nodes", async () => (await rows("SELECT count(*) FROM sys.nodes"))[0][0] === 3)
	report.nodes = await rows("SELECT name, version['number'] FROM sys.nodes ORDER BY name")
	check("Pinned cluster nodes", report.nodes, [["node1", "5.10.16"], ["node2", "5.10.16"], ["node3", "5.10.16"]])
	await sql(`CREATE TABLE client_failover_588 (id TEXT PRIMARY KEY, kind TEXT, n LONG, created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE)
		CLUSTERED INTO 3 SHARDS WITH (number_of_replicas = '2', "write.wait_for_active_shards" = 1, "translog.durability" = 'REQUEST')`)
	const seed = [...Array.from({ length: 60 }, (_, i) => [`seed-${i}`, "seed", 7]), ...Array.from({ length: 400 }, (_, i) => [`generic-${i}`, "generic", 0])]
	await sql(`INSERT INTO client_failover_588 (id, kind, n) VALUES ${seed.map(() => "(?, ?, ?)").join(",")}`, seed.flat())
	await sql("REFRESH TABLE client_failover_588")
	await waitFor("nine STARTED copies", async () => (await rows("SELECT count(*) FROM sys.shards WHERE table_name = 'client_failover_588' AND state = 'STARTED'"))[0][0] === 9)
	report.beforeShards = await rows("SELECT id, primary, node['name'], state FROM sys.shards WHERE table_name = 'client_failover_588' ORDER BY id, primary DESC, node['name']")

	if (process.env.CRATE_PROOF_PAGES === "1") {
		const { preparePageProof } = await import("./page-proof.mjs")
		pageProof = await preparePageProof(sql)
		report.pageTables = pageProof.tables
		report.trackingMigration = pageProof.migration
		report.pageRoutes = pageProof.stats
		await pageProof.warm()
		await waitFor("all fixture shards GREEN", async () => (await rows("SELECT count(*) FROM sys.health WHERE health <> 'GREEN'"))[0][0] === 0)
		report.beforeHealth = await rows("SELECT health, count(*) FROM sys.health GROUP BY health")
		progress("Real page loaders/actions warmed against disposable fixture tables")
	}
	if (process.env.CRATE_PROOF_TRACKING_ONLY !== "1") {
	const stats = { reads: { succeeded: 0, failed: 0, maxMs: 0 }, keyed: { succeeded: 0, failed: 0 }, upsert: { succeeded: 0, failed: 0 }, generic: { succeeded: 0, failed: 0 } }
	const written = { keyed: [], upsert: [], generic: [] }
	let number = 0
	const start = Date.now()
	const durationMs = process.env.CRATE_PROOF_GRACEFUL === "1" ? 75_000 : 22_000
	const error = (phase, id, exception) => {
		stats[phase].failed++
		report.failures.push({ phase, id, atMs: Date.now() - start, message: exception.message, code: exception.code })
	}
	const pages = pageProof?.load(durationMs)
	const readers = Array.from({ length: 4 }, (_, reader) => (async () => {
		while (Date.now() - start < durationMs) {
			const begun = performance.now()
			try {
				const result = reader % 2 === 0
					? await query("SELECT n FROM client_failover_588 WHERE id = ?", ["seed-0"])
					: await query("SELECT sum(n) AS n FROM client_failover_588 WHERE kind = 'seed'")
				assert.equal(result[0].n, reader % 2 === 0 ? 7 : 420)
				stats.reads.succeeded++
			} catch (exception) { error("reads", reader, exception) }
			stats.reads.maxMs = Math.max(stats.reads.maxMs, performance.now() - begun)
			await delay(10)
		}
	})())
	const writer = (kind, pause, apply) => (async () => {
		while (Date.now() - start < durationMs) {
			const id = `${kind}-${number++}`
			try { await apply(id); written[kind].push(id); stats[kind].succeeded++ }
			catch (exception) { error(kind, id, exception) }
			await delay(pause)
		}
	})()
	const writers = [
		writer("keyed", 20, (id) => insertRows("client_failover_588", ["id", "kind", "n"], [[id, "keyed", 1]], { conflict: ["id"] })),
		writer("upsert", 20, (id) => upsert({ table: "client_failover_588", data: [{ id, kind: "upsert", n: 1 }], conflictColumns: ["id"] })),
		(async () => {
			for (let i = 0; i < 400 && Date.now() - start < durationMs; i++) {
				const id = `generic-${i}`
				try { await execute("UPDATE client_failover_588 SET n = n + 1 WHERE id = ?", [id]); stats.generic.succeeded++; written.generic.push(id) }
				catch (exception) { error("generic", id, exception) }
				await delay(35)
			}
		})(),
	]
	await delay(3_000)
	const graceful = process.env.CRATE_PROOF_GRACEFUL === "1"
	const target = graceful ? "node1" : "node2"
	report.stop = { requestedAt: new Date().toISOString(), elapsedMs: Date.now() - start,
		command: graceful ? "ALTER CLUSTER DECOMMISSION node1" : "docker compose kill --signal SIGKILL node2" }
	if (graceful) {
		await sql(`SET GLOBAL TRANSIENT "cluster.graceful_stop.min_availability" = 'primaries', "cluster.graceful_stop.force" = false, "cluster.graceful_stop.timeout" = '2h'`)
		await sql(`SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'primaries'`)
		report.stop.settings = await rows("SELECT settings['cluster']['graceful_stop'] FROM sys.cluster")
		progress("Gracefully decommissioning node1 during concurrent reads and writes")
		await sql("ALTER CLUSTER DECOMMISSION 'node1'", [], endpoints[2], 120_000)
		report.stop.acknowledgedAt = new Date().toISOString()
		await waitFor("normal decommission exit", async () => {
			const [id] = (await docker("ps", "-aq", target)).split("\n")
			const state = JSON.parse((await exec("docker", ["inspect", id])).stdout)[0].State
			report.stop.state = state
			return state.Status === "exited" && state.ExitCode === 0
		}, 120_000)
	} else {
		progress("Stopping node2 during concurrent reads and writes")
		await docker("kill", "--signal", "SIGKILL", target)
	}
	report.stop.completedAt = new Date().toISOString()
	report.stoppedContainers = await snapshot()
	if (graceful) {
		// Process exit and the surviving coordinator's membership update are separate observations.
		await waitFor("surviving coordinator removes stopped node", async () => {
			report.afterStopNodes = await rows("SELECT name FROM sys.nodes ORDER BY name")
			return report.afterStopNodes.length === 2 && !report.afterStopNodes.some(([name]) => name === target)
		})
		await delay(2_000)
		await docker("start", target)
		await sql(`SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'all'`)
		report.restartedAt = new Date().toISOString()
		await waitFor("node1 rejoins during load", async () => (await rows("SELECT count(*) FROM sys.nodes"))[0][0] === 3)
		report.rejoinedDuringLoad = { elapsedMs: Date.now() - start, reads: stats.reads.succeeded,
			pages: Object.fromEntries(Object.entries(pageProof?.stats ?? {}).map(([name, stat]) => [name, stat.succeeded])) }
		assert.ok(report.rejoinedDuringLoad.elapsedMs < durationMs - 5_000, "Load must cover at least five seconds after rejoin")
	}
	await Promise.all([...readers, ...writers, pages])
	if (graceful) {
		assert.ok(stats.reads.succeeded > report.rejoinedDuringLoad.reads, "Reads continue after node rejoin")
		for (const [name, count] of Object.entries(report.rejoinedDuringLoad.pages))
			assert.ok(pageProof.stats[name].succeeded > count, `${name} route continues after rejoin`)
	}
	report.load = { durationMs: Date.now() - start, stats, acknowledgedWrites: Object.fromEntries(Object.entries(written).map(([kind, ids]) => [kind, ids.length])) }
	await sql("REFRESH TABLE client_failover_588")
	report.afterStopNodes ??= await rows("SELECT name FROM sys.nodes ORDER BY name")
	report.writeAudit = await rows("SELECT kind, count(*), min(n), max(n), sum(n) FROM client_failover_588 GROUP BY kind ORDER BY kind")
	if (pageProof) check("No failed page loaders/actions", Object.values(pageProof.stats).reduce((n,s)=>n+s.failed,0),0)
	check("No failed reads during node loss", stats.reads.failed, 0)
	check("No keyed insert failures", stats.keyed.failed, 0)
	check("No upsert failures", stats.upsert.failed, 0)
	check("All acknowledged keyed rows exist", (await rows("SELECT count(*) FROM client_failover_588 WHERE kind = 'keyed'"))[0][0], written.keyed.length)
	check("All acknowledged upsert rows exist", (await rows("SELECT count(*) FROM client_failover_588 WHERE kind = 'upsert'"))[0][0], written.upsert.length)
	check("No row mutated twice", (await rows("SELECT count(*) FROM client_failover_588 WHERE kind <> 'seed' AND n > 1"))[0][0], 0)
	check("Two surviving cluster members", report.afterStopNodes, graceful ? [["node2"], ["node3"]] : [["node1"], ["node3"]])
	if (pageProof) {
		const watches = await rows("SELECT watch_id FROM user_watch_log WHERE user_id = ?", ["proof-member"])
		const stored = watches.map(([id]) => id)
		check("Every acknowledged route watch stored once", stored.filter(id => pageProof.acknowledgedWatches.includes(id)).length, pageProof.acknowledgedWatches.length)
		check("No duplicate route watch ids", new Set(stored).size, stored.length)
		report.pageWatchAudit = { acknowledged: pageProof.acknowledgedWatches.length, stored: stored.length, unique: new Set(stored).size }
	}
	progress("Verifying rejoined replicas and lost-response write safety")
	if (!graceful) await docker("start", target)
	if (graceful) await sql(`SET GLOBAL TRANSIENT "cluster.routing.allocation.enable" = 'all'`)
	await waitFor("restored replicas", async () => (await rows("SELECT count(*) FROM sys.shards WHERE table_name = 'client_failover_588' AND state = 'STARTED'"))[0][0] === 9)
	report.lostResponses = []
	for (const kind of ["increment", "upsert", "insert"]) {
		for (const timeout of [false, true]) report.lostResponses.push(await lostResponseProof(kind, timeout))
	}
	if (pageProof) for (const timeout of [false, true]) report.lostResponses.push(await lostResponseProof("tracking-cas", timeout))
	}
	if (pageProof && process.env.CRATE_PROOF_FIRST_INSERT === "1") {
		const { firstInsertProof } = await import("./first-insert-proof.mjs")
		report.firstInserts = await firstInsertProof({ pageProof, sql, endpoints, setCrateClientForTest, check })
		const { removalRetryProof } = await import("./removal-retry-proof.mjs")
		report.removalRetries = await removalRetryProof({ pageProof, sql, endpoints, setCrateClientForTest, check })
	}
	check("No proxy errors", report.failures.filter(({ phase }) => phase === "proxy"), [])
	report.passed = true
	progress(report.load ? `Proof passed: ${report.load.stats.reads.succeeded} reads; tracking recovery verified` : "Tracking-only lost-response proof passed")
} catch (error) {
	report.passed = false
	report.error = { message: error.message, stack: error.stack }
	progress(`Proof failed: ${error.message}`)
	process.exitCode = 1
} finally {
	await pageProof?.close()
	const events = log.filter(line => line.startsWith('{"time":')).flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
	report.diagnostics = { events: events.length, byEvent: {}, byErrorClass: {}, failedQueries: [], httpOutcomes: [] }
	for (const event of events) {
		report.diagnostics.byEvent[event.event] = (report.diagnostics.byEvent[event.event] ?? 0) + 1
		if (event.errorClass) report.diagnostics.byErrorClass[event.errorClass] = (report.diagnostics.byErrorClass[event.errorClass] ?? 0) + 1
		if (event.event === "crate.query" && event.outcome === "failed") report.diagnostics.failedQueries.push(event)
		if (event.event === "crate.http") report.diagnostics.httpOutcomes.push(event)
	}
	report.finishedAt = new Date().toISOString()
	await mkdir(fileURLToPath(new URL("./results", import.meta.url)), { recursive: true })
	await writeFile(output, `${JSON.stringify(report, null, 2)}\n`)
	await writeFile(output.replace(/\.json$/, ".log"), log.join("\n"))
}

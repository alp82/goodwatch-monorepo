import assert from "node:assert/strict"
import { test } from "node:test"
import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { crateAuthAdapter, localCrateTransport, IndeterminateAuthWriteError } from "./crate-adapter.server.ts"
import { authTestOptions } from "./fixtures.integration.ts"

const composeFile = fileURLToPath(new URL("../../../scripts/auth-cratedb/compose.yaml", import.meta.url))
const socket = `/run/user/${process.getuid!()}/docker.sock`
const dockerEnv = { ...process.env, DOCKER_HOST: `unix://${existsSync(socket) ? socket : "/var/run/docker.sock"}`, DOCKER_CONTEXT: "" }
const compose = (...args: string[]) => execFileSync("docker", ["compose", "-f", composeFile, "-p", "goodwatch-auth-548", ...args], { env: dockerEnv, stdio: "pipe" })
const endpoint = (node: string) => `http://127.0.0.1:${15747 + Number(node.slice(-1))}`
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function until(label: string, check: () => Promise<boolean>, timeout = 90_000) {
	const deadline = Date.now() + timeout
	while (Date.now() < deadline) {
		try { if (await check()) return } catch { /* Reads may route to a paused shard copy. */ }
		await sleep(250)
	}
	throw new Error(`Timed out: ${label}`)
}

for (const kind of ["consume", "increment"] as const) test(`primary stops after ${kind} applies: recover this invocation without a second transition`, { timeout: 180_000 }, async () => {
	const control = localCrateTransport([endpoint("node1")])
	const nodes = await control("SELECT name,version['number'] FROM sys.nodes ORDER BY name")
	assert.deepEqual(nodes.rows, [["node1", "5.10.12"], ["node2", "5.10.12"], ["node3", "5.10.12"]])
	const tableName = kind === "consume" ? "auth_verification" : "auth_rate_limit"
	await until("three started copies", async () => (await control("SELECT count(*) FROM sys.shards WHERE table_name=? AND state='STARTED'", [tableName])).rows[0][0] === 3)
	const placement = (await control("SELECT primary,node['name'] FROM sys.shards WHERE table_name=? AND state='STARTED'", [tableName])).rows
	const primary = String(placement.find(row => row[0])![1])
	const [coordinator, held] = placement.filter(row => !row[0]).map(row => String(row[1]))
	const transport = localCrateTransport([endpoint(coordinator)], 90_000)
	const options = { ...authTestOptions, rateLimit: { storage: "database" as const } }
	let updateStarted!: () => void
	const started = new Promise<void>(resolve => { updateStarted = resolve })
	let armed = false, heldPaused = false, observedRowcount: number | undefined
	const sql = async (statement: string, args?: unknown[]) => {
		if (armed && statement.startsWith(`UPDATE doc.${tableName} `)) {
			armed = false
			compose("pause", held)
			heldPaused = true
			updateStarted()
			const result = await transport(statement, args)
			observedRowcount = result.rowcount
			return result
		}
		return transport(statement, args)
	}
	const adapter = crateAuthAdapter({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })(options)
	const model = kind === "consume" ? "verification" : "rateLimit"
	const value = kind === "consume"
		? await adapter.create({ model, data: { identifier: randomUUID(), value: "one-use-code", expiresAt: new Date(Date.now() + 600_000) } })
		: await adapter.create({ model, data: { key: randomUUID(), count: 0, lastRequest: Date.now() } })
	const where = kind === "consume" ? [{ field: "id", value: value.id }] : [
		{ field: "key", value: value.key }, { field: "lastRequest", value: 0, operator: "gt" as const }, { field: "count", value: 100, operator: "lt" as const },
	]
	let settled = false
	armed = true
	const pending = (kind === "consume" ? adapter.consumeOne<Record<string, any>>({ model, where }) : adapter.incrementOne<Record<string, any>>({ model, where, increment: { count: 1 }, set: { lastRequest: Date.now() } }))
		.then(result => { settled = true; return { result, error: undefined } }, error => { settled = true; return { result: undefined, error } })
	try {
		await started
		const read = crateAuthAdapter({ sql: localCrateTransport([endpoint(primary)], 1500) })(options)
		await until("mutation visible before acknowledgement", async () => {
			const found = kind === "consume" ? await read.findOne<Record<string, any>>({ model, where }) : (await read.findMany<Record<string, any>>({ model, where: [{ field: "key", value: value.key }] }))[0]
			return kind === "consume" ? found === null : found?.count === 1
		}, 30_000)
		assert.equal(settled, false, "fault must interrupt a pending write")
		compose("stop", "--timeout", "0", primary)
		compose("unpause", held)
		heldPaused = false
		await until("surviving primary promoted", async () => (await transport("SELECT node['name'] FROM sys.shards WHERE table_name=? AND primary=true AND state='STARTED'", [tableName])).rows.some(row => row[0] !== primary))
		const outcome = await pending
		if (outcome.error) throw outcome.error
		assert.equal(kind === "consume" ? outcome.result?.value : outcome.result?.count, kind === "consume" ? "one-use-code" : 1)
		assert.equal(observedRowcount, 0, "reproduce #530's applied-write/zero-acknowledgement schedule")
		if (kind === "consume") {
			await adapter.deleteMany({ model, where: [{ field: "identifier", value: value.identifier }] })
			assert.equal(await adapter.consumeOne<Record<string, any>>({ model, where }), null)
		} else {
			assert.equal((await adapter.findMany<Record<string, any>>({ model, where: [{ field: "key", value: value.key }] }))[0].count, 1)
		}
		console.log(JSON.stringify({ fault: kind, primary, coordinator, held, sqlRowcount: observedRowcount, recovered: true }))
	} finally {
		if (heldPaused) compose("unpause", held)
		compose("start", primary)
		await until("all copies restored", async () => (await transport("SELECT count(*) FROM sys.shards WHERE table_name=? AND state='STARTED'", [tableName])).rows[0][0] === 3)
		await pending
	}
})

test("an unacknowledged write with no readable receipt throws rather than guessing ownership", async () => {
	const transport = localCrateTransport([endpoint("node1")])
	let failing = false
	const sql = async (statement: string, args?: unknown[]) => {
		if (failing) throw new Error("Injected transport outage")
		const result = await transport(statement, args)
		if (statement.startsWith("UPDATE doc.auth_verification ")) { failing = true; throw new Error("Lost response") }
		return result
	}
	const adapter = crateAuthAdapter({ sql, encryptionSecret: "disposable-local-auth-integration-key-548" })({})
	const value = await adapter.create({ model: "verification", data: { identifier: randomUUID(), value: "one-use", expiresAt: new Date(Date.now() + 60_000) } })
	await assert.rejects(adapter.consumeOne<Record<string, any>>({ model: "verification", where: [{ field: "id", value: value.id }] }), IndeterminateAuthWriteError)
	failing = false
	assert.equal(await adapter.consumeOne<Record<string, any>>({ model: "verification", where: [{ field: "id", value: value.id }] }), null)
})

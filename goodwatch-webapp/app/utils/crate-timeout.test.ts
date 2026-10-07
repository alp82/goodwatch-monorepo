import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import { BackendTimeoutError, withBackendTimeout } from "./backend-timeout.ts"
import { getCrateClient, execute, query, upsert, CrateError, CrateTimeoutError, setCrateClientForTest } from "./crate.ts"

test("real Crate requests close on timeout without affecting other statements or upsert read-back", async (t) => {
	const closures: Promise<void>[] = []
	const statements: string[] = []
	const server = createServer((req, res) => {
		assert.equal(req.url, "/_sql?types")
		let body = ""
		req.on("data", (chunk) => { body += chunk })
		req.on("end", () => {
			const { stmt } = JSON.parse(body)
			statements.push(stmt)
			if (stmt.includes("stall") || stmt.includes("INSERT INTO")) {
				closures.push(new Promise((resolve) => req.socket.once("close", resolve)))
				return
			}
			res.setHeader("Content-Type", "application/json")
			if (stmt.includes("refused")) {
				res.statusCode = 404
				res.end(JSON.stringify({ error: { message: "ColumnUnknownException[test]", code: 4043 } }))
			} else res.end(JSON.stringify({ cols: ["n"], col_types: [9], rows: [[1]], rowcount: 1, duration: 1 }))
		})
	})
	const previous = { ...process.env }
	t.after(async () => {
		for (const key of ["CRATE_HOSTS", "CRATE_PORT", "CRATE_TIMEOUT_MS", "CRATE_USER", "CRATE_PASS"]) {
			if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]
		}
		setCrateClientForTest(null)
		server.closeAllConnections()
		await new Promise((resolve) => server.close(resolve))
	})
	for (const method of ["log", "error", "trace", "warn"] as const) t.mock.method(console, method, () => {})
	await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	Object.assign(process.env, { CRATE_HOSTS: "127.0.0.1", CRATE_PORT: String(address.port), CRATE_TIMEOUT_MS: "200", CRATE_USER: "", CRATE_PASS: "" })
	const started = performance.now()
	const stalled = assert.rejects(getCrateClient().execute("SELECT stall"), (error) => {
		assert.ok(error instanceof CrateTimeoutError)
		assert.ok(error instanceof BackendTimeoutError)
		assert.ok(error instanceof Error)
		assert.equal(error.name, "CrateTimeoutError")
		assert.equal(error.message, "CrateDB did not respond within 200 ms")
		return true
	})
	assert.deepEqual(await query("SELECT fast"), [{ n: 1 }])
	await stalled
	assert.ok(performance.now() - started >= 180)
	assert.ok(performance.now() - started < 1000)
	assert.equal(closures.length, 1)
	await withBackendTimeout("Socket close", 700, async () => { await closures[0] })
	assert.equal((await execute("SELECT after_timeout")).rowcount, 1)
	await assert.rejects(execute("SELECT refused"), (error) => {
		assert.ok(error instanceof CrateError)
		assert.equal(error.code, 4043)
		return true
	})
	assert.deepEqual(await upsert({ table: "test", data: [{ id: 1 }], conflictColumns: ["id"] }), { rowcount: 1 })
	assert.equal(statements.filter((stmt) => stmt.includes("INSERT INTO")).length, 1)
	assert.ok(statements.some((stmt) => stmt.includes("SELECT count(*)")))
	assert.equal(closures.length, 2)
	await withBackendTimeout("Socket close", 700, async () => { await closures[1] })
})
